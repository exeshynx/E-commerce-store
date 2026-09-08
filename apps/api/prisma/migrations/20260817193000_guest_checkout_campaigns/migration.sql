-- Guest shopping identities preserve the existing user/cart/order relationships while allowing checkout without authentication.
ALTER TABLE `users` ADD COLUMN `is_guest` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `guest_sessions` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `guest_sessions_user_id_key`(`user_id`),
  UNIQUE INDEX `guest_sessions_token_hash_key`(`token_hash`),
  INDEX `guest_sessions_expires_at_idx`(`expires_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `guest_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `email_queue_items`
  MODIFY `notification_type` ENUM('ORDER_CONFIRMATION','PAYMENT_SUCCESS','SHIPMENT_NOTIFICATION','DELIVERY_CONFIRMATION','RETURN_REQUESTED','RETURN_APPROVED','RETURN_REJECTED','REFUND_COMPLETED','SUPPORT_TICKET_CREATED','SUPPORT_ADMIN_REPLY','SUPPORT_TICKET_RESOLVED','CAMPAIGN_MESSAGE') NOT NULL,
  ADD COLUMN `campaign_id` CHAR(36) NULL;

ALTER TABLE `admin_audit_logs`
  MODIFY `action` ENUM('ADMIN_LOGIN','PRODUCT_CREATED','PRODUCT_UPDATED','PRODUCT_ARCHIVED','PRODUCT_RESTORED','PRODUCT_IMAGE_ADDED','PRODUCT_IMAGE_UPDATED','PRODUCT_IMAGE_REMOVED','CATEGORY_CREATED','CATEGORY_UPDATED','CATEGORY_ARCHIVED','CATEGORY_RESTORED','INVENTORY_UPDATED','PAYMENT_REFUND_CREATED','SHIPMENT_CREATED','SHIPMENT_UPDATED','SHIPMENT_STATUS_CHANGED','RETURN_APPROVED','RETURN_REJECTED','RETURN_ITEM_RECEIVED','RETURN_INSPECTED','RETURN_REFUND_INITIATED','RETURN_CLOSED','RETURN_SHIPMENT_UPDATED','RETURN_SHIPMENT_STATUS_CHANGED','SUPPORT_TICKET_REPLIED','SUPPORT_TICKET_ASSIGNED','SUPPORT_TICKET_PRIORITY_CHANGED','SUPPORT_TICKET_STATUS_CHANGED','REVIEW_APPROVED','REVIEW_REJECTED','REVIEW_DELETED','REVIEW_RESTORED','COUPON_CREATED','COUPON_UPDATED','COUPON_ENABLED','COUPON_DISABLED','PRODUCT_FEATURED','PRODUCT_UNFEATURED','CAMPAIGN_CREATED','CAMPAIGN_QUEUED') NOT NULL,
  MODIFY `entity_type` ENUM('USER','PRODUCT','CATEGORY','INVENTORY','PAYMENT_REFUND','SHIPMENT','RETURN_REQUEST','RETURN_SHIPMENT','SUPPORT_TICKET','REVIEW','COUPON','CAMPAIGN') NOT NULL;

CREATE TABLE `campaigns` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `audience` ENUM('ALL_REGISTERED','CUSTOMERS_WITH_CARTS','PURCHASERS') NOT NULL,
  `status` ENUM('DRAFT','QUEUED') NOT NULL DEFAULT 'DRAFT',
  `created_by_id` CHAR(36) NOT NULL,
  `queued_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `campaigns_status_created_at_idx`(`status`, `created_at`),
  INDEX `campaigns_created_by_id_created_at_idx`(`created_by_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `campaigns_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `campaign_recipients` (
  `id` CHAR(36) NOT NULL,
  `campaign_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `campaign_recipients_campaign_id_user_id_key`(`campaign_id`, `user_id`),
  INDEX `campaign_recipients_user_id_created_at_idx`(`user_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `campaign_recipients_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `campaign_recipients_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `email_queue_items_campaign_id_created_at_idx` ON `email_queue_items`(`campaign_id`, `created_at`);
ALTER TABLE `email_queue_items` ADD CONSTRAINT `email_queue_items_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
