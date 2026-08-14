import { Controller, Get, HttpCode, HttpStatus, Query, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard'
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator'
import { GithubService } from './github.service'

const REFRESH_COOKIE = 'refresh_token'
const REFRESH_TOKEN_EXPIRY_DAYS =
  Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS) || 7

@Controller('auth')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get('oauth/status')
  @HttpCode(HttpStatus.OK)
  status() {
    return { github: this.githubService.isConfigured() }
  }

  @Get('oauth/github')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10 })
  async githubAuth(@Res() res: Response) {
    const { url } = this.githubService.getAuthorizationUrl()
    res.redirect(url)
  }

  @Get('oauth/github/callback')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10 })
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const { refreshToken } = await this.githubService.handleCallback(code, state)

    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    })

    res.redirect(`${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/dashboard`)
  }
}
