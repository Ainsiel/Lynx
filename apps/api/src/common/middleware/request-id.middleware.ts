import { Injectable, NestMiddleware } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id']
    const requestId =
      typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID()
    req.headers['x-request-id'] = requestId
    res.setHeader('X-Request-Id', requestId)
    next()
  }
}
