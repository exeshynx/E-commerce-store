import { z } from 'zod';
import { passwordSchema } from '../core/auth/auth.schemas.js';
import { passwordService } from '../core/auth/password.service.js';
import { prisma } from '../infrastructure/database/prisma.js';

const configurationSchema = z.object({
  ADMIN_EMAIL: z.email().transform((email) => email.trim().toLowerCase()),
  ADMIN_FIRST_NAME: z.string().trim().min(1).max(80),
  ADMIN_LAST_NAME: z.string().trim().min(1).max(80),
  ADMIN_PASSWORD: passwordSchema,
});

const requiredVariables = [
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'ADMIN_FIRST_NAME',
  'ADMIN_LAST_NAME',
] as const;

export const hasCompleteAdminBootstrapConfiguration = () =>
  requiredVariables.every((name) => Boolean(process.env[name]?.trim()));

export const bootstrapConfiguredAdmin = async () => {
  const configuration = configurationSchema.parse(process.env);
  const existing = await prisma.user.findUnique({
    where: { email: configuration.ADMIN_EMAIL },
    select: { email: true, role: true, status: true },
  });

  if (existing) {
    if (existing.role !== 'ADMIN') {
      await prisma.user.update({
        data: { role: 'ADMIN' },
        where: { email: existing.email },
      });
      console.info(`Promoted ${existing.email} to ADMIN.`);
    } else {
      console.info(`${existing.email} is already an ADMIN; no changes made.`);
    }
    if (existing.status !== 'ACTIVE') {
      console.warn('The account remains disabled. Re-enable it through an audited admin workflow.');
    }
    return;
  }

  await prisma.user.create({
    data: {
      email: configuration.ADMIN_EMAIL,
      firstName: configuration.ADMIN_FIRST_NAME,
      lastName: configuration.ADMIN_LAST_NAME,
      passwordHash: await passwordService.hash(configuration.ADMIN_PASSWORD),
      role: 'ADMIN',
    },
  });
  console.info(`Created administrator ${configuration.ADMIN_EMAIL}.`);
};
