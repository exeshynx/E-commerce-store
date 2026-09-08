-- CreateTable
CREATE TABLE `orders` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `order_number` VARCHAR(32) NOT NULL,
    `status` ENUM('PENDING', 'AWAITING_PAYMENT', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `currency` CHAR(3) NOT NULL,
    `subtotal` DECIMAL(18, 2) NOT NULL,
    `total` DECIMAL(18, 2) NOT NULL,
    `idempotency_key` VARCHAR(128) NOT NULL,
    `checkout_fingerprint` CHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_order_number_key`(`order_number`),
    INDEX `orders_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `orders_status_created_at_idx`(`status`, `created_at`),
    UNIQUE INDEX `orders_user_id_idempotency_key_key`(`user_id`, `idempotency_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddCheckConstraints
ALTER TABLE `orders`
    ADD CONSTRAINT `orders_subtotal_nonnegative` CHECK (`subtotal` >= 0),
    ADD CONSTRAINT `orders_total_nonnegative` CHECK (`total` >= 0);

-- CreateTable
CREATE TABLE `order_items` (
    `id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `product_name` VARCHAR(180) NOT NULL,
    `sku` VARCHAR(64) NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `line_subtotal` DECIMAL(18, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_items_order_id_idx`(`order_id`),
    INDEX `order_items_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddCheckConstraints
ALTER TABLE `order_items`
    ADD CONSTRAINT `order_items_quantity_positive` CHECK (`quantity` > 0),
    ADD CONSTRAINT `order_items_unit_price_nonnegative` CHECK (`unit_price` >= 0),
    ADD CONSTRAINT `order_items_line_subtotal_nonnegative` CHECK (`line_subtotal` >= 0);

-- CreateTable
CREATE TABLE `shipping_address_snapshots` (
    `id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `full_name` VARCHAR(160) NOT NULL,
    `phone` VARCHAR(32) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `country` VARCHAR(100) NOT NULL,
    `province` VARCHAR(100) NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `postal_code` VARCHAR(20) NOT NULL,
    `address` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `shipping_address_snapshots_order_id_key`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shipping_address_snapshots` ADD CONSTRAINT `shipping_address_snapshots_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
