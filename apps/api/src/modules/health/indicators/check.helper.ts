import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus'

function messageOf(error: unknown): string {
  const candidate = error as { message?: string; errors?: unknown[] }
  if (
    candidate &&
    typeof candidate.errors === 'object' &&
    candidate.errors !== null &&
    candidate.errors.length > 0
  ) {
    return messageOf(candidate.errors[0])
  }
  if (error instanceof Error) {
    return error.message || error.name
  }
  return String(error)
}

export abstract class LynxHealthIndicator extends HealthIndicator {
  protected async runCheck(
    name: string,
    operation: () => Promise<unknown>,
  ): Promise<HealthIndicatorResult> {
    try {
      await operation()
      return this.getStatus(name, true)
    } catch (error) {
      throw new HealthCheckError(
        `${name} check failed`,
        this.getStatus(name, false, { message: messageOf(error) }),
      )
    }
  }
}
