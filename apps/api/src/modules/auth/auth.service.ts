import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { compare, hash } from 'bcryptjs'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import Redis from 'ioredis'
import { SALT_ROUNDS } from '@lynx/db'
import type { PrismaClient } from '@lynx/db'
import { RegisterInput, LoginInput, ForgotPasswordInput, ResetPasswordInput } from '@lynx/shared'
import { UserRepository, UserRecord } from './adapters/user.repository'
import { EmailPublisherAdapter } from './adapters/email-publisher.adapter'
import { PRISMA_CLIENT, REDIS_CLIENT } from '../../common/infra/tokens'

const BLACKLIST_PREFIX = 'lynx:jwt:blacklist:'
export const REFRESH_TOKEN_EXPIRY_DAYS =
  Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS) || 7
const REFRESH_TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000

function buildAuthResponse(user: UserRecord, accessToken: string, refreshToken: string) {
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  }
}

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly emailPublisher: EmailPublisherAdapter,
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
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

    const accessToken = this.jwtService.sign({ sub: user.id, role: user.role })
    const refreshToken = await this.issueRefreshToken(user.id, user.role)

    this.emailPublisher.publishWelcome(user.email, user.name)

    return buildAuthResponse(user, accessToken, refreshToken)
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

    const accessToken = this.jwtService.sign({ sub: user.id, role: user.role })
    const refreshToken = await this.issueRefreshToken(user.id, user.role)
    return buildAuthResponse(user, accessToken, refreshToken)
  }

  async refresh(refreshTokenRaw: string) {
    let payload: { sub: string; jti: string; role: string }
    try {
      payload = await this.jwtService.verifyAsync<{
        sub: string
        jti: string
        role: string
      }>(refreshTokenRaw)
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token')
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { jti: payload.jti },
    })

    if (!stored || stored.revokedAt) {
      if (stored) {
        await this.revokeFamily(stored.family)
      }
      throw new UnauthorizedException('Refresh token reused or revoked')
    }

    await this.revokeToken(stored.jti, stored.expiresAt)

    const accessToken = this.jwtService.sign({
      sub: payload.sub,
      role: payload.role,
    })
    const newRefreshToken = await this.issueRefreshToken(
      payload.sub,
      payload.role,
      stored.family,
    )

    return { accessToken, refreshToken: newRefreshToken }
  }

  async logout(userId: string, refreshTokenRaw: string) {
    let payload: { sub: string; jti: string }
    try {
      payload = await this.jwtService.verifyAsync<{ sub: string; jti: string }>(
        refreshTokenRaw,
      )
    } catch {
      return
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { jti: payload.jti },
    })

    if (stored && stored.userId === userId && !stored.revokedAt) {
      await this.revokeToken(stored.jti, stored.expiresAt)
    }
  }

  async me(userId: string) {
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UnauthorizedException('User not found')
    }
    return { id: user.id, name: user.name, email: user.email, role: user.role }
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.userRepository.findByEmail(input.email)
    if (!user) return

    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS)

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, token: tokenHash, expiresAt },
    })

    this.emailPublisher.publishReset(user.email, rawToken)
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const tokenHash = createHash('sha256').update(input.token).digest('hex')

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
    })

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token')
    }

    const passwordHash = await hash(input.password, SALT_ROUNDS)

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { token: tokenHash },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
    ])
  }

  private async issueRefreshToken(
    userId: string,
    role: string,
    family?: string,
  ): Promise<string> {
    const jti = randomUUID()
    const tokenFamily = family ?? randomUUID()
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS)

    const rawToken = await this.jwtService.signAsync(
      { sub: userId, jti, role },
      { expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d` },
    )

    const tokenHash = await hash(rawToken, SALT_ROUNDS)

    await this.prisma.refreshToken.create({
      data: {
        jti,
        userId,
        token: tokenHash,
        family: tokenFamily,
        expiresAt,
      },
    })

    return rawToken
  }

  private async revokeToken(jti: string, expiresAt: Date): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { jti },
      data: { revokedAt: new Date() },
    })
    await this.blacklistJti(jti, expiresAt)
  }

  private async blacklistJti(jti: string, expiresAt: Date): Promise<void> {
    const ttlMs = expiresAt.getTime() - Date.now()
    if (ttlMs > 0) {
      await this.redis.set(`${BLACKLIST_PREFIX}${jti}`, '1', 'PX', ttlMs)
    }
  }

  private async revokeFamily(family: string): Promise<void> {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { family, revokedAt: null },
    })

    if (tokens.length === 0) return

    const now = new Date()
    const jtiExpiryPairs: Array<{ jti: string; expiresAt: Date }> = []

    await this.prisma.$transaction(
      tokens.map((t) =>
        this.prisma.refreshToken.update({
          where: { jti: t.jti },
          data: { revokedAt: now },
        }),
      ),
    )

    for (const t of tokens) {
      jtiExpiryPairs.push({ jti: t.jti, expiresAt: t.expiresAt })
    }

    for (const { jti, expiresAt } of jtiExpiryPairs) {
      await this.blacklistJti(jti, expiresAt)
    }
  }
}
