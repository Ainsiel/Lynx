import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'
import {
  CreateLinkInputSchema,
  CreateLinkInput,
  UpdateLinkInputSchema,
  UpdateLinkInput,
  LinkListQuerySchema,
  LinkListQuery,
} from '@lynx/shared'
import { RateLimits } from '../../common/rate-limit/rate-limit.decorator'
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
  @RateLimits({ limit: 10, dimension: 'user' }, { limit: 30, dimension: 'ip' })
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

  @Get()
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimits({ limit: 20, dimension: 'user' }, { limit: 60, dimension: 'ip' })
  async list(
    @Req() req: AuthenticatedRequest,
    @Query(new ZodValidationPipe(LinkListQuerySchema)) query: LinkListQuery,
  ) {
    const user = userFromRequest(req)
    return this.linksService.list(user.sub, user.role, query)
  }

  @Patch(':slug')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimits({ limit: 20, dimension: 'user' }, { limit: 60, dimension: 'ip' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(UpdateLinkInputSchema)) body: UpdateLinkInput,
  ) {
    const user = userFromRequest(req)
    return this.linksService.update(slug, user.sub, user.role, body)
  }

  @Delete(':slug')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimits({ limit: 20, dimension: 'user' }, { limit: 60, dimension: 'ip' })
  @HttpCode(204)
  async delete(
    @Req() req: AuthenticatedRequest,
    @Param('slug') slug: string,
  ) {
    const user = userFromRequest(req)
    await this.linksService.delete(slug, user.sub, user.role)
  }
}
