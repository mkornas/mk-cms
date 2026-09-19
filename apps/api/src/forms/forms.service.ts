import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Form, FormField, FormSettings } from './entities/form.entity';
import {
  FormSubmission,
  SubmissionMeta,
} from './entities/form-submission.entity';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { FieldTypeRegistry } from '../content/field-types/field-type.registry';
import { ContentFieldValidator } from '../content/field-types/content-field-validator';
import type { FieldDefinition } from '../content/entities/field-definition.entity';
import { HookBus } from '../hooks/hook-bus.service';
import { CoreActions } from '../hooks/hooks.constants';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEY_RE = /^[a-z][a-z0-9_]*$/;

export interface CreateFormInput {
  slug: string;
  name: string;
  fields?: FormField[];
  settings?: FormSettings;
  enabled?: boolean;
}

export interface UpdateFormInput {
  name?: string;
  fields?: FormField[];
  settings?: FormSettings;
  enabled?: boolean;
}

export interface FormSubmitResult {
  success: boolean;
  message: string;
  submissionId: string | null;
}

@Injectable()
export class FormsService {
  constructor(
    @InjectRepository(Form) private readonly forms: Repository<Form>,
    @InjectRepository(FormSubmission)
    private readonly submissions: Repository<FormSubmission>,
    private readonly tenant: TenantContextService,
    private readonly registry: FieldTypeRegistry,
    private readonly validator: ContentFieldValidator,
    private readonly hooks: HookBus,
  ) {}

  private siteId(): string {
    return this.tenant.requireSiteId();
  }

  private assertFields(fields: FormField[]): void {
    const seen = new Set<string>();
    for (const f of fields) {
      if (!KEY_RE.test(f.key)) {
        throw new BadRequestException(
          `Field key "${f.key}" must start with a letter and use only a-z, 0-9, _.`,
        );
      }
      if (seen.has(f.key)) {
        throw new BadRequestException(`Duplicate field key "${f.key}".`);
      }
      seen.add(f.key);
      if (!this.registry.has(f.type)) {
        throw new BadRequestException(`Unknown field type "${f.type}".`);
      }
    }
  }

  private toDefs(form: Form): FieldDefinition[] {
    return form.fields.map(
      (f) =>
        ({
          key: f.key,
          type: f.type,
          required: f.required ?? false,
          config: f.config ?? {},
        }) as FieldDefinition,
    );
  }

  // ── CRUD ───────────────────────────────────────────
  list(): Promise<Form[]> {
    return this.forms.find({
      where: { siteId: this.siteId() },
      order: { slug: 'ASC' },
    });
  }

  async getBySlug(slug: string): Promise<Form> {
    const form = await this.forms.findOne({
      where: { siteId: this.siteId(), slug },
    });
    if (!form) throw new NotFoundException(`Unknown form "${slug}"`);
    return form;
  }

  async create(input: CreateFormInput): Promise<Form> {
    const siteId = this.siteId();
    if (!SLUG_RE.test(input.slug)) {
      throw new BadRequestException(
        'Form slug must be lowercase words separated by hyphens.',
      );
    }
    const fields = input.fields ?? [];
    this.assertFields(fields);
    if (await this.forms.findOne({ where: { siteId, slug: input.slug } })) {
      throw new ConflictException(`A form "${input.slug}" already exists.`);
    }
    return this.forms.save(
      this.forms.create({
        siteId,
        slug: input.slug,
        name: input.name,
        fields,
        settings: input.settings ?? {},
        enabled: input.enabled ?? true,
      }),
    );
  }

  async update(slug: string, patch: UpdateFormInput): Promise<Form> {
    const form = await this.getBySlug(slug);
    if (patch.fields) this.assertFields(patch.fields);
    Object.assign(form, {
      name: patch.name ?? form.name,
      fields: patch.fields ?? form.fields,
      settings: patch.settings ?? form.settings,
      enabled: patch.enabled ?? form.enabled,
    });
    return this.forms.save(form);
  }

  async delete(slug: string): Promise<void> {
    const form = await this.getBySlug(slug);
    await this.submissions.delete({ formId: form.id });
    await this.forms.remove(form);
  }

  // ── public submission ──────────────────────────────
  async submit(
    slug: string,
    data: Record<string, unknown>,
    meta: SubmissionMeta = {},
  ): Promise<FormSubmitResult> {
    const form = await this.getBySlug(slug);
    if (!form.enabled) {
      throw new ForbiddenException(`Form "${slug}" is not accepting submissions.`);
    }
    const validated = this.validator.validate(this.toDefs(form), data ?? {});

    let submission: FormSubmission | null = null;
    if (form.settings.storeSubmissions !== false) {
      submission = await this.submissions.save(
        this.submissions.create({
          siteId: form.siteId,
          formId: form.id,
          data: validated,
          meta,
        }),
      );
    }

    await this.hooks.doAction(CoreActions.FormSubmitted, {
      form,
      submission,
      data: validated,
    });

    return {
      success: true,
      message: form.settings.successMessage ?? 'Thank you for your submission.',
      submissionId: submission?.id ?? null,
    };
  }

  // ── submissions (admin) ────────────────────────────
  async listSubmissions(
    slug: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<FormSubmission[]> {
    const form = await this.getBySlug(slug);
    return this.submissions.find({
      where: { siteId: this.siteId(), formId: form.id },
      order: { createdAt: 'DESC' },
      take: Math.min(opts.limit ?? 50, 200),
      skip: opts.offset ?? 0,
    });
  }

  async deleteSubmission(id: string): Promise<void> {
    const submission = await this.submissions.findOne({
      where: { id, siteId: this.siteId() },
    });
    if (!submission) throw new NotFoundException('Submission not found.');
    await this.submissions.remove(submission);
  }
}
