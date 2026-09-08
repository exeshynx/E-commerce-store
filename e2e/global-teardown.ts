import type { FullConfig } from '@playwright/test';
import { cleanEndToEndData, disconnectEndToEndDatabase } from './support/database.js';

export default async function globalTeardown(_config: FullConfig) {
  try {
    await cleanEndToEndData();
  } finally {
    await disconnectEndToEndDatabase();
  }
}
