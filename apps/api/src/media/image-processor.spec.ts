import sharp from 'sharp';
import { ImageProcessor } from './image-processor';

const png = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#123456' } })
    .png()
    .toBuffer();

describe('ImageProcessor', () => {
  const proc = new ImageProcessor();

  it('classifies raster images (svg excluded)', () => {
    expect(proc.isRasterImage('image/png')).toBe(true);
    expect(proc.isRasterImage('image/jpeg')).toBe(true);
    expect(proc.isRasterImage('image/svg+xml')).toBe(false);
    expect(proc.isRasterImage('application/pdf')).toBe(false);
  });

  it('probes intrinsic dimensions', async () => {
    expect(await proc.probe(await png(640, 480))).toEqual({
      width: 640,
      height: 480,
    });
    expect(await proc.probe(Buffer.from('not an image'))).toBeNull();
  });

  it('renders downscaled widths + a full-size WebP', async () => {
    const variants = await proc.renderVariants(await png(800, 600), 800);
    // 320/640 downscaled, 800 = full-size compressed copy; 1024/1600 skipped
    expect(variants.map((v) => v.key)).toEqual(['w320', 'w640', 'w800']);
    for (const v of variants) {
      expect(v.format).toBe('webp');
      expect(v.width).toBeLessThanOrEqual(800);
      expect(v.size).toBeGreaterThan(0);
      expect((await sharp(v.buffer).metadata()).format).toBe('webp');
    }
  });

  it('still produces a full-size WebP for a small original', async () => {
    const variants = await proc.renderVariants(await png(200, 150), 200);
    expect(variants.map((v) => v.key)).toEqual(['w200']);
  });
});
