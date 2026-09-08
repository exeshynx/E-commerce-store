import { config } from 'dotenv';
import { z } from 'zod';

const rootEnvironmentPath = new URL('../../../../.env', import.meta.url);
config({ path: rootEnvironmentPath, quiet: true });

const durationSchema = z.custom<`${number}${'s' | 'm' | 'h' | 'd'}`>(
  (value) => typeof value === 'string' && /^\d+[smhd]$/.test(value),
  'Must be a duration such as 15m or 7d',
);

const optionalEnvironmentValue = (schema: z.ZodString) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const booleanEnvironmentValue = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return value;
}, z.boolean());

const environmentSchema = z
  .object({
    API_HOST: z.string().default('0.0.0.0'),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    API_RATE_LIMIT_MAX: z.coerce.number().int().min(10).max(10_000).default(240),
    APP_VERSION: z.string().trim().min(1).max(64).default('0.1.0'),
    AUTH_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(3).max(100).default(10),
    AUTH_REGISTER_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100).default(5),
    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    COOKIE_SECRET: z.string().min(32),
    DATABASE_URL: z.url().refine((value) => value.startsWith('mysql://'), {
      message: 'DATABASE_URL must use the mysql:// protocol',
    }),
    DEPLOYMENT_ENVIRONMENT: z.string().trim().min(1).max(64).default('local'),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: durationSchema.default('15m'),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_REFRESH_TTL: durationSchema.default('7d'),
    EMAIL_FROM: optionalEnvironmentValue(z.string().trim().min(3).max(254)),
    METRICS_TOKEN: optionalEnvironmentValue(z.string().min(32)),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    RECONCILIATION_MIN_AGE_MINUTES: z.coerce.number().int().min(1).max(1_440).default(5),
    RETURN_WINDOW_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    RELEASE_SHA: z.string().trim().min(1).max(128).default('local'),
    SAFEPAY_ENABLED: booleanEnvironmentValue.default(false),
    SAFEPAY_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
    SAFEPAY_PUBLIC_KEY: optionalEnvironmentValue(z.string().trim().min(8)),
    SAFEPAY_SECRET_KEY: optionalEnvironmentValue(z.string().trim().min(8)),
    SAFEPAY_WEBHOOK_SECRET: optionalEnvironmentValue(z.string().trim().min(32)),
    SESSION_RETENTION_DAYS: z.coerce.number().int().min(7).max(365).default(30),
    SMTP_ENABLED: booleanEnvironmentValue.default(false),
    SMTP_HOST: optionalEnvironmentValue(z.string().trim().min(1)),
    SMTP_PASSWORD: optionalEnvironmentValue(z.string().min(1)),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    SMTP_SECURE: booleanEnvironmentValue.default(false),
    SMTP_USER: optionalEnvironmentValue(z.string().trim().min(1)),
    SLOW_QUERY_THRESHOLD_MS: z.coerce.number().int().min(10).max(60_000).default(250),
    WEB_URL: z.url().default('http://localhost:5173'),
    WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(10),
    WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(250).max(60_000).default(5_000),
  })
  .superRefine((value, context) => {
    if (value.SAFEPAY_ENABLED) {
      for (const name of [
        'SAFEPAY_PUBLIC_KEY',
        'SAFEPAY_SECRET_KEY',
        'SAFEPAY_WEBHOOK_SECRET',
      ] as const) {
        if (!value[name]) {
          context.addIssue({
            code: 'custom',
            message: `${name} is required when SAFEPAY_ENABLED=true`,
            path: [name],
          });
        }
      }
    }
    if (value.SMTP_ENABLED) {
      for (const name of ['SMTP_HOST', 'EMAIL_FROM'] as const) {
        if (!value[name]) {
          context.addIssue({
            code: 'custom',
            message: `${name} is required when SMTP_ENABLED=true`,
            path: [name],
          });
        }
      }
      if (Boolean(value.SMTP_USER) !== Boolean(value.SMTP_PASSWORD)) {
        context.addIssue({
          code: 'custom',
          message: 'SMTP_USER and SMTP_PASSWORD must be configured together',
          path: ['SMTP_USER'],
        });
      }
    }
    if (value.NODE_ENV === 'production' && !value.METRICS_TOKEN) {
      context.addIssue({
        code: 'custom',
        message: 'METRICS_TOKEN is required in production',
        path: ['METRICS_TOKEN'],
      });
    }
  });

const parsedEnvironment = environmentSchema.safeParse({
  ...process.env,
  API_PORT: process.env.API_PORT || process.env.PORT,
});

if (!parsedEnvironment.success) {
  const issues = parsedEnvironment.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = Object.freeze(parsedEnvironment.data);
export type Environment = typeof env;
