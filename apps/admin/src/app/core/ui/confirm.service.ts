import { Injectable, inject } from '@angular/core';
import { MkDialogService, MkConfirmDialogData } from '@mk-kit/ui';

/**
 * Thin wrapper over {@link MkDialogService.confirm} giving destructive admin
 * actions a consistent confirmation dialog. Every delete flows through here so
 * the copy and danger styling stay uniform.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MkDialogService);

  /** Arbitrary confirmation; resolves true when confirmed. */
  confirm(data: MkConfirmDialogData): Promise<boolean> {
    return this.dialog.confirm(data);
  }

  /**
   * Standard "delete X?" danger confirm. `subject` is the human label
   * (e.g. `the redirect “/old → /new”`); pass a custom `message` to override.
   */
  remove(subject: string, message?: string): Promise<boolean> {
    return this.dialog.confirm({
      title: `Delete ${subject}?`,
      message: message ?? "This can't be undone.",
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
      icon: 'trash',
    });
  }
}
