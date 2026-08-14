import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import Redis from 'ioredis'
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
import type { PrismaClient } from '@lynx/db'
import { hash } from 'bcryptjs'
import { SALT_ROUNDS } from '@lynx/db'

const REFRESH_TOKEN_EXPIRY_DAYS =
  Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS) || 7
const REFRESH_TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name)

  constructor(
    private readonly githubAdapter: GithubOAuthAdapter,
    private readonly stateRepository: StateRepository,
    private readonly userRepository: UserRepository,
    private readonly emailPublisher: EmailPublisherAdapter,
    private readonly jwtService: JwtService,
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(GITHUB_CLIENT_ID) private readonly clientId: string | null,
    @Inject(GITHUB_CLIENT_SECRET) private readonly clientSecret: string | null,
  ) {}

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret)
  }

  getAuthorizationUrl(): { url: string; state: string } {
    if (!this.isConfigured()) {
      throw new UnauthorizedException('GitHub OAuth is not configured')
    }

    const state = this.stateRepository.createState()
    const redirectUri = process.env.GITHUB_CALLBACK_URL ?? 'http://localhost:3000/auth/oauth/github/callback'
    const url = `https://github.com/login/oauth/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=user:email`
    return { url, state }
  }

  async handleCallback(code: string, state: string) {
    const valid = await this.stateRepository.verifyState(state)
    if (!valid) {
      throw new UnauthorizedException('Invalid or expired OAuth state')
    }

    if (!this.clientId || !this.clientSecret) {
      throw new UnauthorizedException('GitHub OAuth is not configured')
    }

    const accessToken = await this.githubAdapter.exchangeCodeForToken(
      code,
      this.clientId,
      this.clientSecret,
    )

    const githubUser = await this.githubAdapter.fetchUser(accessToken)
    const email = githubUser.email ?? await this.githubAdapter.fetchPrimaryEmail(accessToken)

    const githubId = String(githubUser.id)

    // 1. Find by GitHub ID
    let user = await this.userRepository.findByGithubId(githubId)
    if (user) {
      return this.issueTokens(user)
    }

    // 2. Find by email → link
    user = await this.userRepository.findByEmail(email)
    if (user) {
      user = await this.userRepository.linkGithub(
        user.id,
        githubId,
        githubUser.login,
        githubUser.avatar_url,
      )
      return this.issueTokens(user)
    }

    // 3. Create new user
    user = await this.userRepository.create({
      name: githubUser.name ?? githubUser.login,
      email,
      githubId,
      githubUsername: githubUser.login,
      avatarUrl: githubUser.avatar_url ?? undefined,
    })

    this.emailPublisher.publishWelcome(user.email, user.name)

    return this.issueTokens(user)
  }

  private async issueTokens(user: {
    id: string
    role: string
    name: string
    email: string
    avatarUrl: string | null
  }) {
    const accessToken = this.jwtService.sign({ sub: user.id, role: user.role })
    const refreshToken = await this.issueRefreshToken(user.id, user.role)
    return { user, accessToken, refreshToken }
  }

  private async issueRefreshToken(
    userId: string,
    role: string,
    family?: string,
  ): Promise<string> {
    const { randomUUID } = await import('node:crypto')
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
}
