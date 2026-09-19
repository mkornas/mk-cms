import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../config/app-config.service';

const PREVIEW_TTL_SECONDS = 60 * 60; // 1 hour

interface PreviewTokenPayload {
  type: 'preview';
  /** Site the token is valid for. */
  site: string;
  /** Optional single entry the token is scoped to (else whole-site preview). */
  entry?: string;
}

/**
 * Signed, short-lived tokens that let a frontend fetch *unpublished* content
 * through the otherwise published-only Delivery API — the mechanism behind
 * "preview this draft" links. A token is bound to the site it was minted for,
 * so it can never unlock drafts on another tenant.
 */
@Injectable()
export class PreviewService {
  private readonly logger = new Logger(PreviewService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  sign(siteId: string, entryId?: string): string {
    const payload: PreviewTokenPayload = { type: 'preview', site: siteId };
    if (entryId) payload.entry = entryId;
    return this.jwt.sign(payload, {
      secret: this.config.jwt.accessSecret,
      expiresIn: PREVIEW_TTL_SECONDS,
    });
  }

  /**
   * Returns the payload if the token is valid for `siteId`, else null. Never
   * throws — an invalid preview token simply means "no preview access".
   */
  verify(token: string, siteId: string): PreviewTokenPayload | null {
    try {
      const payload = this.jwt.verify<PreviewTokenPayload>(token, {
        secret: this.config.jwt.accessSecret,
      });
      if (payload.type !== 'preview' || payload.site !== siteId) return null;
      return payload;
    } catch (err) {
      this.logger.debug(`Rejected preview token: ${(err as Error).message}`);
      return null;
    }
  }
}
