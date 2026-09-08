import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../errors/app-error.js';
import { resolveAuthentication } from './authenticate.js';

const guestTokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const guestLifetimeMs = 30 * 24 * 60 * 60 * 1_000;
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

const resolveGuestUserId = async (token: string) => {
  const hash = tokenHash(token);
  const existing = await prisma.guestSession.findUnique({
    include: { user: { select: { id: true, status: true } } },
    where: { tokenHash: hash },
  });
  if (existing) {
    if (existing.user.status !== 'ACTIVE') {
      throw new AppError(403, 'SHOPPER_DISABLED', 'This shopping session is unavailable.');
    }
    if (existing.expiresAt <= new Date()) {
      await prisma.guestSession.update({
        data: { expiresAt: new Date(Date.now() + guestLifetimeMs) },
        where: { id: existing.id },
      });
    }
    return existing.user.id;
  }

  try {
    const user = await prisma.user.create({
      data: {
        email: `guest+${token.replaceAll('-', '')}@veyora.local`,
        firstName: 'Guest',
        guestSession: {
          create: { expiresAt: new Date(Date.now() + guestLifetimeMs), tokenHash: hash },
        },
        isGuest: true,
        lastName: 'Shopper',
        passwordHash: hash,
      },
      select: { id: true },
    });
    return user.id;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
      throw error;
    }
    const raced = await prisma.guestSession.findUnique({ where: { tokenHash: hash } });
    if (!raced) throw error;
    return raced.userId;
  }
};

export const resolveShopper: RequestHandler = async (request, _response, next) => {
  const auth = await resolveAuthentication(request);
  if (auth) {
    request.auth = auth;
    request.shopper = { isGuest: false, userId: auth.userId };
    next();
    return;
  }

  const token = request.header('x-guest-token')?.trim() ?? '';
  if (!guestTokenPattern.test(token)) {
    throw new AppError(
      401,
      'SHOPPER_IDENTITY_REQUIRED',
      'A valid guest shopping session is required.',
    );
  }
  request.shopper = { isGuest: true, userId: await resolveGuestUserId(token) };
  next();
};
