import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import { MkButton, MkFormField, MkSelect, MkBadge, MkAlert } from '@mk-kit/ui';

const ENTRY_TRANSLATIONS = gql`
  query EntryTranslations($id: ID!) {
    entryTranslations(id: $id) {
      id
      type
      locale
      title
      status
    }
  }
`;

const ADD_TRANSLATION = gql`
  mutation AddTranslation($id: ID!, $locale: String!) {
    addTranslation(id: $id, locale: $locale) {
      id
      type
      locale
    }
  }
`;

interface Translation {
  id: string;
  type: string;
  locale: string;
  title: string;
  status: string;
}

interface Option {
  label: string;
  value: string;
}

/** Common locales offered in the "add translation" picker. */
const COMMON_LOCALES: Option[] = [
  { label: 'English (en)', value: 'en' },
  { label: 'Spanish (es)', value: 'es' },
  { label: 'French (fr)', value: 'fr' },
  { label: 'German (de)', value: 'de' },
  { label: 'Italian (it)', value: 'it' },
  { label: 'Polish (pl)', value: 'pl' },
  { label: 'Portuguese (pt)', value: 'pt' },
  { label: 'Dutch (nl)', value: 'nl' },
];

/**
 * Lists the translations that share this entry's translation group and lets an
 * editor spin up a new-locale Draft. Each sibling links to its own editor;
 * adding a translation navigates straight into the freshly created draft.
 */
@Component({
  selector: 'app-entry-translations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkFormField, MkSelect, MkBadge, MkAlert],
  template: `
    @if (error(); as msg) {
      <mk-alert tone="danger" style="margin-bottom: var(--mk-space-3)">{{ msg }}</mk-alert>
    }

    @if (translations().length) {
      <ul class="list">
        @for (t of translations(); track t.id) {
          <li class="row">
            <button type="button" class="link" (click)="open(t)">
              <mk-badge variant="soft" [tone]="t.id === entryId() ? 'primary' : 'neutral'">
                {{ t.locale }}
              </mk-badge>
              <span class="title">{{ t.title }}</span>
            </button>
            <span class="status">{{ t.status }}</span>
          </li>
        }
      </ul>
    } @else {
      <p class="muted">No translations yet.</p>
    }

    <div class="add">
      <mk-form-field label="Add translation">
        <mk-select
          placeholder="Choose a locale…"
          [options]="addableLocales()"
          [value]="newLocale()"
          (valueChange)="newLocale.set(asStr($event))"
        />
      </mk-form-field>
      <button
        mkButton
        tone="primary"
        [loading]="busy()"
        [disabled]="!newLocale()"
        (click)="add()"
      >
        Add
      </button>
    </div>
  `,
  styles: `
    .list { list-style: none; margin: 0 0 var(--mk-space-4); padding: 0; display: grid; gap: var(--mk-space-2); }
    .row { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-3); }
    .link {
      display: flex; align-items: center; gap: var(--mk-space-2);
      background: none; border: 0; padding: 0; cursor: pointer; text-align: left;
      color: var(--mk-text); font: inherit; min-width: 0;
    }
    .link:hover .title { text-decoration: underline; }
    .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .status { color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); text-transform: capitalize; }
    .muted { color: var(--mk-text-muted); margin: 0 0 var(--mk-space-4); }
    .add { display: flex; align-items: flex-end; gap: var(--mk-space-2); }
    .add mk-form-field { flex: 1; }
  `,
})
export class EntryTranslationsPanel {
  private readonly apollo = inject(Apollo);
  private readonly router = inject(Router);

  readonly entryId = input.required<string>();

  protected readonly translations = signal<Translation[]>([]);
  protected readonly newLocale = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  /** Locales not already present in the group. */
  protected readonly addableLocales = computed(() => {
    const taken = new Set(this.translations().map((t) => t.locale));
    return COMMON_LOCALES.filter((o) => !taken.has(o.value));
  });

  private lastLoaded: string | null = null;

  constructor() {
    effect(() => {
      const id = this.entryId();
      if (id && id !== this.lastLoaded) {
        this.lastLoaded = id;
        void this.load(id);
      }
    });
  }

  protected asStr(v: unknown): string {
    return v == null ? '' : String(v);
  }

  private async load(entryId: string): Promise<void> {
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.apollo.query<{ entryTranslations: Translation[] }>({
          query: ENTRY_TRANSLATIONS,
          variables: { id: entryId },
          fetchPolicy: 'network-only',
        }),
      );
      this.translations.set(res.data?.entryTranslations ?? []);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load translations.');
    }
  }

  protected open(t: Translation): void {
    if (t.id === this.entryId()) return;
    void this.router.navigate(['/content', t.type, t.id]);
  }

  protected async add(): Promise<void> {
    const locale = this.newLocale();
    if (!locale || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.apollo.mutate<{ addTranslation: { id: string; type: string } }>({
          mutation: ADD_TRANSLATION,
          variables: { id: this.entryId(), locale },
        }),
      );
      const created = res.data?.addTranslation;
      if (created) {
        this.newLocale.set('');
        void this.router.navigate(['/content', created.type, created.id]);
      }
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to add translation.');
    } finally {
      this.busy.set(false);
    }
  }
}
