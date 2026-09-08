-- AlterTable
ALTER TABLE `admin_audit_logs` MODIFY `action` ENUM('ADMIN_LOGIN', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_ARCHIVED', 'PRODUCT_RESTORED', 'PRODUCT_IMAGE_ADDED', 'PRODUCT_IMAGE_UPDATED', 'PRODUCT_IMAGE_REMOVED', 'CATEGORY_CREATED', 'CATEGORY_UPDATED', 'CATEGORY_ARCHIVED', 'CATEGORY_RESTORED', 'INVENTORY_UPDATED', 'PAYMENT_REFUND_CREATED', 'SHIPMENT_CREATED', 'SHIPMENT_UPDATED', 'SHIPMENT_STATUS_CHANGED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'RETURN_ITEM_RECEIVED', 'RETURN_INSPECTED', 'RETURN_REFUND_INITIATED', 'RETURN_CLOSED', 'RETURN_SHIPMENT_UPDATED', 'RETURN_SHIPMENT_STATUS_CHANGED', 'SUPPORT_TICKET_REPLIED', 'SUPPORT_TICKET_ASSIGNED', 'SUPPORT_TICKET_PRIORITY_CHANGED', 'SUPPORT_TICKET_STATUS_CHANGED') NOT NULL,
    MODIFY `entity_type` ENUM('USER', 'PRODUCT', 'CATEGORY', 'INVENTORY', 'PAYMENT_REFUND', 'SHIPMENT', 'RETURN_REQUEST', 'RETURN_SHIPMENT', 'SUPPORT_TICKET') NOT NULL;

-- AlterTable
ALTER TABLE `email_queue_items` ADD COLUMN `return_request_id` CHAR(36) NULL,
    ADD COLUMN `support_ticket_id` CHAR(36) NULL,
    MODIFY `order_id` CHAR(36) NULL,
    MODIFY `notification_type` ENUM('ORDER_CONFIRMATION', 'PAYMENT_SUCCESS', 'SHIPMENT_NOTIFICATION', 'DELIVERY_CONFIRMATION', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'REFUND_COMPLETED', 'SUPPORT_TICKET_CREATED', 'SUPPORT_ADMIN_REPLY', 'SUPPORT_TICKET_RESOLVED') NOT NULL;

