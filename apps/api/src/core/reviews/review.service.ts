import { AdminAuditAction, AdminAuditEntityType, OrderStatus, ReviewStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../http/errors/app-error.js';
import { recordAdminAudit, type AdminAuditContext } from '../audit/audit.service.js';
import type {
  AdminReviewListQuery,
  AdminReviewUpdateInput,
  ReviewCreateInput,
  ReviewListQuery,
  ReviewUpdateInput,
} from './review.schemas.js';

const reviewSelect = {
  body: true,
  createdAt: true,
  deletedAt: true,
  id: true,
  moderatedAt: true,
  moderationNote: true,
  product: { select: { id: true, name: true, slug: true } },
  productId: true,
  rating: true,
  status: true,
  title: true,
  updatedAt: true,
  user: { select: { firstName: true, id: true, lastName: true } },
  userId: true,
} satisfies Prisma.ReviewSelect;

type DatabaseReview = Prisma.ReviewGetPayload<{ select: typeof reviewSelect }>;

const serializeReview = (review: DatabaseReview) => ({
  body: review.body,
  createdAt: review.createdAt.toISOString(),
  deletedAt: review.deletedAt?.toISOString() ?? null,
  id: review.id,
  moderatedAt: review.moderatedAt?.toISOString() ?? null,
  moderationNote: review.moderationNote,
  product: review.product,
  productId: review.productId,
  rating: review.rating,
  status: review.status,
  title: review.title,
  updatedAt: review.updatedAt.toISOString(),
  user: review.user,
  userId: review.userId,
  verifiedPurchase: true,
});

const requireProduct = async (productId: string) => {
  const product = await prisma.product.findUnique({
    select: { id: true },
    where: { id: productId },
  });
  if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'The product does not exist.');
};

const requireVerifiedPurchase = async (userId: string, productId: string) => {
  const purchase = await prisma.orderItem.findFirst({
    select: { id: true },
    where: { order: { status: OrderStatus.DELIVERED, userId }, productId },
  });
  if (!purchase) {
    throw new AppError(
      403,
      'REVIEW_VERIFIED_PURCHASE_REQUIRED',
      'Only customers with a delivered purchase may review this product.',
    );
  }
};

const reviewOrderBy = (sort: ReviewListQuery['sort']): Prisma.ReviewOrderByWithRelationInput[] => {
  if (sort === 'highest') return [{ rating: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }];
  if (sort === 'lowest') return [{ rating: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }];
  return [{ createdAt: 'desc' }, { id: 'desc' }];
};

