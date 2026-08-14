import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common'
import { AuthenticatedRequest } from '../../common/guards/jwt-auth.guard'

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const user = request.user

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required')
    }

    return true
  }
}