-- AlterTable
ALTER TABLE `payment_refunds` ADD COLUMN `return_request_id` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `return_requests` (
    `id` CHAR(36) NOT NULL,
    `return_number` VARCHAR(32) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `status` ENUM('REQUESTED', 'APPROVED', 'REJECTED', 'ITEM_RECEIVED', 'INSPECTED', 'REFUND_PENDING', 'REFUNDED', 'CLOSED') NOT NULL DEFAULT 'REQUESTED',
    `customer_note` VARCHAR(1000) NULL,
    `rejection_reason` VARCHAR(500) NULL,
    `inspection_notes` VARCHAR(2000) NULL,
    `approved_at` DATETIME(3) NULL,
    `received_at` DATETIME(3) NULL,
    `inspected_at` DATETIME(3) NULL,
    `refunded_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `return_requests_return_number_key`(`return_number`),
    INDEX `return_requests_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `return_requests_order_id_created_at_idx`(`order_id`, `created_at`),
    INDEX `return_requests_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return_items` (
    `id` CHAR(36) NOT NULL,
    `return_request_id` CHAR(36) NOT NULL,
    `order_item_id` CHAR(36) NOT NULL,
    `reason` ENUM('DAMAGED', 'DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'SIZE_OR_FIT', 'CHANGED_MIND', 'OTHER') NOT NULL,
    `reason_details` VARCHAR(500) NULL,
    `quantity` INTEGER NOT NULL,
    `product_name` VARCHAR(180) NOT NULL,
    `sku` VARCHAR(64) NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `refund_amount` DECIMAL(18, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `return_items_order_item_id_idx`(`order_item_id`),
    UNIQUE INDEX `return_items_return_request_id_order_item_id_key`(`return_request_id`, `order_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return_shipments` (
    `id` CHAR(36) NOT NULL,
    `return_request_id` CHAR(36) NOT NULL,
    `courier` VARCHAR(120) NULL,
    `tracking_number` VARCHAR(191) NULL,
    `status` ENUM('AWAITING_SHIPMENT', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED_TO_SENDER') NOT NULL DEFAULT 'AWAITING_SHIPMENT',
    `shipped_at` DATETIME(3) NULL,
    `delivered_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `return_shipments_return_request_id_key`(`return_request_id`),
    INDEX `return_shipments_status_created_at_idx`(`status`, `created_at`),
    INDEX `return_shipments_tracking_number_idx`(`tracking_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return_shipment_events` (
    `id` CHAR(36) NOT NULL,
    `return_shipment_id` CHAR(36) NOT NULL,
    `administrator_id` CHAR(36) NOT NULL,
    `previous_status` ENUM('AWAITING_SHIPMENT', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED_TO_SENDER') NULL,
    `status` ENUM('AWAITING_SHIPMENT', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED_TO_SENDER') NOT NULL,
    `location` VARCHAR(160) NULL,
    `message` VARCHAR(500) NULL,
    `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `return_shipment_events_return_shipment_id_occurred_at_idx`(`return_shipment_id`, `occurred_at`),
    INDEX `return_shipment_events_administrator_id_created_at_idx`(`administrator_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `support_tickets` (
    `id` CHAR(36) NOT NULL,
    `ticket_number` VARCHAR(32) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NULL,
    `assigned_to_id` CHAR(36) NULL,
    `subject` VARCHAR(180) NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `resolved_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `support_tickets_ticket_number_key`(`ticket_number`),
    INDEX `support_tickets_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `support_tickets_assigned_to_id_status_updated_at_idx`(`assigned_to_id`, `status`, `updated_at`),
    INDEX `support_tickets_status_priority_updated_at_idx`(`status`, `priority`, `updated_at`),
    INDEX `support_tickets_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `support_messages` (
    `id` CHAR(36) NOT NULL,
    `ticket_id` CHAR(36) NOT NULL,
    `author_id` CHAR(36) NOT NULL,
    `author_role` ENUM('ADMIN', 'CUSTOMER') NOT NULL,
    `body` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `support_messages_ticket_id_created_at_idx`(`ticket_id`, `created_at`),
    INDEX `support_messages_author_id_created_at_idx`(`author_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_attachments` (
    `id` CHAR(36) NOT NULL,
    `message_id` CHAR(36) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `media_type` VARCHAR(120) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `checksum` CHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ticket_attachments_message_id_idx`(`message_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `email_queue_items_return_request_id_created_at_idx` ON `email_queue_items`(`return_request_id`, `created_at`);

-- CreateIndex
CREATE INDEX `email_queue_items_support_ticket_id_created_at_idx` ON `email_queue_items`(`support_ticket_id`, `created_at`);

-- CreateIndex
CREATE INDEX `payment_refunds_return_request_id_created_at_idx` ON `payment_refunds`(`return_request_id`, `created_at`);

-- AddForeignKey
ALTER TABLE `payment_refunds` ADD CONSTRAINT `payment_refunds_return_request_id_fkey` FOREIGN KEY (`return_request_id`) REFERENCES `return_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_queue_items` ADD CONSTRAINT `email_queue_items_return_request_id_fkey` FOREIGN KEY (`return_request_id`) REFERENCES `return_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_queue_items` ADD CONSTRAINT `email_queue_items_support_ticket_id_fkey` FOREIGN KEY (`support_ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_items` ADD CONSTRAINT `return_items_return_request_id_fkey` FOREIGN KEY (`return_request_id`) REFERENCES `return_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_items` ADD CONSTRAINT `return_items_order_item_id_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_shipments` ADD CONSTRAINT `return_shipments_return_request_id_fkey` FOREIGN KEY (`return_request_id`) REFERENCES `return_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_shipment_events` ADD CONSTRAINT `return_shipment_events_return_shipment_id_fkey` FOREIGN KEY (`return_shipment_id`) REFERENCES `return_shipments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_shipment_events` ADD CONSTRAINT `return_shipment_events_administrator_id_fkey` FOREIGN KEY (`administrator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_assigned_to_id_fkey` FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_messages` ADD CONSTRAINT `support_messages_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_messages` ADD CONSTRAINT `support_messages_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_attachments` ADD CONSTRAINT `ticket_attachments_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `support_messages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
