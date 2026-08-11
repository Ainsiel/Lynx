import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'
import { CreateLinkInputSchema, CreateLinkInput } from '@lynx/shared'
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator'
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { JwtAuthGuard, AuthenticatedRequest } from '../../common/guards/jwt-auth.guard'
import { userFromRequest } from '../../common/guards/user-from-request'
import { LinksService } from './links.service'

@Controller('links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 30, dimension: 'ip' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateLinkInputSchema)) body: CreateLinkInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = userFromRequest(req)
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined

    const result = await this.linksService.create(
      body,
      user.sub,
      idempotencyKey,
    )

    res.status(result.status === 201 ? HttpStatus.CREATED : HttpStatus.OK)
    return result.data
  }
}
