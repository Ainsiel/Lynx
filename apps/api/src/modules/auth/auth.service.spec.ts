import { Test, TestingModule } from '@nestjs/testing'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { hashSync } from 'bcryptjs'
import { AuthService } from './auth.service'
import { UserRepository } from './adapters/user.repository'
import { EmailPublisherAdapter } from './adapters/email-publisher.adapter'
import { PRISMA_CLIENT, REDIS_CLIENT } from '../../common/infra/tokens'

describe('AuthService', () => {
  let service: AuthService
  let userRepository: jest.Mocked<UserRepository>
  let emailPublisher: { publishWelcome: jest.Mock; publishReset: jest.Mock }
  let jwtService: JwtService
  let prisma: {
    $transaction: jest.Mock
    refreshToken: {
      create: jest.Mock
      findUnique: jest.Mock
      update: jest.Mock
      findMany: jest.Mock
    }
    passwordResetToken: {
      create: jest.Mock
      findUnique: jest.Mock
      update: jest.Mock
    }
    user: {
      update: jest.Mock
    }
  }
  let redis: {
    set: jest.Mock
    exists: jest.Mock
  }

  const mockUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: hashSync('password123', 10),
    githubId: null,
    githubUsername: null,
    avatarUrl: null,
    role: 'USER' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(async () => {
    const mockUserRepository = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
    }

    emailPublisher = {
      publishWelcome: jest.fn(),
      publishReset: jest.fn(),
    }

    prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        update: jest.fn(),
      },
    }

    redis = {
      set: jest.fn(),
      exists: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '15m' },
        }),
      ],
      providers: [
        AuthService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: EmailPublisherAdapter, useValue: emailPublisher },
        { provide: PRISMA_CLIENT, useValue: prisma },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
    userRepository = module.get(UserRepository)
    jwtService = module.get(JwtService)
  })

  describe('register', () => {
    it('should register a new user and return user + accessToken + refreshToken', async () => {
      userRepository.findByEmail.mockResolvedValue(null)
      userRepository.create.mockResolvedValue(mockUser)
      prisma.refreshToken.create.mockResolvedValue({})

      const result = await service.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      })

      expect(result.user).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        role: mockUser.role,
      })
      expect(result.accessToken).toBeDefined()
      expect(typeof result.accessToken).toBe('string')
      expect(result.refreshToken).toBeDefined()
      expect(typeof result.refreshToken).toBe('string')
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1)
    })

    it('should throw ConflictException for duplicate email', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser)

      await expect(
        service.register({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('login', () => {
    it('should login with valid credentials and return user + accessToken + refreshToken', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser)
      prisma.refreshToken.create.mockResolvedValue({})

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      })

      expect(result.user).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        role: mockUser.role,
      })
      expect(result.accessToken).toBeDefined()
      expect(typeof result.accessToken).toBe('string')
      expect(result.refreshToken).toBeDefined()
      expect(typeof result.refreshToken).toBe('string')
    })

    it('should throw UnauthorizedException for non-existent email', async () => {
      userRepository.findByEmail.mockResolvedValue(null)

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('should throw UnauthorizedException for invalid password', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser)

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('refresh', () => {
    it('should rotate refresh token and return new pair', async () => {
      const jti = randomUUID()
      const family = randomUUID()
      const rawToken = await jwtService.signAsync(
        { sub: mockUser.id, jti, role: 'USER' },
        { expiresIn: '7d' },
      )

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: randomUUID(),
        jti,
        userId: mockUser.id,
        token: 'unused',
        family,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        createdAt: new Date(),
      })
      prisma.refreshToken.update.mockResolvedValue({})
      prisma.refreshToken.create.mockResolvedValue({})
      redis.set.mockResolvedValue('OK')

      const result = await service.refresh(rawToken)

      expect(result.accessToken).toBeDefined()
      expect(result.refreshToken).toBeDefined()
      expect(prisma.refreshToken.update).toHaveBeenCalledTimes(1)
      expect(redis.set).toHaveBeenCalledTimes(1)
    })

    it('should revoke family on reuse detection', async () => {
      const jti = randomUUID()
      const family = randomUUID()
      const rawToken = await jwtService.signAsync(
        { sub: mockUser.id, jti, role: 'USER' },
        { expiresIn: '7d' },
      )

      prisma.refreshToken.findUnique
        .mockResolvedValueOnce({
          id: randomUUID(),
          jti,
          userId: mockUser.id,
          token: 'unused',
          family,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          revokedAt: new Date(),
          createdAt: new Date(),
        })
        .mockResolvedValueOnce(null)
      prisma.refreshToken.findMany.mockResolvedValue([])
      redis.set.mockResolvedValue('OK')

      await expect(service.refresh(rawToken)).rejects.toThrow(UnauthorizedException)
    })

    it('should throw UnauthorizedException for invalid token', async () => {
      await expect(service.refresh('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      )
    })
  })

  describe('logout', () => {
    it('should revoke refresh token', async () => {
      const jti = randomUUID()
      const rawToken = await jwtService.signAsync(
        { sub: mockUser.id, jti },
        { expiresIn: '7d' },
      )

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: randomUUID(),
        jti,
        userId: mockUser.id,
        token: hashSync(rawToken, 10),
        family: randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        createdAt: new Date(),
      })
      prisma.refreshToken.update.mockResolvedValue({})
      redis.set.mockResolvedValue('OK')

      await service.logout(mockUser.id, rawToken)

      expect(prisma.refreshToken.update).toHaveBeenCalledTimes(1)
      expect(redis.set).toHaveBeenCalledTimes(1)
    })

    it('should not throw for invalid token', async () => {
      await expect(
        service.logout(mockUser.id, 'invalid-token'),
      ).resolves.toBeUndefined()
    })
  })

  describe('me', () => {
    it('should return user profile', async () => {
      userRepository.findById.mockResolvedValue(mockUser)

      const result = await service.me(mockUser.id)

      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        role: mockUser.role,
      })
    })

    it('should throw UnauthorizedException for non-existent user', async () => {
      userRepository.findById.mockResolvedValue(null)

      await expect(service.me('nonexistent-id')).rejects.toThrow(
        UnauthorizedException,
      )
    })
  })

  describe('forgotPassword', () => {
    it('should create a reset token and publish email', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser)
      prisma.passwordResetToken.create.mockResolvedValue({})

      await service.forgotPassword({ email: 'test@example.com' })

      expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1)
      expect(emailPublisher.publishReset).toHaveBeenCalledTimes(1)
      expect(emailPublisher.publishReset).toHaveBeenCalledWith(
        mockUser.email,
        expect.any(String),
      )
    })

    it('should not throw for non-existent email', async () => {
      userRepository.findByEmail.mockResolvedValue(null)

      await expect(
        service.forgotPassword({ email: 'nonexistent@example.com' }),
      ).resolves.toBeUndefined()

      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled()
      expect(emailPublisher.publishReset).not.toHaveBeenCalled()
    })
  })

  describe('resetPassword', () => {
    it('should update password with valid token', async () => {
      const rawToken = 'valid-token-123'
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: randomUUID(),
        userId: mockUser.id,
        token: 'hashed-token',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        createdAt: new Date(),
      })
      prisma.passwordResetToken.update.mockResolvedValue({})
      prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops))

      await service.resetPassword({ token: rawToken, password: 'newpassword123' })

      expect(prisma.passwordResetToken.update).toHaveBeenCalledTimes(1)
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('should throw BadRequestException for invalid token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null)

      await expect(
        service.resetPassword({ token: 'invalid-token', password: 'newpassword123' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw BadRequestException for expired token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: randomUUID(),
        userId: mockUser.id,
        token: 'hashed-token',
        expiresAt: new Date(Date.now() - 3600000),
        usedAt: null,
        createdAt: new Date(),
      })

      await expect(
        service.resetPassword({ token: 'expired-token', password: 'newpassword123' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw BadRequestException for already used token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: randomUUID(),
        userId: mockUser.id,
        token: 'hashed-token',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: new Date(),
        createdAt: new Date(),
      })

      await expect(
        service.resetPassword({ token: 'used-token', password: 'newpassword123' }),
      ).rejects.toThrow(BadRequestException)
    })
  })
})
