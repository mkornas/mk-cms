import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { FormsService, FormSubmitResult } from './forms.service';

/**
 * The public form surface — how an embedded widget (e.g. an AZ Widgets contact
 * form) reads a form's schema and posts a submission. Both endpoints are
 * `@Public`; the site is resolved from the request Host / `x-site` header.
 */
@Public()
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@UseGuards(ThrottlerGuard)
@Controller('forms')
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  /** Public schema for rendering — never exposes notify addresses. */
  @Get(':slug')
  async schema(@Param('slug') slug: string) {
    const form = await this.forms.getBySlug(slug);
    return {
      slug: form.slug,
      name: form.name,
      enabled: form.enabled,
      fields: form.fields,
      successMessage: form.settings.successMessage ?? null,
    };
  }

  @Post(':slug/submit')
  @HttpCode(200)
  submit(
    @Param('slug') slug: string,
    @Body() data: Record<string, unknown>,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('referer') referrer?: string,
  ): Promise<FormSubmitResult> {
    return this.forms.submit(slug, data, { ip, userAgent, referrer });
  }
}
