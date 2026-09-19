import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../config/app-config.service';
import { UsersService } from '../users/users.service';
import { UserStatus, type User } from '../users/entities/user.entity';
import { PasswordService } from './password.service';
import type {
  AccessTokenPayload,
  AuthTokens,
  RefreshTokenPayload,
} from './token.types';

const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  /** Verify email + password; returns the user or throws 401. */
  async validate(email: string, password: string): Promise<User> {
    const user = await this.users.findByEmailWithSecret(email);
    const ok =
      user && (await this.passwords.verify(user.passwordHash, password));
    if (!user || !ok) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    if (user.status === UserStatus.Suspended) {
      throw new UnauthorizedException('Account is suspended.');
    }
    return user;
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await this.validate(email, password);
    return this.issueTokens(user.id);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.jwt.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Wrong token type.');
    }
    const user = await this.users.findById(payload.sub);
    if (!user || user.status === UserStatus.Suspended) {
      throw new UnauthorizedException('Account is not active.');
    }
    return this.issueTokens(user.id);
  }

  private async issueTokens(userId: string): Promise<AuthTokens> {
    const accessPayload: AccessTokenPayload = { sub: userId, type: 'access' };
    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      type: 'refresh',
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.jwt.accessSecret,
        expiresIn: ACCESS_TTL_SECONDS,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.jwt.refreshSecret,
        expiresIn: REFRESH_TTL_SECONDS,
      }),
    ]);
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TTL_SECONDS,
    };
  }
}
