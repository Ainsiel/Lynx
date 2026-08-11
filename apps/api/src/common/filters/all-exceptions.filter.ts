import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { Rfc7807ProblemSchema } from '@lynx/shared'
import type { Request, Response } from 'express'
import { TooManyRequestsException } from '../errors/too-many-requests.exception'

const STATUS_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
}

function titleFor(status: number): string {
  return STATUS_TITLES[status] ?? `Error ${status}`
}

function detailOf(exception: unknown): string {
  if (exception instanceof HttpException) {
    const response = exception.getResponse()
    if (typeof response === 'string') {
      return response
    }
    const message = (response as { message?: string | string[] }).message
    if (Array.isArray(message)) {
      return message.join(', ')
    }
    return message ?? exception.message
  }
  if (exception instanceof Error) {
    return `${exception.name}: ${exception.message}`
  }
  return 'Internal Server Error'
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ?? randomUUID()

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR

    const problem = Rfc7807ProblemSchema.parse({
      type: `https://lynx.dev/errors/http-${status}`,
      title: titleFor(status),
      status,
      detail: detailOf(exception),
      instance: request.url,
    })

    if (exception instanceof TooManyRequestsException) {
      response.setHeader(
        'Retry-After',
        String(Math.ceil(exception.retryAfterMs / 1000)),
      )
    }

    response.setHeader('X-Request-Id', requestId)
    response.setHeader('Content-Type', 'application/problem+json')
    response.status(status).json(problem)
  }
}
