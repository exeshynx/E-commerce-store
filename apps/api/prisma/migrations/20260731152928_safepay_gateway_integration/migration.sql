-- Extend the provider-neutral payment enums for the first production gateway.
ALTER TABLE `payment_attempts`
  ADD COLUMN `provider_idempotency_key` VARCHAR(128) NULL,
  MODIFY `provider` ENUM('MANUAL', 'SAFEPAY', 'STRIPE', 'PAYPAL', 'OTHER') NOT NULL;

ALTER TABLE `payment_webhook_events`
  MODIFY `provider` ENUM('MANUAL', 'SAFEPAY', 'STRIPE', 'PAYPAL', 'OTHER') NOT NULL;

-- Allow immutable order history to identify either an administrator or a trusted system actor.
ALTER TABLE `order_status_history`
  ADD COLUMN `actor_type` ENUM('ADMIN', 'SYSTEM') NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN `system_actor` VARCHAR(100) NULL,
  MODIFY `administrator_id` CHAR(36) NULL;

-- Upgrade the Phase 6 webhook ledger without discarding existing verified events.
DROP INDEX `payment_webhook_events_external_event_id_key` ON `payment_webhook_events`;
DROP INDEX `payment_webhook_events_processed_at_created_at_idx` ON `payment_webhook_events`;

ALTER TABLE `payment_webhook_events`
  ADD COLUMN `last_error` VARCHAR(1000) NULL,
  ADD COLUMN `payment_attempt_id` CHAR(36) NULL,
  ADD COLUMN `processing_attempts` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `processing_started_at` DATETIME(3) NULL,
  ADD COLUMN `processing_status` ENUM('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED') NOT NULL DEFAULT 'RECEIVED',
  ADD COLUMN `provider_created_at` DATETIME(3) NULL,
  ADD COLUMN `signature_verified` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `updated_at` DATETIME(3) NULL;

UPDATE `payment_webhook_events`
SET `updated_at` = `created_at`
WHERE `updated_at` IS NULL;

ALTER TABLE `payment_webhook_events`
  MODIFY `updated_at` DATETIME(3) NOT NULL;

-- Refunds are append-only financial records; successful attempts are never overwritten.
CREATE TABLE `payment_refunds` (
  `id` CHAR(36) NOT NULL,
  `payment_attempt_id` CHAR(36) NOT NULL,
  `provider_refund_id` VARCHAR(191) NULL,
  `provider_idempotency_key` VARCHAR(128) NOT NULL,
  `status` ENUM('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `amount` DECIMAL(12, 2) NOT NULL,
  `currency` CHAR(3) NOT NULL,
  `reason` VARCHAR(500) NULL,
  `failure_reason` VARCHAR(500) NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `payment_refunds_provider_idempotency_key_key` (`provider_idempotency_key`),
  INDEX `payment_refunds_payment_attempt_id_created_at_idx` (`payment_attempt_id`, `created_at`),
  INDEX `payment_refunds_provider_refund_id_idx` (`provider_refund_id`),
  INDEX `payment_refunds_status_created_at_idx` (`status`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `payment_refunds_amount_check` CHECK (`amount` > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `payment_attempts_provider_provider_idempotency_key_key`
  ON `payment_attempts` (`provider`, `provider_idempotency_key`);

CREATE INDEX `payment_webhook_events_payment_attempt_id_created_at_idx`
  ON `payment_webhook_events` (`payment_attempt_id`, `created_at`);

CREATE INDEX `payment_webhook_events_processing_status_created_at_idx`
  ON `payment_webhook_events` (`processing_status`, `created_at`);

CREATE UNIQUE INDEX `payment_webhook_events_provider_external_event_id_key`
  ON `payment_webhook_events` (`provider`, `external_event_id`);

ALTER TABLE `payment_webhook_events`
  ADD CONSTRAINT `payment_webhook_events_payment_attempt_id_fkey`
  FOREIGN KEY (`payment_attempt_id`) REFERENCES `payment_attempts` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `payment_refunds`
  ADD CONSTRAINT `payment_refunds_payment_attempt_id_fkey`
  FOREIGN KEY (`payment_attempt_id`) REFERENCES `payment_attempts` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
