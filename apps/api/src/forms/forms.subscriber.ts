import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { HookBus } from '../hooks/hook-bus.service';
import { CoreActions } from '../hooks/hooks.constants';
import { QUEUE_MAIL } from '../jobs/jobs.module';
import type { MailMessage } from '../mail/mail.service';
import type { Form } from './entities/form.entity';

interface FormSubmittedPayload {
  form: Form;
  data: Record<string, unknown>;
}

/**
 * Turns an accepted form submission into notification emails. Hook-driven and
 * async: it enqueues one mail job per configured recipient onto the mail queue,
 * so the public submit request returns immediately and delivery/retries happen
 * off-request.
 */
@Injectable()
export class FormsSubscriber implements OnModuleInit {
  constructor(
    private readonly hooks: HookBus,
    @InjectQueue(QUEUE_MAIL) private readonly mail: Queue,
  ) {}

  onModuleInit(): void {
    this.hooks.addAction<FormSubmittedPayload>(
      CoreActions.FormSubmitted,
      async ({ form, data }) => {
        const recipients = form.settings.notifyEmails ?? [];
        if (recipients.length === 0) return;
        const text = Object.entries(data)
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join('\n');
        for (const to of recipients) {
          const message: MailMessage = {
            to,
            subject: `New "${form.name}" submission`,
            text,
            from: form.settings.fromName,
          };
          await this.mail.add('notify', message);
        }
      },
    );
  }
}
