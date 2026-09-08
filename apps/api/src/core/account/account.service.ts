import { OrderStatus, Prisma, ReturnStatus, SupportTicketStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../http/errors/app-error.js';
import { passwordService } from '../auth/password.service.js';
import type {
  AddressCreateInput,
  AddressUpdateInput,
  ChangePasswordInput,
  ProfileUpdateInput,
} from './account.schemas.js';

const addressSelect = {
  address: true,
  city: true,
  country: true,
  createdAt: true,
  email: true,
  fullName: true,
  id: true,
  isDefaultBilling: true,
  isDefaultShipping: true,
  label: true,
  phone: true,
  postalCode: true,
  province: true,
  updatedAt: true,
} satisfies Prisma.AddressSelect;

type DatabaseAddress = Prisma.AddressGetPayload<{ select: typeof addressSelect }>;

export const serializeAddress = (address: DatabaseAddress) => ({
  ...address,
  createdAt: address.createdAt.toISOString(),
  updatedAt: address.updatedAt.toISOString(),
});

const requireAddress = async (
  transaction: Prisma.TransactionClient,
  userId: string,
  id: string,
) => {
  const address = await transaction.address.findFirst({
    select: addressSelect,
    where: { id, userId },
  });
  if (!address) throw new AppError(404, 'ADDRESS_NOT_FOUND', 'The address does not exist.');
  return address;
};

const clearDefaults = async (
  transaction: Prisma.TransactionClient,
  userId: string,
  input: {
    isDefaultBilling?: boolean | undefined;
    isDefaultShipping?: boolean | undefined;
  },
  excludeId?: string,
) => {
  if (input.isDefaultShipping) {
    await transaction.address.updateMany({
      data: { isDefaultShipping: false },
      where: { ...(excludeId ? { id: { not: excludeId } } : {}), userId },
    });
  }
  if (input.isDefaultBilling) {
    await transaction.address.updateMany({
      data: { isDefaultBilling: false },
      where: { ...(excludeId ? { id: { not: excludeId } } : {}), userId },
    });
  }
};

const profileSelect = {
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

const serializeProfile = (profile: Prisma.UserGetPayload<{ select: typeof profileSelect }>) => ({
  ...profile,
  createdAt: profile.createdAt.toISOString(),
  updatedAt: profile.updatedAt.toISOString(),
});

export const accountService = {
  listAddresses: async (userId: string) => {
    const addresses = await prisma.address.findMany({
      orderBy: [{ isDefaultShipping: 'desc' }, { isDefaultBilling: 'desc' }, { createdAt: 'asc' }],
      select: addressSelect,
      where: { userId },
    });
    return addresses.map(serializeAddress);
  },

  getOwnedAddressInput: async (userId: string, id: string) => {
    const address = await prisma.address.findFirst({
      select: addressSelect,
      where: { id, userId },
    });
    if (!address) throw new AppError(404, 'ADDRESS_NOT_FOUND', 'The address does not exist.');
    return {
      address: address.address,
      city: address.city,
      country: address.country,
      email: address.email,
      fullName: address.fullName,
      phone: address.phone,
      postalCode: address.postalCode,
      province: address.province,
    };
  },

  createAddress: async (userId: string, input: AddressCreateInput) => {
    const address = await prisma.$transaction(
      async (transaction) => {
        const count = await transaction.address.count({ where: { userId } });
        const data = {
          ...input,
          isDefaultBilling: count === 0 || input.isDefaultBilling,
          isDefaultShipping: count === 0 || input.isDefaultShipping,
          userId,
        };
        await clearDefaults(transaction, userId, data);
        return transaction.address.create({ data, select: addressSelect });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return serializeAddress(address);
  },

  updateAddress: async (userId: string, id: string, input: AddressUpdateInput) => {
    const address = await prisma.$transaction(
      async (transaction) => {
        await requireAddress(transaction, userId, id);
        await clearDefaults(transaction, userId, input, id);
        const data: Prisma.AddressUpdateInput = {
          ...(input.address !== undefined ? { address: input.address } : {}),
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.country !== undefined ? { country: input.country } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
          ...(input.isDefaultBilling !== undefined
            ? { isDefaultBilling: input.isDefaultBilling }
            : {}),
          ...(input.isDefaultShipping !== undefined
            ? { isDefaultShipping: input.isDefaultShipping }
            : {}),
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
          ...(input.province !== undefined ? { province: input.province } : {}),
        };
        return transaction.address.update({ data, select: addressSelect, where: { id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return serializeAddress(address);
  },

  deleteAddress: async (userId: string, id: string) => {
    await prisma.$transaction(async (transaction) => {
      const address = await requireAddress(transaction, userId, id);
      await transaction.address.delete({ where: { id } });
      if (address.isDefaultShipping || address.isDefaultBilling) {
        const next = await transaction.address.findFirst({
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { id: true },
          where: { userId },
        });
        if (next) {
          await transaction.address.update({
            data: {
              ...(address.isDefaultBilling ? { isDefaultBilling: true } : {}),
              ...(address.isDefaultShipping ? { isDefaultShipping: true } : {}),
            },
            where: { id: next.id },
          });
        }
      }
    });
  },

  getAccountSummary: async (userId: string) => {
    const [
      profile,
      orderStats,
      wishlistItems,
      returns,
      openReturns,
      tickets,
      openTickets,
      addresses,
    ] = await prisma.$transaction([
      prisma.user.findUnique({ select: profileSelect, where: { id: userId } }),
      prisma.order.aggregate({
        _count: { _all: true },
        _sum: { total: true },
        where: { status: OrderStatus.DELIVERED, userId },
      }),
      prisma.wishlistItem.count({ where: { wishlist: { userId } } }),
      prisma.returnRequest.count({ where: { userId } }),
      prisma.returnRequest.count({
        where: { status: { notIn: [ReturnStatus.CLOSED, ReturnStatus.REJECTED] }, userId },
      }),
      prisma.supportTicket.count({ where: { userId } }),
      prisma.supportTicket.count({
        where: {
          userId,
          status: { notIn: [SupportTicketStatus.CLOSED, SupportTicketStatus.RESOLVED] },
        },
      }),
      prisma.address.count({ where: { userId } }),
    ]);
    if (!profile) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'The account does not exist.');
    return {
      profile: serializeProfile(profile),
      stats: {
        addressCount: addresses,
        deliveredOrderCount: orderStats._count._all,
        deliveredOrderSpend: orderStats._sum.total?.toFixed(2) ?? '0.00',
        openReturnCount: openReturns,
        openSupportTicketCount: openTickets,
        returnCount: returns,
        supportTicketCount: tickets,
        wishlistItemCount: wishlistItems,
      },
    };
  },

  updateProfile: async (userId: string, input: ProfileUpdateInput) => {
    const data: Prisma.UserUpdateInput = {
      ...(input.avatarAltText !== undefined ? { avatarAltText: input.avatarAltText } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
    };
    const profile = await prisma.user.update({
      data,
      select: profileSelect,
      where: { id: userId },
    });
    return serializeProfile(profile);
  },

  changePassword: async (userId: string, input: ChangePasswordInput) => {
    const user = await prisma.user.findUnique({
      select: { passwordHash: true },
      where: { id: userId },
    });
    if (!user || !(await passwordService.verify(input.currentPassword, user.passwordHash))) {
      throw new AppError(422, 'CURRENT_PASSWORD_INVALID', 'The current password is incorrect.');
    }
    const passwordHash = await passwordService.hash(input.newPassword);
    await prisma.$transaction([
      prisma.user.update({ data: { passwordHash }, where: { id: userId } }),
      prisma.authSession.updateMany({ data: { revokedAt: new Date() }, where: { userId } }),
    ]);
  },
};
