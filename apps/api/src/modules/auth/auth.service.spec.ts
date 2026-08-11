import { Test, TestingModule } from '@nestjs/testing'
import { JwtModule } from '@nestjs/jwt'
import { ConflictException, UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { UserRepository } from './adapters/user.repository'

describe('AuthService', () => {
  let service: AuthService
  let userRepository: jest.Mocked<UserRepository>

  const mockUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: '$2a$10$hashedpassword',
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
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
    userRepository = module.get(UserRepository)
  })

  describe('register', () => {
    it('should register a new user and return user + accessToken', async () => {
      userRepository.findByEmail.mockResolvedValue(null)
      userRepository.create.mockResolvedValue(mockUser)

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
    it('should login with valid credentials and return user + accessToken', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser)

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
})
