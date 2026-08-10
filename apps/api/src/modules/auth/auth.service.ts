import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { compare, hash } from 'bcryptjs'
import { RegisterInput, LoginInput } from '@lynx/shared'
import { UserRepository } from './adapters/user.repository'

const SALT_ROUNDS = 10

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterInput) {
    const existing = await this.userRepository.findByEmail(input.email)
    if (existing) {
      throw new ConflictException('Email already exists')
    }

    const passwordHash = await hash(input.password, SALT_ROUNDS)
    const user = await this.userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
    })

    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
    })

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
    }
  }

  async login(input: LoginInput) {
    const user = await this.userRepository.findByEmail(input.email)
    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const passwordValid = await compare(input.password, user.passwordHash)
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
    })

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
    }
  }
}
