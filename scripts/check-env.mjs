import { config } from 'dotenv';

config({ path: new URL('../.env', import.meta.url), quiet: true });

const requiredVariables = [
  'COOKIE_SECRET',
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);
const safepayEnabled = process.env.SAFEPAY_ENABLED?.toLowerCase() === 'true';
const smtpEnabled = process.env.SMTP_ENABLED?.toLowerCase() === 'true';
if (safepayEnabled) {
  for (const name of ['SAFEPAY_PUBLIC_KEY', 'SAFEPAY_SECRET_KEY', 'SAFEPAY_WEBHOOK_SECRET']) {
    if (!process.env[name]) missingVariables.push(name);
  }
}
if (smtpEnabled) {
  for (const name of ['SMTP_HOST', 'EMAIL_FROM']) {
    if (!process.env[name]) missingVariables.push(name);
  }
  if (Boolean(process.env.SMTP_USER) !== Boolean(process.env.SMTP_PASSWORD)) {
    missingVariables.push('SMTP_USER/SMTP_PASSWORD pair');
  }
}
if (process.env.NODE_ENV === 'production' && !process.env.METRICS_TOKEN) {
  missingVariables.push('METRICS_TOKEN');
}

const returnWindowDays = Number(process.env.RETURN_WINDOW_DAYS ?? 30);
if (!Number.isInteger(returnWindowDays) || returnWindowDays < 1 || returnWindowDays > 365) {
  missingVariables.push('RETURN_WINDOW_DAYS (integer from 1 to 365)');
}

if (missingVariables.length > 0) {
  console.error(`Missing required environment variables: ${missingVariables.join(', ')}`);
  process.exitCode = 1;
} else {
  try {
    const databaseUrl = new URL(process.env.DATABASE_URL);
    if (databaseUrl.protocol !== 'mysql:' || !databaseUrl.pathname.slice(1)) {
      throw new Error('it must use mysql:// and include a database name');
    }
    if (safepayEnabled && (process.env.SAFEPAY_WEBHOOK_SECRET?.length ?? 0) < 32) {
      throw new Error('SAFEPAY_WEBHOOK_SECRET must be at least 32 characters');
    }
    console.log(
      `Environment configuration is present and DATABASE_URL is valid. Safepay is ${
        safepayEnabled ? 'enabled' : 'disabled'
      }; SMTP is ${smtpEnabled ? 'enabled' : 'disabled'}.`,
    );
  } catch (error) {
    console.error(`Invalid DATABASE_URL: ${error.message}`);
    process.exitCode = 1;
  }
}
