import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

/** Responsive widths generated for images (only those below the original). */
const VARIANT_WIDTHS = [320, 640, 1024, 1600];

export interface RenderedVariant {
  key: string; // "w640"
  width: number;
  height: number;
  format: string;
  buffer: Buffer;
  size: number;
}

/**
 * Image processing via sharp: probes intrinsic dimensions and renders
 * responsive WebP variants. Runs inline on upload so renditions are ready
 * immediately; the same methods could instead be driven from a BullMQ job for
 * heavy workloads. SVGs and non-images are passed through untouched.
 */
@Injectable()
export class ImageProcessor {
  private readonly logger = new Logger(ImageProcessor.name);

  isRasterImage(mime: string): boolean {
    return mime.startsWith('image/') && mime !== 'image/svg+xml';
  }

  async probe(buffer: Buffer): Promise<{ width: number; height: number } | null> {
    try {
      const meta = await sharp(buffer).metadata();
      return meta.width && meta.height
        ? { width: meta.width, height: meta.height }
        : null;
    } catch (err) {
      this.logger.warn(`Could not read image metadata: ${(err as Error).message}`);
      return null;
    }
  }

  async renderVariants(
    buffer: Buffer,
    originalWidth: number,
  ): Promise<RenderedVariant[]> {
    // Downscaled widths + a full-size rendition. The full-size WebP is the
    // "upload compression": a much smaller delivery copy of the original at its
    // native resolution (the untouched original is still kept as the source).
    const widths = [
      ...new Set([
        ...VARIANT_WIDTHS.filter((w) => w < originalWidth),
        originalWidth,
      ]),
    ].sort((a, b) => a - b);
    const variants: RenderedVariant[] = [];
    for (const width of widths) {
      const { data, info } = await sharp(buffer)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });
      variants.push({
        key: `w${width}`,
        width: info.width,
        height: info.height,
        format: 'webp',
        buffer: data,
        size: data.length,
      });
    }
    return variants;
  }
}
