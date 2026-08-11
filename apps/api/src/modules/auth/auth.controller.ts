import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import {
  RegisterInputSchema,
  LoginInputSchema,
  RegisterInput,
  LoginInput,
} from '@lynx/shared'
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator'
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5 })
  async register(
    @Body(new ZodValidationPipe(RegisterInputSchema)) body: RegisterInput,
  ) {
    return this.authService.register(body)
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5 })
  async login(
    @Body(new ZodValidationPipe(LoginInputSchema)) body: LoginInput,
  ) {
    return this.authService.login(body)
  }
}
