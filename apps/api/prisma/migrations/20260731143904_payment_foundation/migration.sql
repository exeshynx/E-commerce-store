-- CreateTable
CREATE TABLE `payment_attempts` (
    `id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `provider` ENUM('MANUAL', 'STRIPE', 'PAYPAL', 'OTHER') NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `provider_payment_id` VARCHAR(191) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `failure_reason` VARCHAR(500) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payment_attempts_order_id_created_at_idx`(`order_id`, `created_at`),
    INDEX `payment_attempts_provider_provider_payment_id_idx`(`provider`, `provider_payment_id`),
    INDEX `payment_attempts_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_webhook_events` (
    `id` CHAR(36) NOT NULL,
    `provider` ENUM('MANUAL', 'STRIPE', 'PAYPAL', 'OTHER') NOT NULL,
    `external_event_id` VARCHAR(191) NOT NULL,
    `event_type` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payment_webhook_events_external_event_id_key`(`external_event_id`),
    INDEX `payment_webhook_events_provider_event_type_created_at_idx`(`provider`, `event_type`, `created_at`),
    INDEX `payment_webhook_events_processed_at_created_at_idx`(`processed_at`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payment_attempts` ADD CONSTRAINT `payment_attempts_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
