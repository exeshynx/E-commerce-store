import { OrderStatus, UserRole, UserStatus } from '@prisma/client';
import { z } from 'zod';

const optionalSearchSchema = z.string().trim().min(1).max(100).optional();
const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};
const activitySchema = z.enum(['all', 'active', 'archived']).default('all');

export const adminProductListQuerySchema = z.object({
  ...paginationShape,
  categoryId: z.uuid().optional(),
  q: optionalSearchSchema,
  status: activitySchema,
  sort: z
    .enum(['created_desc', 'created_asc', 'name_asc', 'name_desc', 'price_asc', 'price_desc'])
    .default('created_desc'),
});

export const adminCategoryListQuerySchema = z.object({
  ...paginationShape,
  q: optionalSearchSchema,
  status: activitySchema,
  sort: z.enum(['name_asc', 'name_desc', 'created_desc', 'created_asc']).default('name_asc'),
});

export const adminInventoryListQuerySchema = z.object({
  ...paginationShape,
  q: optionalSearchSchema,
  stock: z.enum(['all', 'in_stock', 'low_stock', 'out_of_stock']).default('all'),
});

export const inventoryUpdateSchema = z.object({
  totalQuantity: z.coerce.number().int().min(0).max(2_147_483_647),
});

export const adminOrderListQuerySchema = z.object({
  ...paginationShape,
  q: optionalSearchSchema,
  status: z.nativeEnum(OrderStatus).optional(),
  sort: z.enum(['created_desc', 'created_asc', 'total_desc', 'total_asc']).default('created_desc'),
});

export const orderStatusUpdateSchema = z.object({
  note: z.string().trim().min(1).max(500).optional(),
  status: z.nativeEnum(OrderStatus),
});

export const adminUserListQuerySchema = z.object({
  ...paginationShape,
  q: optionalSearchSchema,
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  sort: z.enum(['created_desc', 'created_asc', 'name_asc', 'name_desc']).default('created_desc'),
});

export type AdminCategoryListQuery = z.infer<typeof adminCategoryListQuerySchema>;
export type AdminInventoryListQuery = z.infer<typeof adminInventoryListQuerySchema>;
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;
export type AdminProductListQuery = z.infer<typeof adminProductListQuerySchema>;
export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;
