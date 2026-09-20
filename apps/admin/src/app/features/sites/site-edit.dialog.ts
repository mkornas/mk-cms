import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, firstValueFrom } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import {
  MkButton,
  MkFormField,
  MkInput,
  MkSelect,
  MkChip,
  MkDivider,
  MkOverlayRef,
  MK_OVERLAY_DATA,
} from '@mk-kit/ui';
import { ConfirmService } from '../../core/ui/confirm.service';
import { slugify } from '../../core/util/slugify';
import {
  ROLES,
  CREATE_SITE,
  UPDATE_SITE,
  DELETE_SITE,
  SITE_MEMBERS,
  ADD_SITE_MEMBER,
  UPDATE_SITE_MEMBER,
  REMOVE_SITE_MEMBER,
} from '../../core/graphql/operations';

export interface SiteLite {
  id: string;
  slug: string;
  name: string;
  status: string;
  domains: string[];
}

interface Role {
  id: string;
  slug: string;
  name: string;
}

interface Member {
  membershipId: string;
  userId: string;
  email: string;
  name: string;
  roleSlug: string;
  roleName: string;
}

export type SiteDialogMode = 'create' | 'edit';

export interface SiteDialogData {
  mode: SiteDialogMode;
  /** Required for `edit`. */
  site?: SiteLite;
}

const STATUSES = ['Active', 'Suspended', 'Archived'];

// Lenient hostname (optionally with a :port) — must start/end alphanumeric.
const DOMAIN_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/;

// UPDATE_SITE's shared selection omits `domains`, so use a local mutation that
// returns it to keep the Apollo cache in sync after a save.
const UPDATE_SITE_DOMAINS = gql`
  mutation UpdateSiteDomains($id: ID!, $input: UpdateSiteInput!) {
    updateSite(id: $id, input: $input) {
      id
      domains
    }
  }
`;

/**
 * Create or edit a site (tenant) in an overlay. In `create` mode it collects a
 * name and derives the slug server-side. In `edit` mode it is a richer editor:
 * site details, domains and members. The dialog owns all of its mutations
 * (success + error surface as global toasts) and closes with `true` when it
 * changed data so the caller can refetch.
 */
