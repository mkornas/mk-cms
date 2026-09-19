import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import {
  MkAlert,
  MkAvatar,
  MkBadge,
  MkButton,
  MkCard,
  MkFileUpload,
  MkFormField,
  MkInput,
  MkPageHeader,
} from '@mk-kit/ui';
import { SessionStore, SessionUser } from '../../core/session/session.store';
import { MediaUploadService } from '../../core/media/media.service';

/**
 * Self-service profile update. Mirrors the API `me` shape; the mutation is
 * defined inline (not in the shared operations file) because it is owned by
 * this feature. `updateProfile` scopes the write to the current user server
 * side — no id is sent.
 */
const UPDATE_PROFILE = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      email
      name
      avatarUrl
      isSuperAdmin
    }
  }
`;

/** Apollo returns a deep-partial of the selection set; narrow at the edge. */
type UpdateProfileResult = { updateProfile?: Partial<SessionUser> | null };

/**
 * "My profile": any authenticated user edits their own display name and avatar
 * here. Email and the super-admin flag are read-only (managed elsewhere). On
 * save we push the fresh identity into the session store so the shell header
 * (and anything else reading `user()`) updates instantly.
 */
@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MkCard,
    MkFormField,
    MkInput,
    MkButton,
    MkAvatar,
    MkFileUpload,
    MkAlert,
    MkBadge,
    MkPageHeader,
  ],
  template: `
    <mk-page-header
      heading="My profile"
      description="Update how you appear across the CMS."
    />

    @if (error(); as msg) {
      <mk-alert tone="danger">{{ msg }}</mk-alert>
    }

    <div class="layout">
      <mk-card>
        <div class="identity">
          <mk-avatar
            size="lg"
            [src]="avatarUrl() ?? undefined"
            [name]="name() || email()"
          />
          <div class="identity-meta">
            <strong>{{ name() || 'Unnamed user' }}</strong>
            <span class="email">{{ email() }}</span>
            @if (isSuperAdmin()) {
              <span><mk-badge tone="primary" variant="soft">Super admin</mk-badge></span>
            }
          </div>
        </div>

        <mk-file-upload
          accept="image/*"
          [maxSize]="26214400"
          label="Upload a new avatar"
          hint="PNG, JPG, WebP · up to 25 MB"
          [uploadFn]="avatarUploadFn"
        />

        @if (avatarUrl()) {
          <button mkButton variant="outline" size="sm" (click)="clearAvatar()">
            Remove avatar
          </button>
        }
      </mk-card>

      <mk-card>
        <div class="fields">
          <mk-form-field label="Display name" hint="Shown as your author name.">
            <input
              mkInput
              [value]="name()"
              (input)="setName($event.target)"
              placeholder="Your name"
            />
          </mk-form-field>

          <mk-form-field label="Email" hint="Managed by an administrator.">
            <input mkInput [value]="email()" [disabled]="true" />
          </mk-form-field>

          <div class="actions">
            <button
              mkButton
              tone="primary"
              [loading]="saving()"
              [disabled]="!name().trim()"
              (click)="save()"
            >
              Save changes
            </button>
          </div>
        </div>
      </mk-card>
    </div>
  `,
  styles: `
    mk-page-header { display: block; margin-bottom: var(--mk-space-4); }
    .layout { display: grid; grid-template-columns: 1fr; gap: var(--mk-space-4); }
    @media (min-width: 48rem) {
      .layout { grid-template-columns: minmax(0, 22rem) 1fr; align-items: start; }
    }
    .identity { display: flex; align-items: center; gap: var(--mk-space-3); margin-bottom: var(--mk-space-4); }
    .identity-meta { display: flex; flex-direction: column; gap: var(--mk-space-1); min-width: 0; }
    .identity-meta strong { font-size: var(--mk-font-size-lg); }
    .identity-meta .email { color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); word-break: break-all; }
    mk-file-upload { display: block; margin-bottom: var(--mk-space-3); }
    .fields { display: grid; gap: var(--mk-space-4); }
    .actions { display: flex; gap: var(--mk-space-2); }
  `,
})
export class ProfilePage {
  private readonly apollo = inject(Apollo);
  private readonly session = inject(SessionStore);
  /** Injected per the shared upload pattern; the page uses its own URL-capturing
   *  handler below because `MediaUploadService.uploadFn` resolves to `void`. */
  protected readonly upload = inject(MediaUploadService);

  protected readonly name = signal(String(this.session.user()?.name ?? ''));
  protected readonly avatarUrl = signal<string | null>(
    this.session.user()?.avatarUrl ?? null,
  );
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly email = computed(() => String(this.session.user()?.email ?? ''));
  protected readonly isSuperAdmin = computed(
    () => this.session.user()?.isSuperAdmin ?? false,
  );

  /**
   * `MkUploadFn`-compatible avatar uploader. Streams the file to `POST /media`
   * (same endpoint + auth headers as the media library) and, on success, reads
   * the stored URL off the JSON response and stages it as the new avatar.
   */
  protected readonly avatarUploadFn = (
    file: File,
    onProgress: (percent: number) => void,
  ): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/media');
      const token = this.session.accessToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      const site = this.session.activeSiteSlug();
      if (site) xhr.setRequestHeader('x-site', site);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText) as { url?: string };
            if (res.url) this.avatarUrl.set(res.url);
            resolve();
          } catch {
            reject(new Error('Malformed upload response.'));
          }
        } else {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));

      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
    });

  protected setName(target: EventTarget | null): void {
    this.name.set((target as HTMLInputElement)?.value ?? '');
  }

  protected clearAvatar(): void {
    this.avatarUrl.set(null);
  }

  protected async save(): Promise<void> {
    if (this.saving() || !this.name().trim()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.apollo.mutate<UpdateProfileResult>({
          mutation: UPDATE_PROFILE,
          variables: {
            input: { name: this.name().trim(), avatarUrl: this.avatarUrl() },
          },
        }),
      );
      const updated = res.data?.updateProfile;
      if (updated) {
        // Reflect immediately in the shell header and everywhere reading user().
        this.session.setUser({
          id: String(updated.id ?? this.session.user()?.id ?? ''),
          email: String(updated.email ?? this.session.user()?.email ?? ''),
          name: String(updated.name ?? ''),
          avatarUrl: updated.avatarUrl ?? null,
          isSuperAdmin: !!updated.isSuperAdmin,
        });
      }
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Could not save your profile.',
      );
    } finally {
      this.saving.set(false);
    }
  }
}
