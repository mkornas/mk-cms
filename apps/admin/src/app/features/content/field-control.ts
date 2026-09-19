import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, map, of } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { FormsModule } from '@angular/forms';
import {
  MkFormField,
  MkInput,
  MkSelect,
  MkMultiSelect,
  MkSwitch,
  MkDatePicker,
  MkCodeEditor,
  MkBlockEditor,
} from '@mk-kit/ui';
import { MediaField } from './media-field';
import { FieldDef } from '../../core/graphql/types';
import { ENTRIES } from '../../core/graphql/operations';

interface Option {
  label: string;
  value: unknown;
}

/**
 * Schema-driven single-field control. Given a {@link FieldDef}, it renders the
 * matching mk-kit control and two-way-binds the raw field value. Relation fields
 * load their options from the API (entries of `config.contentType`).
 */
@Component({
  selector: 'app-field-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MkFormField,
    MkInput,
    MkSelect,
    MkMultiSelect,
    MkSwitch,
    MkDatePicker,
    MkCodeEditor,
    MkBlockEditor,
    MediaField,
    FormsModule,
  ],
  templateUrl: './field-control.html',
  styles: `
    /* Open writing canvas for richtext: eyebrow label, no field box. */
    .prose-field { display: block; }
    .prose-field__label {
      display: block;
      margin-bottom: var(--mk-space-2);
      color: var(--mk-text-subtle);
      font-size: var(--mk-font-size-xs);
      font-weight: var(--mk-font-weight-semibold);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .prose-field__error {
      margin: var(--mk-space-2) 0 0;
      color: var(--mk-danger);
      font-size: var(--mk-font-size-sm);
    }
  `,
})
export class FieldControl {
  private readonly apollo = inject(Apollo);

  readonly field = input.required<FieldDef>();
  /** Raw field value, two-way bound with the parent form's `fields` record. */
  readonly value = model<unknown>();
  /** Server/validation error for this field. */
  readonly error = input<string | null>(null);

  protected readonly multiple = computed(() => this.field().config['multiple'] === true);

  /** Static options for `select` (from `config.options`). */
  protected readonly selectOptions = computed<Option[]>(() => {
    const raw = this.field().config['options'];
    if (!Array.isArray(raw)) return [];
    return raw.map((o) =>
      typeof o === 'object' && o !== null
        ? { label: String((o as Option).label ?? (o as Option).value), value: (o as Option).value }
        : { label: String(o), value: o },
    );
  });

  /** Relation options, loaded from entries of the target content type. */
  protected readonly relationOptions = toSignal(
    toObservable(this.field).pipe(
      switchMap((f) => {
        if (f.type !== 'relation') return of<Option[]>([]);
        const target = f.config['contentType'];
        if (typeof target !== 'string') return of<Option[]>([]);
        return this.apollo
          .watchQuery<{ entries: { id: string; title: string }[] }>({
            query: ENTRIES,
            variables: { type: target, limit: 100, offset: 0 },
          })
          .valueChanges.pipe(
            map((r) =>
              (r.data?.entries ?? []).map((e) => ({
                label: String(e.title ?? ''),
                value: e.id,
              })),
            ),
          );
      }),
    ),
    { initialValue: [] as Option[] },
  );

  // --- typed views over the raw value -------------------------------------
  protected readonly asString = computed(() => {
    const v = this.value();
    return v == null ? '' : String(v);
  });
  protected readonly asNumber = computed(() => {
    const v = this.value();
    return typeof v === 'number' ? v : v == null || v === '' ? null : Number(v);
  });
  protected readonly asBool = computed(() => this.value() === true);
  protected readonly asDate = computed(() => {
    const v = this.value();
    return typeof v === 'string' && v ? new Date(v) : null;
  });
  protected readonly asArray = computed(() => {
    const v = this.value();
    return Array.isArray(v) ? v : v == null ? [] : [v];
  });

  /** JSON field is edited as text; parsed back on valid input. */
  protected readonly jsonText = signal(this.initialJson());
  protected readonly jsonError = signal<string | null>(null);

  private initialJson(): string {
    const v = this.value();
    if (v == null) return '';
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  }

  protected setFromInput(target: EventTarget | null): void {
    this.value.set((target as HTMLInputElement)?.value ?? '');
  }

  protected setNumber(target: EventTarget | null): void {
    const raw = (target as HTMLInputElement)?.value ?? '';
    this.value.set(raw === '' ? null : Number(raw));
  }

  protected setDate(d: Date | null): void {
    this.value.set(d ? d.toISOString() : null);
  }

  protected setJson(text: string): void {
    this.jsonText.set(text);
    if (text.trim() === '') {
      this.jsonError.set(null);
      this.value.set(null);
      return;
    }
    try {
      this.value.set(JSON.parse(text));
      this.jsonError.set(null);
    } catch {
      this.jsonError.set('Invalid JSON');
    }
  }
}