@Component({
  selector: 'app-site-edit-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkFormField, MkInput, MkSelect, MkChip, MkDivider],
  template: `
    <div class="dlg">
      <header class="dlg__head">
        <h2>{{ title() }}</h2>
        <button mkButton variant="ghost" size="sm" iconOnly aria-label="Close" (click)="cancel()">✕</button>
      </header>

      <div class="dlg__body">
        @if (mode === 'create') {
          <mk-form-field label="Name" hint="Slug is derived from the name.">
            <input mkInput placeholder="e.g. Northwind Studio"
              [value]="name()" (input)="set($event.target, name.set)"
              (keyup.enter)="submitCreate()" />
          </mk-form-field>
        } @else {
          <!-- Details -->
          <div class="details">
            <mk-form-field label="Name">
              <input mkInput [value]="name()" (input)="set($event.target, name.set)" />
            </mk-form-field>
            <mk-form-field label="Status">
              <mk-select [options]="statusOptions" [value]="status()" (valueChange)="status.set(asStr($event))" />
            </mk-form-field>
          </div>
          <div class="mk-form-actions">
            <button mkButton tone="primary" [loading]="busy()" [disabled]="busy() || !name().trim()" (click)="saveDetails()">
              Save
            </button>
          </div>

          <mk-divider />

          <!-- Domains -->
          <section>
            <h3 class="dlg__section-title">Domains</h3>
            <p class="mk-muted dlg__hint">Requests arriving on any of these hosts resolve to this site.</p>
            @if (domains().length) {
              <div class="chips">
                @for (d of domains(); track d) {
                  <mk-chip removable removeLabel="Remove domain" (removed)="removeDomain(d)">{{ d }}</mk-chip>
                }
              </div>
            } @else {
              <p class="mk-muted dlg__hint">No domains yet.</p>
            }
            <div class="add-row">
              <mk-form-field label="Add domain" hint="Hostname only, e.g. example.com (no https://)." [error]="domainError()">
                <input mkInput placeholder="example.com"
                  [value]="newDomain()" (input)="onDomainInput($event.target)"
                  (keyup.enter)="addDomain()" />
              </mk-form-field>
              <div class="mk-form-actions">
                <button mkButton tone="primary" [loading]="busy()" [disabled]="busy() || !newDomain().trim()" (click)="addDomain()">
                  Add domain
                </button>
              </div>
            </div>
          </section>

          <mk-divider />

          <!-- Members -->
          <section>
            <h3 class="dlg__section-title">Members</h3>
            @if (members().length) {
              <div class="members">
                @for (m of members(); track m.membershipId) {
                  <div class="member-row">
                    <span class="who">{{ m.name }} <small>{{ m.email }}</small></span>
                    <mk-select [options]="roleOptions()"
                      [value]="m.roleSlug" (valueChange)="changeRole(m.membershipId, asStr($event))" />
                    <button mkButton variant="ghost" size="sm" tone="danger"
                      [disabled]="busy()" (click)="removeMember(m.membershipId)">Remove</button>
                  </div>
                }
              </div>
            } @else {
              <p class="mk-muted dlg__hint">No members yet.</p>
            }
            <div class="add-row add-row--member">
              <mk-form-field label="Add member by email">
                <input mkInput placeholder="user@example.com"
                  [value]="memberEmail()" (input)="set($event.target, memberEmail.set)" />
              </mk-form-field>
              <mk-form-field label="Role">
                <mk-select [options]="roleOptions()"
                  [value]="memberRole()" (valueChange)="memberRole.set(asStr($event))" />
              </mk-form-field>
              <div class="mk-form-actions">
                <button mkButton tone="primary" [loading]="busy()" [disabled]="busy() || !memberEmail().trim()" (click)="addMember()">
                  Add
                </button>
              </div>
            </div>
          </section>
        }
      </div>

      <footer class="dlg__foot">
        @if (mode === 'edit') {
          <button mkButton variant="ghost" tone="danger" [disabled]="busy()" (click)="remove()">Delete site</button>
        }
        <span class="dlg__spacer"></span>
        @if (mode === 'create') {
          <button mkButton variant="ghost" [disabled]="busy()" (click)="cancel()">Cancel</button>
          <button mkButton tone="primary" [loading]="busy()" [disabled]="busy() || !name().trim()" (click)="submitCreate()">
            Create site
          </button>
        } @else {
          <button mkButton variant="ghost" [disabled]="busy()" (click)="cancel()">Close</button>
        }
      </footer>
    </div>
  `,
  styles: `
    .dlg { display: flex; flex-direction: column; min-height: 0; }
    .dlg__head { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-3); margin-bottom: var(--mk-space-4); }
    .dlg__head h2 { margin: 0; font-size: var(--mk-font-size-lg); }
    .dlg__body { display: flex; flex-direction: column; gap: var(--mk-space-4); overflow: auto; }
    .dlg__section-title { margin: 0 0 var(--mk-space-1); font-size: var(--mk-font-size-md); }
    .dlg__hint { margin: 0 0 var(--mk-space-3); font-size: var(--mk-font-size-sm); }
    .details { display: grid; gap: var(--mk-space-3); grid-template-columns: 1fr 12rem; align-items: end; }
    .chips { display: flex; flex-wrap: wrap; gap: var(--mk-space-2); margin-bottom: var(--mk-space-3); }
    .add-row { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: var(--mk-space-3); }
    .add-row--member { grid-template-columns: 1fr 12rem auto; }
    .members { display: flex; flex-direction: column; gap: var(--mk-space-1); margin-bottom: var(--mk-space-3); }
    .member-row {
      display: grid; grid-template-columns: 1fr 12rem auto; align-items: center; gap: var(--mk-space-3);
      padding: var(--mk-space-2) var(--mk-space-3); border-radius: var(--mk-radius-sm);
      border: var(--mk-border-width) solid var(--mk-border-subtle);
    }
    .member-row .who small { color: var(--mk-text-muted); display: block; font-size: var(--mk-font-size-xs); }
    .dlg__foot { display: flex; align-items: center; gap: var(--mk-space-2); margin-top: var(--mk-space-5); }
    .dlg__spacer { flex: 1; }
  `,
})
export class SiteEditDialog {
  private readonly apollo = inject(Apollo);
  private readonly confirm = inject(ConfirmService);
  private readonly ref = inject<MkOverlayRef<boolean>>(MkOverlayRef);
  protected readonly data = inject<SiteDialogData>(MK_OVERLAY_DATA);

  protected readonly mode = this.data.mode;
  protected readonly statusOptions = STATUSES.map((s) => ({ label: s, value: s }));

  private readonly roles = toSignal(
    this.apollo
      .watchQuery<{ roles: Role[] }>({ query: ROLES })
      .valueChanges.pipe(map((r) => (r.data?.roles ?? []) as Role[])),
    { initialValue: [] as Role[] },
  );
  protected readonly roleOptions = computed(() =>
    this.roles().map((r) => ({ label: r.name, value: r.slug })),
  );

  // Details
  protected readonly name = signal(this.data.site?.name ?? '');
  protected readonly status = signal(this.data.site?.status ?? 'Active');

  // Domains
  protected readonly domains = signal<string[]>(this.data.site?.domains ?? []);
  protected readonly newDomain = signal('');
  protected readonly domainError = signal<string | null>(null);

  // Members
  protected readonly members = signal<Member[]>([]);
  protected readonly memberEmail = signal('');
  protected readonly memberRole = signal('editor');

  protected readonly busy = signal(false);
  /** Whether any mutation succeeded, so the caller knows to refetch on close. */
  private changed = false;

  protected readonly title = computed(() =>
    this.mode === 'edit' ? 'Edit site' : 'New site',
  );

  constructor() {
    if (this.mode === 'edit' && this.data.site) {
      void this.loadMembers(this.data.site.id);
    }
  }

