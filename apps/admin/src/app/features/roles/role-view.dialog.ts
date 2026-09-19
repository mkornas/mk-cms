import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MkButton, MkBadge, MkOverlayRef, MK_OVERLAY_DATA } from '@mk-kit/ui';

export interface RoleViewData {
  name: string;
  slug: string;
  capabilities: string[];
}

/** A resource group within a role (e.g. "content" → read/create/…). */
interface CapGroup {
  resource: string;
  actions: string[];
}

/**
 * Read-only viewer for a (system) role: its capabilities laid out as a
 * space-filling grid of resource groups rather than a tall vertical list.
 * Opened from the roles table; system roles can't be edited, only inspected.
 */
@Component({
  selector: 'app-role-view-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkBadge],
  template: `
    <div class="dlg">
      <header class="dlg__head">
        <div>
          <h2>{{ data.name }}</h2>
          <span class="dlg__slug">{{ data.slug }}</span>
        </div>
        <button mkButton variant="ghost" size="sm" iconOnly aria-label="Close" (click)="close()">✕</button>
      </header>

      <p class="dlg__meta mk-muted">
        {{ all ? 'Full access' : count + (count === 1 ? ' capability' : ' capabilities') }} · read-only system role
      </p>

      <div class="dlg__body">
        @if (all) {
          <p class="all-note">
            <mk-badge tone="primary" variant="solid">&ast; all capabilities</mk-badge>
            &nbsp;Grants every capability, including ones added in the future.
          </p>
        } @else {
          <div class="grid">
            @for (g of groups; track g.resource) {
              <div class="grp">
                <span class="grp__label">{{ g.resource }}</span>
                <div class="chips">
                  @for (a of g.actions; track a) {
                    <mk-badge [tone]="a === '*' ? 'primary' : 'neutral'" variant="soft">
                      {{ a === '*' ? 'all' : a }}
                    </mk-badge>
                  }
                </div>
              </div>
            } @empty {
              <p class="mk-muted">No capabilities.</p>
            }
          </div>
        }
      </div>

      <footer class="dlg__foot">
        <button mkButton tone="primary" (click)="close()">Close</button>
      </footer>
    </div>
  `,
  styles: `
    .dlg { display: flex; flex-direction: column; min-height: 0; }
    .dlg__head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--mk-space-3); }
    .dlg__head h2 { margin: 0; font-size: var(--mk-font-size-lg); }
    .dlg__slug { font-family: var(--mk-font-mono); font-size: var(--mk-font-size-sm); color: var(--mk-text-muted); }
    .dlg__meta { margin: var(--mk-space-1) 0 var(--mk-space-4); }
    .dlg__body { overflow: auto; }
    .grid { display: grid; gap: var(--mk-space-4); grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); }
    .grp__label { display: block; font-size: var(--mk-font-size-sm); font-weight: var(--mk-font-weight-medium); color: var(--mk-text-muted); margin-bottom: var(--mk-space-2); text-transform: capitalize; }
    .chips { display: flex; flex-wrap: wrap; gap: var(--mk-space-1); }
    .all-note { color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); margin: 0; }
    .dlg__foot { display: flex; justify-content: flex-end; margin-top: var(--mk-space-5); }
  `,
})
export class RoleViewDialog {
  private readonly ref = inject<MkOverlayRef<void>>(MkOverlayRef);
  protected readonly data = inject<RoleViewData>(MK_OVERLAY_DATA);

  private readonly caps = (this.data.capabilities ?? []).map((c) => String(c ?? ''));
  protected readonly all = this.caps.includes('*');
  protected readonly count = this.caps.length;
  protected readonly groups: CapGroup[] = this.buildGroups();

  private buildGroups(): CapGroup[] {
    const groups = new Map<string, string[]>();
    for (const cap of this.caps) {
      if (cap === '*') continue;
      const [resource, action = '*'] = cap.split(':');
      const list = groups.get(resource) ?? [];
      list.push(action);
      groups.set(resource, list);
    }
    return [...groups.entries()]
      .map(([resource, actions]) => ({ resource, actions: actions.sort() }))
      .sort((a, b) => a.resource.localeCompare(b.resource));
  }

  protected close(): void {
    this.ref.close();
  }
}
