-- AlterTable
ALTER TABLE `admin_audit_logs` MODIFY `action` ENUM('ADMIN_LOGIN', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_ARCHIVED', 'PRODUCT_RESTORED', 'PRODUCT_IMAGE_ADDED', 'PRODUCT_IMAGE_UPDATED', 'PRODUCT_IMAGE_REMOVED', 'CATEGORY_CREATED', 'CATEGORY_UPDATED', 'CATEGORY_ARCHIVED', 'CATEGORY_RESTORED', 'INVENTORY_UPDATED', 'PAYMENT_REFUND_CREATED', 'SHIPMENT_CREATED', 'SHIPMENT_UPDATED', 'SHIPMENT_STATUS_CHANGED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'RETURN_ITEM_RECEIVED', 'RETURN_INSPECTED', 'RETURN_REFUND_INITIATED', 'RETURN_CLOSED', 'RETURN_SHIPMENT_UPDATED', 'RETURN_SHIPMENT_STATUS_CHANGED', 'SUPPORT_TICKET_REPLIED', 'SUPPORT_TICKET_ASSIGNED', 'SUPPORT_TICKET_PRIORITY_CHANGED', 'SUPPORT_TICKET_STATUS_CHANGED', 'REVIEW_APPROVED', 'REVIEW_REJECTED', 'REVIEW_DELETED', 'REVIEW_RESTORED', 'COUPON_CREATED', 'COUPON_UPDATED', 'COUPON_ENABLED', 'COUPON_DISABLED', 'PRODUCT_FEATURED', 'PRODUCT_UNFEATURED') NOT NULL,
    MODIFY `entity_type` ENUM('USER', 'PRODUCT', 'CATEGORY', 'INVENTORY', 'PAYMENT_REFUND', 'SHIPMENT', 'RETURN_REQUEST', 'RETURN_SHIPMENT', 'SUPPORT_TICKET', 'REVIEW', 'COUPON') NOT NULL;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `coupon_code` VARCHAR(64) NULL,
    ADD COLUMN `coupon_id` CHAR(36) NULL,
    ADD COLUMN `coupon_type` ENUM('FIXED_AMOUNT', 'PERCENTAGE') NULL,
    ADD COLUMN `coupon_value` DECIMAL(12, 2) NULL,
    ADD COLUMN `discount_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `is_featured` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `avatar_alt_text` VARCHAR(160) NULL,
    ADD COLUMN `avatar_url` VARCHAR(500) NULL,
    ADD COLUMN `phone` VARCHAR(32) NULL;

-- CreateTable
CREATE TABLE `reviews` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `rating` INTEGER NOT NULL,
    `title` VARCHAR(120) NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `moderation_note` VARCHAR(500) NULL,
    `moderated_by_id` CHAR(36) NULL,
    `moderated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reviews_product_id_status_deleted_at_created_at_idx`(`product_id`, `status`, `deleted_at`, `created_at`),
    INDEX `reviews_status_deleted_at_created_at_idx`(`status`, `deleted_at`, `created_at`),
    INDEX `reviews_moderated_by_id_moderated_at_idx`(`moderated_by_id`, `moderated_at`),
    UNIQUE INDEX `reviews_user_id_product_id_key`(`user_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupons` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `description` VARCHAR(500) NULL,
    `type` ENUM('FIXED_AMOUNT', 'PERCENTAGE') NOT NULL,
    `value` DECIMAL(12, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'PKR',
    `minimum_order_value` DECIMAL(12, 2) NULL,
    `starts_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `maximum_uses` INTEGER NULL,
    `maximum_uses_per_customer` INTEGER NULL,
    `is_enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `coupons_code_key`(`code`),
    INDEX `coupons_is_enabled_starts_at_expires_at_idx`(`is_enabled`, `starts_at`, `expires_at`),
    INDEX `coupons_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupon_usages` (
    `id` CHAR(36) NOT NULL,
    `coupon_id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `coupon_code` VARCHAR(64) NOT NULL,
    `coupon_type` ENUM('FIXED_AMOUNT', 'PERCENTAGE') NOT NULL,
    `coupon_value` DECIMAL(12, 2) NOT NULL,
    `discount_amount` DECIMAL(18, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `coupon_usages_order_id_key`(`order_id`),
    INDEX `coupon_usages_coupon_id_created_at_idx`(`coupon_id`, `created_at`),
    INDEX `coupon_usages_coupon_id_user_id_created_at_idx`(`coupon_id`, `user_id`, `created_at`),
    INDEX `coupon_usages_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `addresses` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `label` VARCHAR(80) NOT NULL,
    `full_name` VARCHAR(160) NOT NULL,
    `phone` VARCHAR(32) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `country` VARCHAR(100) NOT NULL,
    `province` VARCHAR(100) NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `postal_code` VARCHAR(20) NOT NULL,
    `address` TEXT NOT NULL,
    `is_default_shipping` BOOLEAN NOT NULL DEFAULT false,
    `is_default_billing` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `addresses_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `addresses_user_id_is_default_shipping_idx`(`user_id`, `is_default_shipping`),
    INDEX `addresses_user_id_is_default_billing_idx`(`user_id`, `is_default_billing`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_views` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `viewed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `product_views_user_id_viewed_at_idx`(`user_id`, `viewed_at`),
    INDEX `product_views_product_id_viewed_at_idx`(`product_id`, `viewed_at`),
    UNIQUE INDEX `product_views_user_id_product_id_key`(`user_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `orders_coupon_id_idx` ON `orders`(`coupon_id`);

-- CreateIndex
CREATE INDEX `products_is_featured_is_active_created_at_idx` ON `products`(`is_featured`, `is_active`, `created_at`);

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_coupon_id_fkey` FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_moderated_by_id_fkey` FOREIGN KEY (`moderated_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_usages` ADD CONSTRAINT `coupon_usages_coupon_id_fkey` FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_usages` ADD CONSTRAINT `coupon_usages_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_usages` ADD CONSTRAINT `coupon_usages_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `addresses` ADD CONSTRAINT `addresses_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_views` ADD CONSTRAINT `product_views_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_views` ADD CONSTRAINT `product_views_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
