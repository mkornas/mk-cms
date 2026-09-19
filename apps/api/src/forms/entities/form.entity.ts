import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity';

/** One field on a form. `type` names a registered field type, so form input is
 * validated by the same field-type registry that powers content fields. */
export interface FormField {
  key: string;
  type: string;
  label: string;
  required?: boolean;
  config?: Record<string, unknown>;
}

export interface FormSettings {
  /** Message returned to the visitor on success. */
  successMessage?: string;
  /** Addresses notified on each submission. */
  notifyEmails?: string[];
  /** Persist submissions (default true). Set false for notify-only forms. */
  storeSubmissions?: boolean;
  /** Display name used as the mail "from". */
  fromName?: string;
}

/**
 * A public form definition (contact, newsletter, …). Its `fields` are a
 * data-defined schema — no code or migration to add a form or field. Submissions
 * are validated against it and land in {@link FormSubmission}.
 */
@Entity('forms')
@Index(['siteId', 'slug'], { unique: true })
export class Form extends TenantEntity {
  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  fields!: FormField[];

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  settings!: FormSettings;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;
}
