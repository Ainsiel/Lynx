import { Controller, Get, HttpCode, HttpStatus, Query, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { GithubCallbackQuerySchema, GithubCallbackQuery } from '@lynx/shared'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard'
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator'
import { REFRESH_TOKEN_EXPIRY_DAYS, ACCESS_TOKEN_EXPIRY_MS } from '@lynx/db'
import { GithubService } from './github.service'

const REFRESH_COOKIE = 'refresh_token'
const ACCESS_COOKIE = 'access_token'

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
    @Query(new ZodValidationPipe(GithubCallbackQuerySchema)) query: GithubCallbackQuery,
    @Res() res: Response,
  ) {
    const { accessToken, refreshToken } = await this.githubService.handleCallback(query.code, query.state)

    res.cookie(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: ACCESS_TOKEN_EXPIRY_MS,
    })

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
