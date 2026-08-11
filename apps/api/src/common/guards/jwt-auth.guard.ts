import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'

export interface AuthenticatedUser {
  sub: string
  role: string
  jti: string
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = this.extractTokenFromHeader(request)
    if (!token) {
      throw new UnauthorizedException('Missing Bearer token')
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token)
      request.user = payload
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }

    return true
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const auth = request.headers.authorization
    if (!auth) return undefined
    const [type, token] = auth.split(' ')
    return type === 'Bearer' ? token : undefined
  }
}
