import { Test, TestingModule } from '@nestjs/testing'
import { JwtModule } from '@nestjs/jwt'
import { UnauthorizedException } from '@nestjs/common'
import { GithubService } from './github.service'
import { GithubOAuthAdapter } from './adapters/github-oauth.adapter'
import { StateRepository } from './adapters/state.repository'
import { UserRepository } from './adapters/user.repository'
import { EmailPublisherAdapter } from './adapters/email-publisher.adapter'
import {
  PRISMA_CLIENT,
  REDIS_CLIENT,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
} from '../../common/infra/tokens'

describe('GithubService', () => {
  let service: GithubService
  let githubAdapter: jest.Mocked<GithubOAuthAdapter>
  let stateRepository: jest.Mocked<StateRepository>
  let userRepository: jest.Mocked<UserRepository>
  let emailPublisher: { publishWelcome: jest.Mock; publishReset: jest.Mock }
  let prisma: {
    refreshToken: { create: jest.Mock }
  }

  const mockUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'GitHub User',
    email: 'github@example.com',
    passwordHash: null,
    githubId: '12345',
    githubUsername: 'githubuser',
    avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
    role: 'USER' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(async () => {
    githubAdapter = {
      exchangeCodeForToken: jest.fn(),
      fetchUser: jest.fn(),
      fetchPrimaryEmail: jest.fn(),
    } as unknown as jest.Mocked<GithubOAuthAdapter>

    stateRepository = {
      createState: jest.fn(),
      verifyState: jest.fn(),
    } as unknown as jest.Mocked<StateRepository>

    userRepository = {
      findByGithubId: jest.fn(),
      findByEmail: jest.fn(),
      linkGithub: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>

    emailPublisher = {
      publishWelcome: jest.fn(),
      publishReset: jest.fn(),
    }

    prisma = {
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '15m' },
        }),
      ],
      providers: [
        GithubService,
        { provide: GithubOAuthAdapter, useValue: githubAdapter },
        { provide: StateRepository, useValue: stateRepository },
        { provide: UserRepository, useValue: userRepository },
        { provide: EmailPublisherAdapter, useValue: emailPublisher },
        { provide: PRISMA_CLIENT, useValue: prisma },
        { provide: REDIS_CLIENT, useValue: {} },
        { provide: GITHUB_CLIENT_ID, useValue: 'test-client-id' },
        { provide: GITHUB_CLIENT_SECRET, useValue: 'test-client-secret' },
      ],
    }).compile()

    service = module.get<GithubService>(GithubService)
  })

  describe('isConfigured', () => {
    it('should return true when both client ID and secret are set', () => {
      expect(service.isConfigured()).toBe(true)
    })
  })

  describe('getAuthorizationUrl', () => {
    it('should return a valid GitHub authorization URL', () => {
      stateRepository.createState.mockReturnValue('test-state')

      const { url, state } = service.getAuthorizationUrl()

      expect(url).toContain('github.com/login/oauth/authorize')
      expect(url).toContain('client_id=test-client-id')
      expect(url).toContain('scope=user:email')
      expect(state).toBe('test-state')
    })

    it('should throw UnauthorizedException when not configured', async () => {
      const module = await Test.createTestingModule({
        imports: [
          JwtModule.register({
            secret: 'test-secret',
            signOptions: { expiresIn: '15m' },
          }),
        ],
        providers: [
          GithubService,
          { provide: GithubOAuthAdapter, useValue: githubAdapter },
          { provide: StateRepository, useValue: stateRepository },
          { provide: UserRepository, useValue: userRepository },
          { provide: EmailPublisherAdapter, useValue: emailPublisher },
          { provide: PRISMA_CLIENT, useValue: prisma },
          { provide: REDIS_CLIENT, useValue: {} },
          { provide: GITHUB_CLIENT_ID, useValue: null },
          { provide: GITHUB_CLIENT_SECRET, useValue: null },
        ],
      }).compile()

      const unconfigured = module.get<GithubService>(GithubService)
      expect(() => unconfigured.getAuthorizationUrl()).toThrow(UnauthorizedException)
    })
  })

  describe('handleCallback', () => {
    it('should throw UnauthorizedException for invalid state', async () => {
      stateRepository.verifyState.mockResolvedValue(false)

      await expect(
        service.handleCallback('code-123', 'invalid-state'),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('should create a new user when no GitHub ID or email match', async () => {
      stateRepository.verifyState.mockResolvedValue(true)
      githubAdapter.exchangeCodeForToken.mockResolvedValue('gh-token-123')
      githubAdapter.fetchUser.mockResolvedValue({
        id: 12345,
        login: 'githubuser',
        email: 'github@example.com',
        name: 'GitHub User',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      })
      userRepository.findByGithubId.mockResolvedValue(null)
      userRepository.findByEmail.mockResolvedValue(null)
      userRepository.create.mockResolvedValue(mockUser)

      const result = await service.handleCallback('code-123', 'valid-state')

      expect(userRepository.create).toHaveBeenCalledWith({
        name: 'GitHub User',
        email: 'github@example.com',
        githubId: '12345',
        githubUsername: 'githubuser',
        avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
      })
      expect(emailPublisher.publishWelcome).toHaveBeenCalledWith(
        'github@example.com',
        'GitHub User',
      )
      expect(result.accessToken).toBeDefined()
      expect(result.refreshToken).toBeDefined()
    })

    it('should link GitHub to existing user when email matches', async () => {
      const existingUser = { ...mockUser, githubId: null }
      stateRepository.verifyState.mockResolvedValue(true)
      githubAdapter.exchangeCodeForToken.mockResolvedValue('gh-token-123')
      githubAdapter.fetchUser.mockResolvedValue({
        id: 12345,
        login: 'githubuser',
        email: 'existing@example.com',
        name: 'Existing User',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      })
      userRepository.findByGithubId.mockResolvedValue(null)
      userRepository.findByEmail.mockResolvedValue(existingUser)
      userRepository.linkGithub.mockResolvedValue({
        ...existingUser,
        githubId: '12345',
        githubUsername: 'githubuser',
      })

      const result = await service.handleCallback('code-123', 'valid-state')

      expect(userRepository.linkGithub).toHaveBeenCalledWith(
        existingUser.id,
        '12345',
        'githubuser',
        'https://avatars.githubusercontent.com/u/12345',
      )
      expect(result.accessToken).toBeDefined()
    })

    it('should return existing session when GitHub ID already linked', async () => {
      stateRepository.verifyState.mockResolvedValue(true)
      githubAdapter.exchangeCodeForToken.mockResolvedValue('gh-token-123')
      githubAdapter.fetchUser.mockResolvedValue({
        id: 12345,
        login: 'githubuser',
        email: 'github@example.com',
        name: 'GitHub User',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      })
      userRepository.findByGithubId.mockResolvedValue(mockUser)

      const result = await service.handleCallback('code-123', 'valid-state')

      expect(userRepository.findByGithubId).toHaveBeenCalledWith('12345')
      expect(result.accessToken).toBeDefined()
    })

    it('should fetch primary email when user email is null', async () => {
      stateRepository.verifyState.mockResolvedValue(true)
      githubAdapter.exchangeCodeForToken.mockResolvedValue('gh-token-123')
      githubAdapter.fetchUser.mockResolvedValue({
        id: 12345,
        login: 'githubuser',
        email: null,
        name: 'GitHub User',
        avatar_url: null,
      })
      githubAdapter.fetchPrimaryEmail.mockResolvedValue('primary@example.com')
      userRepository.findByGithubId.mockResolvedValue(null)
      userRepository.findByEmail.mockResolvedValue(null)
      userRepository.create.mockResolvedValue({
        ...mockUser,
        email: 'primary@example.com',
      })

      const result = await service.handleCallback('code-123', 'valid-state')

      expect(githubAdapter.fetchPrimaryEmail).toHaveBeenCalledWith('gh-token-123')
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'primary@example.com' }),
      )
      expect(result.accessToken).toBeDefined()
    })
  })
})
