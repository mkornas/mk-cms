import { Injectable, Logger } from '@nestjs/common';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}

/**
 * Mail adapter. A thin seam over "how mail leaves the instance" — the default
 * transport just logs (dev-friendly, and lets tests assert delivery),
 * and a real SMTP/provider transport can be swapped in behind this same
 * interface without touching callers. Sending is done from a queue worker
 * ({@link MailProcessor}), never inline on a request.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async send(message: MailMessage): Promise<void> {
    // Default "log" transport. Replace with nodemailer/provider as an adapter.
    this.logger.log(
      `MAIL → ${message.to} · "${message.subject}" · ${message.text.replace(/\s+/g, ' ').slice(0, 120)}`,
    );
  }
}
