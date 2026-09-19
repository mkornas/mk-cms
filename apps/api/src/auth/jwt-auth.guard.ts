import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { requestFromContext } from '../graphql/gql-request';
import { UsersService } from '../users/users.service';
import { UserStatus } from '../users/entities/user.entity';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AccessTokenPayload } from './token.types';

/**
 * Global authentication guard. Validates the Bearer access token, loads the
 * user fresh from the DB (so a suspended/deleted account is rejected even with a
 * still-valid token), and stores it in the request context for downstream
 * guards and handlers. Routes marked {@link Public} skip this entirely.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly users: UsersService,
    private readonly tenant: TenantContextService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = requestFromContext(ctx);
    const token = this.extractBearer(req);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.jwt.accessSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Wrong token type.');
    }

    const user = await this.users.findById(payload.sub);
    if (!user || user.status === UserStatus.Suspended) {
      throw new UnauthorizedException('Account is not active.');
    }

    this.tenant.setUser(user);
    return true;
  }

  private extractBearer(req: Request): string | undefined {
    const header = req.headers.authorization;
    if (!header) return undefined;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
  }
}
