import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity';

/** Request metadata captured with a submission (for spam triage / context). */
export interface SubmissionMeta {
  ip?: string;
  userAgent?: string;
  referrer?: string;
}

/** A single validated form submission. */
@Entity('form_submissions')
@Index(['siteId', 'formId', 'createdAt'])
export class FormSubmission extends TenantEntity {
  @Index()
  @Column({ type: 'uuid' })
  formId!: string;

  /** Validated field values, keyed by form-field key. */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  data!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  meta!: SubmissionMeta;
}
