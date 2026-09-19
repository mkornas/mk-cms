import { z } from 'zod';

/**
 * Single source of truth for all environment configuration.
 * Parsed & validated once at boot — a bad/missing var fails fast with a
 * readable error instead of surfacing as an undefined deep in the app.
 */
/**
 * Parse env booleans properly. `z.coerce.boolean()` is `Boolean(value)`, which
 * makes the string "false" truthy — so we parse common truthy tokens instead.
 */
const boolFromEnv = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());
  }
  return false;
}, z.boolean());

export const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  API_PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  /** Built admin SPA to serve from `/` (same origin as `/graphql`); empty = API only. */
  ADMIN_DIR: z.string().default(''),
  /** Public base URL of the admin SPA, used to build links emailed to users
   * (e.g. the invite / set-password link). No trailing slash. */
  ADMIN_BASE_URL: z.string().default('http://localhost:4200'),

  // Postgres
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().default('mkcms'),
  DB_PASSWORD: z.string().default('mkcms'),
  DB_NAME: z.string().default('mkcms'),
  DB_SYNCHRONIZE: boolFromEnv.default(false),
  DB_LOGGING: boolFromEnv.default(false),
  DB_RUN_MIGRATIONS: boolFromEnv.default(true),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Auth (used from P1 onward)
  JWT_ACCESS_SECRET: z.string().default('change-me-access'),
  JWT_REFRESH_SECRET: z.string().default('change-me-refresh'),

  // First-run seed (only applied when the DB has no users)
  SEED_ENABLED: boolFromEnv.default(true),
  SEED_OWNER_EMAIL: z.string().email().default('owner@mk-cms.local'),
  SEED_OWNER_PASSWORD: z.string().min(6).default('changeme123'),
  SEED_OWNER_NAME: z.string().default('Owner'),
  SEED_SITE_SLUG: z.string().default('default'),
  SEED_SITE_NAME: z.string().default('Default Site'),
  /** Also import the bundled demo site (pages, posts, categories) on first boot. */
  SEED_DEMO: boolFromEnv.default(false),

  // Media / storage
  MEDIA_DRIVER: z.enum(['local', 's3']).default('local'),
  MEDIA_LOCAL_DIR: z.string().default('./storage/media'),
  /** Public base URL the API is reachable at, used to build local media URLs. */
  MEDIA_PUBLIC_URL: z.string().default('http://localhost:4000'),
  /** How many bytes to download per remote attachment during WP import. */
  MEDIA_MAX_DOWNLOAD_BYTES: z.coerce.number().int().positive().default(50_000_000),

  // S3 / MinIO (used when MEDIA_DRIVER=s3)
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('mkcms-media'),
  S3_ACCESS_KEY: z.string().default('mkcms'),
  S3_SECRET_KEY: z.string().default('mkcms-secret'),
  S3_FORCE_PATH_STYLE: boolFromEnv.default(true),
  /** Public base for object URLs; defaults to `${S3_ENDPOINT}/${S3_BUCKET}`. */
  S3_PUBLIC_URL: z.string().default(''),
}).superRefine((env, ctx) => {
  // In production, refuse to boot with the shipped placeholder JWT secrets or a
  // too-short key — otherwise tokens are trivially forgeable.
  if (env.NODE_ENV !== 'production') return;
  const insecure = (v: string, name: string): void => {
    if (v.startsWith('change-me') || v.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [name],
        message: `${name} must be set to a strong (≥32 char) secret in production.`,
      });
    }
  };
  insecure(env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET');
  insecure(env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');
  if (env.SEED_OWNER_PASSWORD === 'changeme123') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['SEED_OWNER_PASSWORD'],
      message: 'SEED_OWNER_PASSWORD must not be the default in production.',
    });
  }
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Used as the `validate` hook for @nestjs/config so the whole process refuses
 * to start with invalid configuration.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
