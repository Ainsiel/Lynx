import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'
import {
  RegisterInputSchema,
  LoginInputSchema,
  RefreshInputSchema,
  LogoutInputSchema,
  RegisterInput,
  LoginInput,
  RefreshInput,
  LogoutInput,
} from '@lynx/shared'
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator'
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { JwtAuthGuard, AuthenticatedRequest } from '../../common/guards/jwt-auth.guard'
import { userFromRequest } from '../../common/guards/user-from-request'
import { AuthService } from './auth.service'
import { REFRESH_TOKEN_EXPIRY_DAYS } from './auth.service'

const REFRESH_COOKIE = 'refresh_token'
const COOKIE_MAX_AGE_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/auth',
  maxAge: COOKIE_MAX_AGE_MS,
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5 })
  async register(
    @Body(new ZodValidationPipe(RegisterInputSchema)) body: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(body)
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS)
    return { user: result.user, accessToken: result.accessToken }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5 })
  async login(
    @Body(new ZodValidationPipe(LoginInputSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body)
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS)
    return { user: result.user, accessToken: result.accessToken }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10 })
  async refresh(
    @Body(new ZodValidationPipe(RefreshInputSchema)) body: RefreshInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refresh(body.refreshToken)
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS)
    return { accessToken: result.accessToken }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 10, dimension: 'user' })
  async logout(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(LogoutInputSchema)) body: LogoutInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = userFromRequest(req)
    await this.authService.logout(user.sub, body.refreshToken)
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' })
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 60, dimension: 'user' })
  async me(@Req() req: AuthenticatedRequest) {
    const user = userFromRequest(req)
    return this.authService.me(user.sub)
  }
}
