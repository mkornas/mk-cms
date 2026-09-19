import {
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { RequireCapability } from '../rbac/require-capability.decorator';
import { Capabilities } from '../rbac/capabilities';
import { MediaService } from './media.service';
import { STORAGE_ADAPTER, StorageAdapter } from './storage/storage.adapter';

// Note: no `svg` mapping — SVG is script-capable, so any legacy SVG is served
// as a generic download rather than an inline, executable document.
const MIME_BY_EXT: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  pdf: 'application/pdf',
};

function contentType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

/**
 * Media upload (authenticated, `media:upload`) and public file serving. Serving
 * is `@Public` and keyed by the storage path (site/id/name) so files behave
 * like any CDN object; uploads run the image pipeline and persist a record.
 */
@Controller('media')
export class MediaController {
  constructor(
    private readonly media: MediaService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  @Post()
  @RequireCapability(Capabilities.Media.Upload)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.media.upload(file);
  }

  @Public()
  @Get('file/:site/:id/:name')
  async serve(
    @Param('site') site: string,
    @Param('id') id: string,
    @Param('name') name: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.storage.get(`${site}/${id}/${name}`);
    const type = contentType(name);
    res.set('Content-Type', type);
    // Never let the browser sniff a different (executable) type; serve unknown
    // types as a download rather than inline.
    res.set('X-Content-Type-Options', 'nosniff');
    res.set(
      'Content-Disposition',
      type === 'application/octet-stream' ? 'attachment' : 'inline',
    );
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    // Helmet defaults every response to `Cross-Origin-Resource-Policy:
    // same-origin`, which makes browsers refuse to *embed* these files from any
    // other origin — the admin SPA on its own port, and every tenant website on
    // its own domain. Public media exists to be embedded; relax CORP here only.
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(buffer);
  }
}