  protected set(t: EventTarget | null, setter: (v: string) => void): void {
    setter((t as HTMLInputElement)?.value ?? '');
  }
  protected asStr(v: unknown): string {
    return v == null ? '' : String(v);
  }
  protected onDomainInput(t: EventTarget | null): void {
    this.newDomain.set((t as HTMLInputElement)?.value ?? '');
    this.domainError.set(null);
  }

  private get site(): SiteLite | undefined {
    return this.data.site;
  }

  private async loadMembers(siteId: string): Promise<void> {
    const res = await firstValueFrom(
      this.apollo.query<{ siteMembers: Member[] }>({
        query: SITE_MEMBERS,
        variables: { siteId },
        fetchPolicy: 'network-only',
      }),
    );
    this.members.set((res.data?.siteMembers ?? []) as Member[]);
  }

  private async mutate(work: Promise<unknown>): Promise<boolean> {
    this.busy.set(true);
    try {
      await work;
      this.changed = true;
      return true;
    } catch {
      // Error surfaced as a global toast by the notify link; keep the dialog open.
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  protected async submitCreate(): Promise<void> {
    if (this.busy()) return;
    const name = this.name().trim();
    if (!name) return;
    const ok = await this.mutate(
      firstValueFrom(
        this.apollo.mutate({
          mutation: CREATE_SITE,
          variables: { input: { name, slug: slugify(name) } },
        }),
      ),
    );
    if (ok) this.ref.close(true);
  }

  protected async saveDetails(): Promise<void> {
    if (this.busy()) return;
    const site = this.site;
    const name = this.name().trim();
    if (!site || !name) return;
    await this.mutate(
      firstValueFrom(
        this.apollo.mutate({
          mutation: UPDATE_SITE,
          variables: { id: site.id, input: { name, status: this.status() } },
        }),
      ),
    );
  }

  protected async remove(): Promise<void> {
    const site = this.site;
    if (!site || this.busy()) return;
    if (
      !(await this.confirm.remove(
        `the “${site.name}” site`,
        "This removes the site and all of its content. This can't be undone.",
      ))
    )
      return;
    const ok = await this.mutate(
      firstValueFrom(this.apollo.mutate({ mutation: DELETE_SITE, variables: { id: site.id } })),
    );
    if (ok) this.ref.close(true);
  }

  protected async addDomain(): Promise<void> {
    if (this.busy()) return;
    const site = this.site;
    if (!site) return;
    const domain = this.newDomain().trim().toLowerCase();
    if (!domain) return;
    if (!DOMAIN_RE.test(domain)) {
      this.domainError.set('Enter a valid domain, e.g. example.com or shop.example.com:8080.');
      return;
    }
    if (this.domains().includes(domain)) {
      this.newDomain.set('');
      return;
    }
    const next = [...this.domains(), domain];
    const ok = await this.persistDomains(site.id, next);
    if (ok) this.newDomain.set('');
  }

  protected async removeDomain(domain: string): Promise<void> {
    const site = this.site;
    if (!site) return;
    if (
      !(await this.confirm.remove(
        `the domain “${domain}”`,
        'Requests to this host will no longer resolve to this site.',
      ))
    )
      return;
    await this.persistDomains(
      site.id,
      this.domains().filter((d) => d !== domain),
    );
  }

  private async persistDomains(siteId: string, domains: string[]): Promise<boolean> {
    const ok = await this.mutate(
      firstValueFrom(
        this.apollo.mutate({
          mutation: UPDATE_SITE_DOMAINS,
          variables: { id: siteId, input: { domains } },
        }),
      ),
    );
    if (ok) this.domains.set(domains);
    return ok;
  }

  protected async addMember(): Promise<void> {
    if (this.busy()) return;
    const site = this.site;
    const email = this.memberEmail().trim();
    if (!site || !email) return;
    const ok = await this.mutate(
      firstValueFrom(
        this.apollo.mutate({
          mutation: ADD_SITE_MEMBER,
          variables: { siteId: site.id, email, roleSlug: this.memberRole() },
        }),
      ),
    );
    if (ok) {
      this.memberEmail.set('');
      await this.loadMembers(site.id);
    }
  }

  protected async changeRole(membershipId: string, roleSlug: string): Promise<void> {
    const site = this.site;
    if (!site) return;
    const ok = await this.mutate(
      firstValueFrom(
        this.apollo.mutate({
          mutation: UPDATE_SITE_MEMBER,
          variables: { membershipId, roleSlug },
        }),
      ),
    );
    if (ok) await this.loadMembers(site.id);
  }

  protected async removeMember(membershipId: string): Promise<void> {
    const site = this.site;
    if (!site) return;
    if (!(await this.confirm.remove('this member', 'Remove this member from the site?'))) return;
    const ok = await this.mutate(
      firstValueFrom(
        this.apollo.mutate({ mutation: REMOVE_SITE_MEMBER, variables: { membershipId } }),
      ),
    );
    if (ok) await this.loadMembers(site.id);
  }

  protected cancel(): void {
    this.ref.close(this.changed);
  }
}
