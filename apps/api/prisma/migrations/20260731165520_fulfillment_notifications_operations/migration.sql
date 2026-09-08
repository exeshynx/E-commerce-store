-- CreateTable
CREATE TABLE `shipments` (
    `id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `courier` VARCHAR(120) NOT NULL,
    `tracking_number` VARCHAR(191) NULL,
    `status` ENUM('PACKING', 'READY_TO_SHIP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED') NOT NULL DEFAULT 'PACKING',
    `shipped_at` DATETIME(3) NULL,
    `delivered_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shipments_order_id_key`(`order_id`),
    INDEX `shipments_status_created_at_idx`(`status`, `created_at`),
    INDEX `shipments_tracking_number_idx`(`tracking_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shipment_events` (
    `id` CHAR(36) NOT NULL,
    `shipment_id` CHAR(36) NOT NULL,
    `administrator_id` CHAR(36) NOT NULL,
    `previous_status` ENUM('PACKING', 'READY_TO_SHIP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED') NULL,
    `status` ENUM('PACKING', 'READY_TO_SHIP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED') NOT NULL,
    `location` VARCHAR(160) NULL,
    `message` VARCHAR(500) NULL,
    `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `shipment_events_shipment_id_occurred_at_idx`(`shipment_id`, `occurred_at`),
    INDEX `shipment_events_administrator_id_created_at_idx`(`administrator_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_queue_items` (
    `id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `notification_type` ENUM('ORDER_CONFIRMATION', 'PAYMENT_SUCCESS', 'SHIPMENT_NOTIFICATION', 'DELIVERY_CONFIRMATION') NOT NULL,
    `recipient_email` VARCHAR(254) NOT NULL,
    `subject` VARCHAR(255) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'DEAD_LETTER') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `max_attempts` INTEGER NOT NULL DEFAULT 5,
    `available_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `locked_at` DATETIME(3) NULL,
    `sent_at` DATETIME(3) NULL,
    `last_error` VARCHAR(1000) NULL,
    `provider_message_id` VARCHAR(191) NULL,
    `deduplication_key` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `email_queue_items_deduplication_key_key`(`deduplication_key`),
    INDEX `email_queue_items_status_available_at_idx`(`status`, `available_at`),
    INDEX `email_queue_items_order_id_created_at_idx`(`order_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_audit_logs` (
    `id` CHAR(36) NOT NULL,
    `administrator_id` CHAR(36) NOT NULL,
    `action` ENUM('ADMIN_LOGIN', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_ARCHIVED', 'PRODUCT_RESTORED', 'PRODUCT_IMAGE_ADDED', 'PRODUCT_IMAGE_UPDATED', 'PRODUCT_IMAGE_REMOVED', 'CATEGORY_CREATED', 'CATEGORY_UPDATED', 'CATEGORY_ARCHIVED', 'CATEGORY_RESTORED', 'INVENTORY_UPDATED', 'PAYMENT_REFUND_CREATED', 'SHIPMENT_CREATED', 'SHIPMENT_UPDATED', 'SHIPMENT_STATUS_CHANGED') NOT NULL,
    `entity_type` ENUM('USER', 'PRODUCT', 'CATEGORY', 'INVENTORY', 'PAYMENT_REFUND', 'SHIPMENT') NOT NULL,
    `entity_id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(128) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_audit_logs_administrator_id_created_at_idx`(`administrator_id`, `created_at`),
    INDEX `admin_audit_logs_action_created_at_idx`(`action`, `created_at`),
    INDEX `admin_audit_logs_entity_type_entity_id_created_at_idx`(`entity_type`, `entity_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `background_job_states` (
    `name` VARCHAR(64) NOT NULL,
    `last_started_at` DATETIME(3) NULL,
    `last_succeeded_at` DATETIME(3) NULL,
    `last_failed_at` DATETIME(3) NULL,
    `last_error` VARCHAR(1000) NULL,
    `processed_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `shipments` ADD CONSTRAINT `shipments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shipment_events` ADD CONSTRAINT `shipment_events_shipment_id_fkey` FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shipment_events` ADD CONSTRAINT `shipment_events_administrator_id_fkey` FOREIGN KEY (`administrator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_queue_items` ADD CONSTRAINT `email_queue_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_audit_logs` ADD CONSTRAINT `admin_audit_logs_administrator_id_fkey` FOREIGN KEY (`administrator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
