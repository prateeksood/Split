import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protects all admin endpoints.
 * 1. Requires a valid JWT (same as JwtAuthGuard).
 * 2. Checks the authenticated user's email against ADMIN_EMAILS (comma-separated env var).
 */
@Injectable()
export class AdminGuard extends AuthGuard('jwt') implements CanActivate {
  private readonly adminEmails: Set<string>;

  constructor(private readonly config: ConfigService) {
    super();
    const raw = config.get<string>('ADMIN_EMAILS') ?? '';
    this.adminEmails = new Set(
      raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Run JWT validation first.
    const isAuthenticated = await super.canActivate(context);
    if (!isAuthenticated) throw new UnauthorizedException();

    const request = context.switchToHttp().getRequest<{ user?: { email?: string } }>();
    const email = request.user?.email?.toLowerCase();

    if (!email || !this.adminEmails.has(email)) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