export const reviewService = {
  listProductReviews: async (productId: string, query: ReviewListQuery, viewerId?: string) => {
    await requireProduct(productId);
    const where = {
      deletedAt: null,
      productId,
      status: ReviewStatus.APPROVED,
    } satisfies Prisma.ReviewWhereInput;
    const skip = (query.page - 1) * query.pageSize;
    const [totalItems, reviews, aggregate, groups, viewerReview] = await prisma.$transaction([
      prisma.review.count({ where }),
      prisma.review.findMany({
        orderBy: reviewOrderBy(query.sort),
        select: reviewSelect,
        skip,
        take: query.pageSize,
        where,
      }),
      prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true }, where }),
      prisma.review.groupBy({ _count: { _all: true }, by: ['rating'], where }),
      viewerId
        ? prisma.review.findUnique({
            select: reviewSelect,
            where: { userId_productId: { productId, userId: viewerId } },
          })
        : prisma.review.findFirst({ select: reviewSelect, where: { id: '__anonymous__' } }),
    ]);
    const distribution = Object.fromEntries(
      [1, 2, 3, 4, 5].map((rating) => [
        rating,
        groups.find((group) => group.rating === rating)?._count._all ?? 0,
      ]),
    );
    return {
      items: reviews.map(serializeReview),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
      summary: {
        averageRating: Number(aggregate._avg.rating ?? 0).toFixed(2),
        distribution,
        totalReviews: aggregate._count._all,
      },
      viewerReview: viewerReview ? serializeReview(viewerReview) : null,
    };
  },

  createReview: async (userId: string, productId: string, input: ReviewCreateInput) => {
    await Promise.all([requireProduct(productId), requireVerifiedPurchase(userId, productId)]);
    const existing = await prisma.review.findUnique({
      select: { deletedAt: true, id: true },
      where: { userId_productId: { productId, userId } },
    });
    if (existing && !existing.deletedAt) {
      throw new AppError(409, 'REVIEW_ALREADY_EXISTS', 'You have already reviewed this product.');
    }
    const data = {
      body: input.body,
      deletedAt: null,
      moderatedAt: null,
      moderatedById: null,
      moderationNote: null,
      rating: input.rating,
      status: ReviewStatus.PENDING,
      title: input.title ?? null,
    };
    let review: DatabaseReview;
    if (existing) {
      review = await prisma.review.update({
        data,
        select: reviewSelect,
        where: { id: existing.id },
      });
    } else {
      review = await prisma.review.create({
        data: { ...data, productId, userId },
        select: reviewSelect,
      });
    }
    return serializeReview(review);
  },

  updateReview: async (userId: string, id: string, input: ReviewUpdateInput) => {
    const existing = await prisma.review.findFirst({
      select: { id: true },
      where: { deletedAt: null, id, userId },
    });
    if (!existing) throw new AppError(404, 'REVIEW_NOT_FOUND', 'The review does not exist.');
    const review = await prisma.review.update({
      data: {
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        moderatedAt: null,
        moderatedById: null,
        moderationNote: null,
        status: ReviewStatus.PENDING,
      },
      select: reviewSelect,
      where: { id },
    });
    return serializeReview(review);
  },

  deleteReview: async (userId: string, id: string) => {
    const updated = await prisma.review.updateMany({
      data: { deletedAt: new Date() },
      where: { deletedAt: null, id, userId },
    });
    if (updated.count !== 1) {
      throw new AppError(404, 'REVIEW_NOT_FOUND', 'The review does not exist.');
    }
  },

  listAdminReviews: async (query: AdminReviewListQuery) => {
    const where: Prisma.ReviewWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.visibility === 'visible'
        ? { deletedAt: null }
        : query.visibility === 'deleted'
          ? { deletedAt: { not: null } }
          : {}),
      ...(query.q
        ? {
            OR: [
              { body: { contains: query.q } },
              { title: { contains: query.q } },
              { product: { name: { contains: query.q } } },
              { user: { email: { contains: query.q } } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [totalItems, reviews] = await prisma.$transaction([
      prisma.review.count({ where }),
      prisma.review.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          ...reviewSelect,
          user: { select: { email: true, firstName: true, id: true, lastName: true } },
        },
        skip,
        take: query.pageSize,
        where,
      }),
    ]);
    return {
      items: reviews.map(serializeReview),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  },

  moderateReview: async (
    administratorId: string,
    requestId: string,
    id: string,
    input: AdminReviewUpdateInput,
  ) => {
    const review = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.review.findUnique({
        select: { deletedAt: true, id: true, productId: true, status: true },
        where: { id },
      });
      if (!existing) throw new AppError(404, 'REVIEW_NOT_FOUND', 'The review does not exist.');
      if ((input.action === 'approve' || input.action === 'reject') && existing.deletedAt) {
        throw new AppError(409, 'REVIEW_DELETED', 'Restore the review before moderating it.');
      }
      const now = new Date();
      const actionMap = {
        approve: AdminAuditAction.REVIEW_APPROVED,
        delete: AdminAuditAction.REVIEW_DELETED,
        reject: AdminAuditAction.REVIEW_REJECTED,
        restore: AdminAuditAction.REVIEW_RESTORED,
      } as const;
      const data: Prisma.ReviewUpdateInput =
        input.action === 'approve'
          ? {
              moderatedAt: now,
              moderatedBy: { connect: { id: administratorId } },
              moderationNote: input.note ?? null,
              status: ReviewStatus.APPROVED,
            }
          : input.action === 'reject'
            ? {
                moderatedAt: now,
                moderatedBy: { connect: { id: administratorId } },
                moderationNote: input.note,
                status: ReviewStatus.REJECTED,
              }
            : input.action === 'delete'
              ? { deletedAt: now }
              : {
                  deletedAt: null,
                  moderatedAt: null,
                  moderatedBy: { disconnect: true },
                  moderationNote: input.note ?? null,
                  status: ReviewStatus.PENDING,
                };
      const updated = await transaction.review.update({
        data,
        select: reviewSelect,
        where: { id },
      });
      await recordAdminAudit(
        transaction,
        { administratorId, requestId } satisfies AdminAuditContext,
        {
          action: actionMap[input.action],
          entityId: id,
          entityType: AdminAuditEntityType.REVIEW,
          metadata: {
            action: input.action,
            previousStatus: existing.status,
            productId: existing.productId,
            ...(input.note ? { note: input.note } : {}),
          },
        },
      );
      return updated;
    });
    return serializeReview(review);
  },
};
