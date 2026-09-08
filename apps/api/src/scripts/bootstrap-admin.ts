import { prisma } from '../infrastructure/database/prisma.js';
import { bootstrapConfiguredAdmin } from './admin-bootstrap.js';

bootstrapConfiguredAdmin()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
