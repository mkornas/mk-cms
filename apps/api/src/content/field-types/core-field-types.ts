import type { FieldType, FieldTypeContext } from './field-type.interface';
import { FieldValidationError } from './field-validation.error';

// ── small config/readers helpers ──────────────────────
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const str = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : undefined;
const bool = (v: unknown): boolean | undefined =>
  typeof v === 'boolean' ? v : undefined;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertString(value: unknown, ctx: FieldTypeContext): string {
  if (typeof value !== 'string') {
    throw new FieldValidationError(ctx.key, 'must be a string');
  }
  return value;
}

function checkLength(value: string, ctx: FieldTypeContext): void {
  const min = num(ctx.config.minLength);
  const max = num(ctx.config.maxLength);
  if (min !== undefined && value.length < min) {
    throw new FieldValidationError(ctx.key, `must be at least ${min} characters`);
  }
  if (max !== undefined && value.length > max) {
    throw new FieldValidationError(ctx.key, `must be at most ${max} characters`);
  }
}

/** A single-line/multi-line text field. */
const textField: FieldType<string> = {
  id: 'text',
  label: 'Text',
  validate(value, ctx) {
    let v = assertString(value, ctx);
    if (bool(ctx.config.trim) !== false) v = v.trim();
    checkLength(v, ctx);
    const pattern = str(ctx.config.pattern);
    if (pattern && !new RegExp(pattern).test(v)) {
      throw new FieldValidationError(ctx.key, 'does not match required pattern');
    }
    return v;
  },
  defaultValue: () => '',
};

const textareaField: FieldType<string> = {
  ...textField,
  id: 'textarea',
  label: 'Text area',
};

/** Rich text stored as an HTML string (sanitization handled at a later layer). */
const richTextField: FieldType<string> = {
  id: 'richtext',
  label: 'Rich text',
  validate(value, ctx) {
    const v = assertString(value, ctx);
    checkLength(v, ctx);
    return v;
  },
  defaultValue: () => '',
};

const numberField: FieldType<number> = {
  id: 'number',
  label: 'Number',
  validate(value, ctx) {
    const v =
      typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : value;
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new FieldValidationError(ctx.key, 'must be a number');
    }
    if (bool(ctx.config.integer) && !Number.isInteger(v)) {
      throw new FieldValidationError(ctx.key, 'must be an integer');
    }
    const min = num(ctx.config.min);
    const max = num(ctx.config.max);
    if (min !== undefined && v < min) {
      throw new FieldValidationError(ctx.key, `must be >= ${min}`);
    }
    if (max !== undefined && v > max) {
      throw new FieldValidationError(ctx.key, `must be <= ${max}`);
    }
    return v;
  },
};

const booleanField: FieldType<boolean> = {
  id: 'boolean',
  label: 'Boolean',
  validate(value, ctx) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new FieldValidationError(ctx.key, 'must be a boolean');
  },
  defaultValue: () => false,
};

/** Stored as an ISO-8601 string. */
const dateField: FieldType<string> = {
  id: 'date',
  label: 'Date/time',
  validate(value, ctx) {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new FieldValidationError(ctx.key, 'is not a valid date');
      }
      return value.toISOString();
    }
    const s = assertString(value, ctx);
    const ms = Date.parse(s);
    if (Number.isNaN(ms)) {
      throw new FieldValidationError(ctx.key, 'is not a valid date');
    }
    return new Date(ms).toISOString();
  },
};

/** One (or, if config.multiple, several) values from a fixed option set. */
const selectField: FieldType = {
  id: 'select',
  label: 'Select',
  validate(value, ctx) {
    const rawOptions = Array.isArray(ctx.config.options)
      ? ctx.config.options
      : [];
    const allowed = new Set(
      rawOptions.map((o) =>
        typeof o === 'string'
          ? o
          : String((o as { value?: unknown }).value ?? ''),
      ),
    );
    const check = (v: unknown): string => {
      const s = String(v);
      if (!allowed.has(s)) {
        throw new FieldValidationError(ctx.key, `"${s}" is not an allowed option`);
      }
      return s;
    };
    if (bool(ctx.config.multiple)) {
      if (!Array.isArray(value)) {
        throw new FieldValidationError(ctx.key, 'must be an array of options');
      }
      return value.map(check);
    }
    return check(value);
  },
};

/** A reference (or references) to other content entries by id. Existence is
 * verified by the content service, not here. */
const relationField: FieldType = {
  id: 'relation',
  label: 'Relation',
  validate(value, ctx) {
    const checkId = (v: unknown): string => {
      const s = String(v);
      if (!UUID_RE.test(s)) {
        throw new FieldValidationError(ctx.key, `"${s}" is not a valid id`);
      }
      return s;
    };
    if (bool(ctx.config.multiple)) {
      if (!Array.isArray(value)) {
        throw new FieldValidationError(ctx.key, 'must be an array of ids');
      }
      return value.map(checkId);
    }
    return checkId(value);
  },
};

/** A reference (or references) to media library items by id. Like `relation`
 * but scoped to the media library — powers featured-image / gallery fields. */
const mediaField: FieldType = {
  id: 'media',
  label: 'Media',
  validate(value, ctx) {
    const checkId = (v: unknown): string => {
      const s = String(v);
      if (!UUID_RE.test(s)) {
        throw new FieldValidationError(ctx.key, `"${s}" is not a valid media id`);
      }
      return s;
    };
    if (bool(ctx.config.multiple)) {
      if (!Array.isArray(value)) {
        throw new FieldValidationError(ctx.key, 'must be an array of media ids');
      }
      return value.map(checkId);
    }
    return checkId(value);
  },
};

const emailField: FieldType<string> = {
  id: 'email',
  label: 'Email',
  validate(value, ctx) {
    const v = assertString(value, ctx).trim();
    if (!EMAIL_RE.test(v)) {
      throw new FieldValidationError(ctx.key, 'is not a valid email address');
    }
    return v;
  },
};

const urlField: FieldType<string> = {
  id: 'url',
  label: 'URL',
  validate(value, ctx) {
    const v = assertString(value, ctx).trim();
    try {
      const u = new URL(v);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        throw new Error('bad protocol');
      }
    } catch {
      throw new FieldValidationError(ctx.key, 'is not a valid http(s) URL');
    }
    return v;
  },
};

const slugField: FieldType<string> = {
  id: 'slug',
  label: 'Slug',
  validate(value, ctx) {
    const v = assertString(value, ctx).trim().toLowerCase();
    if (!SLUG_RE.test(v)) {
      throw new FieldValidationError(
        ctx.key,
        'must be lowercase words separated by single hyphens',
      );
    }
    return v;
  },
};

/** Arbitrary JSON-serializable value. */
const jsonField: FieldType = {
  id: 'json',
  label: 'JSON',
  validate(value, ctx) {
    try {
      JSON.stringify(value);
    } catch {
      throw new FieldValidationError(ctx.key, 'must be JSON-serializable');
    }
    return value ?? null;
  },
  defaultValue: () => null,
};

export const CORE_FIELD_TYPES: FieldType[] = [
  textField,
  textareaField,
  richTextField,
  numberField,
  booleanField,
  dateField,
  selectField,
  relationField,
  mediaField,
  emailField,
  urlField,
  slugField,
  jsonField,
];
