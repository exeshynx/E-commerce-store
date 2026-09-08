import { execSync } from 'node:child_process';
import type { FullConfig } from '@playwright/test';
import { disconnectEndToEndDatabase, prepareEndToEndData } from './support/database.js';

export default async function globalSetup(_config: FullConfig) {
  execSync('npm run db:migrate:deploy', { stdio: 'inherit' });
  execSync('npm run db:seed', { stdio: 'inherit' });
  try {
    await prepareEndToEndData();
  } finally {
    await disconnectEndToEndDatabase();
  }
}
