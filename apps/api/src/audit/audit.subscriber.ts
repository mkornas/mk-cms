import { Injectable, OnModuleInit } from '@nestjs/common';
import { HookBus } from '../hooks/hook-bus.service';
import { CoreActions } from '../hooks/hooks.constants';
import { AuditService } from './audit.service';

interface EntryPayload {
  entry: { id: string; title: string; status: string };
}

/**
 * Bridges the hook bus to the audit log: at boot it subscribes core listeners
 * for the content lifecycle actions and records a trail entry for each. This is
 * the canonical example of a first-party feature that is *entirely* hook-driven
 * — the content engine has no idea auditing exists.
 */
@Injectable()
export class AuditSubscriber implements OnModuleInit {
  constructor(
    private readonly hooks: HookBus,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.hooks.addAction<EntryPayload>(
      CoreActions.ContentAfterSave,
      ({ entry }) =>
        this.audit.record({
          action: 'content.saved',
          summary: `Saved "${entry.title}"`,
          targetType: 'entry',
          targetId: entry.id,
          meta: { status: entry.status },
        }),
    );

    this.hooks.addAction<EntryPayload>(
      CoreActions.ContentAfterPublish,
      ({ entry }) =>
        this.audit.record({
          action: 'content.published',
          summary: `Published "${entry.title}"`,
          targetType: 'entry',
          targetId: entry.id,
        }),
    );

    this.hooks.addAction<EntryPayload>(
      CoreActions.ContentAfterTrash,
      ({ entry }) =>
        this.audit.record({
          action: 'content.trashed',
          summary: `Trashed "${entry.title}"`,
          targetType: 'entry',
          targetId: entry.id,
        }),
    );
  }
}
