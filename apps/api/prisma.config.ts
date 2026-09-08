import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

config({ path: new URL('../../.env', import.meta.url), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/scripts/seed-database.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
