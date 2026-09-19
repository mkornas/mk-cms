import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { AppConfigService } from '../config/app-config.service';
import { UsersService } from '../users/users.service';
import { UserStatus } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { PasswordService } from './password.service';

/** Invite tokens live for a week — long enough to survive a delayed email,
 *  short enough to bound exposure of a leaked link. */
const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;
const MIN_PASSWORD_LENGTH = 8;

/** Carried in the emailed invite JWT. `purpose` disambiguates it from access /
 *  refresh tokens (which carry `type` instead), so none can stand in for it. */
interface InviteTokenPayload {
  sub: string;
  purpose: 'invite';
}

/**
 * Invite-by-email onboarding: mints/verifies a short-lived invite JWT and
 * orchestrates emailing the set-password link + applying the chosen password.
 * The token only ever travels inside the emailed link — it is never logged.
 */
@Injectable()
export class InviteService {
  constructor(
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * An argon2 hash of a cryptographically-random string: an unusable password
   * for a freshly-invited user, who sets a real one via the emailed link.
   */
  randomPasswordHash(): Promise<string> {
    return this.passwords.hash(randomBytes(32).toString('hex'));
  }

  /** Mint an invite JWT and email the set-password link. */
  async sendInvite(user: {
    id: string;
    email: string;
    name: string;
  }): Promise<void> {
    const token = await this.jwt.signAsync(
      { sub: user.id, purpose: 'invite' } satisfies InviteTokenPayload,
      { secret: this.config.jwt.accessSecret, expiresIn: INVITE_TTL_SECONDS },
    );
    const link = `${this.config.app.adminBaseUrl}/set-password?token=${encodeURIComponent(token)}`;
    await this.mail.send({
      to: user.email,
      subject: 'You have been invited to mk-cms',
      text:
        `Hi ${user.name},\n\n` +
        `You have been invited to mk-cms. Set your password to activate your account:\n\n` +
        `${link}\n\n` +
        `This link expires in 7 days. If you were not expecting this, you can safely ignore this email.`,
    });
  }

  /**
   * Verify an invite token and set the user's password. Rejects invalid,
   * expired, or wrong-purpose tokens, and enforces a minimum password length.
   * On success the account is activated.
   */
  async acceptInvite(token: string, password: string): Promise<boolean> {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }

    let payload: InviteTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<InviteTokenPayload>(token, {
        secret: this.config.jwt.accessSecret,
      });
    } catch {
      throw new UnauthorizedException(
        'This invite link is invalid or has expired.',
      );
    }
    if (payload.purpose !== 'invite') {
      throw new UnauthorizedException('This invite link is invalid.');
    }

    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('This invite link is no longer valid.');
    }
    // Single-use: the token only redeems a pending invitation. Once the account
    // is Active (accepted) — or was suspended — the link is spent, so a leaked
    // link can't later reset the password or reactivate a disabled account.
    if (user.status !== UserStatus.Invited) {
      throw new UnauthorizedException('This invite has already been used.');
    }

    await this.users.updatePassword(
      user.id,
      await this.passwords.hash(password),
    );
    await this.users.update(user.id, { status: UserStatus.Active });
    return true;
  }
}
