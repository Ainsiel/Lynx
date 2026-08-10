import { HttpException, HttpStatus } from '@nestjs/common'

export class TooManyRequestsException extends HttpException {
  constructor(readonly retryAfterMs: number) {
    super('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS)
  }
}
