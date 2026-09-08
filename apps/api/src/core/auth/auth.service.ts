import { createHash, randomUUID } from 'node:crypto';
import { AdminAuditAction, AdminAuditEntityType, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../http/errors/app-error.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import { passwordService } from './password.service.js';
import { tokenService, type AuthTokenClaims } from './token.service.js';
import { recordAdminAudit } from '../audit/audit.service.js';

const publicUserSelect = {
  avatarAltText: true,
  avatarUrl: true,
  createdAt: true,
  email: true,
  firstName: true,
  id: true,
  lastName: true,
  phone: true,
  role: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type DatabaseUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export type PublicUser = Omit<DatabaseUser, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

const serializeUser = (user: DatabaseUser): PublicUser => ({
  avatarAltText: user.avatarAltText,
  avatarUrl: user.avatarUrl,
  createdAt: user.createdAt.toISOString(),
  email: user.email,
  firstName: user.firstName,
  id: user.id,
  lastName: user.lastName,
  phone: user.phone,
  role: user.role,
  updatedAt: user.updatedAt.toISOString(),
});

const hashRefreshToken = (token: string) => createHash('sha256').update(token).digest('hex');

const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'The email or password is incorrect.');

const invalidSession = () =>
  new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh session is invalid or has expired.');

const emailAlreadyRegistered = () =>
  new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'An account already uses this email.');

type LoginAuditContext = { ipAddress?: string; requestId: string };

const createSession = async (user: DatabaseUser, loginAudit?: LoginAuditContext) => {
  const sessionId = randomUUID();
  const claims: AuthTokenClaims = {
    role: user.role,
    sessionId,
    subject: user.id,
  };
  const accessToken = tokenService.createAccessToken(claims);
  const refresh = tokenService.createRefreshToken(claims);

  await prisma.$transaction(async (transaction) => {
    await transaction.authSession.create({
      data: {
        expiresAt: refresh.expiresAt,
        id: sessionId,
        refreshTokenHash: hashRefreshToken(refresh.token),
        userId: user.id,
      },
    });
    if (user.role === 'ADMIN' && loginAudit) {
      await recordAdminAudit(
        transaction,
        { administratorId: user.id, requestId: loginAudit.requestId },
        {
          action: AdminAuditAction.ADMIN_LOGIN,
          entityId: user.id,
          entityType: AdminAuditEntityType.USER,
          ...(loginAudit.ipAddress ? { metadata: { ipAddress: loginAudit.ipAddress } } : {}),
        },
      );
    }
  });

  return {
    accessToken,
    refreshToken: refresh.token,
    refreshTokenExpiresAt: refresh.expiresAt,
    user: serializeUser(user),
  };
};

export const authService = {
  register: async (input: RegisterInput) => {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existingUser) {
      throw emailAlreadyRegistered();
    }

    const passwordHash = await passwordService.hash(input.password);

    try {
      const user = await prisma.user.create({
        data: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          passwordHash,
        },
        select: publicUserSelect,
      });

      return createSession(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw emailAlreadyRegistered();
      }
      throw error;
    }
  },

  login: async (input: LoginInput, audit?: LoginAuditContext) => {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        ...publicUserSelect,
        passwordHash: true,
        status: true,
      },
    });

    if (!user || !(await passwordService.verify(input.password, user.passwordHash))) {
      throw invalidCredentials();
    }
    if (user.status !== 'ACTIVE') {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled.');
    }

    return createSession(user, audit);
  },

  refresh: async (refreshToken: string) => {
    let claims: AuthTokenClaims;
    try {
      claims = tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw invalidSession();
    }

    const session = await prisma.authSession.findUnique({
      where: { id: claims.sessionId },
      include: {
        user: {
          select: {
            ...publicUserSelect,
            status: true,
          },
        },
      },
    });

    const providedHash = hashRefreshToken(refreshToken);
    if (
      !session ||
      session.userId !== claims.subject ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== 'ACTIVE' ||
      session.refreshTokenHash !== providedHash
    ) {
      if (session && !session.revokedAt) {
        await prisma.authSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
      }
      throw invalidSession();
    }

    const nextClaims: AuthTokenClaims = {
      role: session.user.role,
      sessionId: session.id,
      subject: session.user.id,
    };
    const accessToken = tokenService.createAccessToken(nextClaims);
    const nextRefresh = tokenService.createRefreshToken(nextClaims);
    const rotated = await prisma.authSession.updateMany({
      where: {
        id: session.id,
        refreshTokenHash: providedHash,
        revokedAt: null,
      },
      data: {
        expiresAt: nextRefresh.expiresAt,
        refreshTokenHash: hashRefreshToken(nextRefresh.token),
      },
    });

    if (rotated.count !== 1) {
      throw invalidSession();
    }

    return {
      accessToken,
      refreshToken: nextRefresh.token,
      refreshTokenExpiresAt: nextRefresh.expiresAt,
      user: serializeUser(session.user),
    };
  },

  logout: async (refreshToken: string | undefined) => {
    if (!refreshToken) return;

    try {
      const claims = tokenService.verifyRefreshToken(refreshToken);
      await prisma.authSession.updateMany({
        where: {
          id: claims.sessionId,
          userId: claims.subject,
        },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Logout is intentionally idempotent, including for expired or malformed cookies.
    }
  },

  getUser: async (userId: string) => {
    const user = await prisma.user.findFirst({
      where: { id: userId, status: 'ACTIVE' },
      select: publicUserSelect,
    });

    if (!user) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
    }

    return serializeUser(user);
  },
};
