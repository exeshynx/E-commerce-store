-- CreateTable
CREATE TABLE `categories` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(140) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categories_name_key`(`name`),
    UNIQUE INDEX `categories_slug_key`(`slug`),
    INDEX `categories_is_active_name_idx`(`is_active`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` CHAR(36) NOT NULL,
    `category_id` CHAR(36) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `slug` VARCHAR(200) NOT NULL,
    `sku` VARCHAR(64) NOT NULL,
    `description` TEXT NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'PKR',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `products_slug_key`(`slug`),
    UNIQUE INDEX `products_sku_key`(`sku`),
    INDEX `products_category_id_is_active_idx`(`category_id`, `is_active`),
    INDEX `products_is_active_created_at_idx`(`is_active`, `created_at`),
    INDEX `products_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_images` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `path` VARCHAR(500) NOT NULL,
    `alt_text` VARCHAR(160) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `product_images_product_id_idx`(`product_id`),
    UNIQUE INDEX `product_images_product_id_position_key`(`product_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `available_quantity` INTEGER NOT NULL DEFAULT 0,
    `reserved_quantity` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_product_id_key`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddCheckConstraints
ALTER TABLE `inventory`
    ADD CONSTRAINT `inventory_available_quantity_nonnegative` CHECK (`available_quantity` >= 0),
    ADD CONSTRAINT `inventory_reserved_quantity_nonnegative` CHECK (`reserved_quantity` >= 0),
    ADD CONSTRAINT `inventory_reserved_within_available` CHECK (`reserved_quantity` <= `available_quantity`);

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
