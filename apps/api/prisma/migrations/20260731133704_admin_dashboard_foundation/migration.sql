-- CreateTable
CREATE TABLE `order_status_history` (
    `id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `previous_status` ENUM('PENDING', 'AWAITING_PAYMENT', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED') NOT NULL,
    `new_status` ENUM('PENDING', 'AWAITING_PAYMENT', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED') NOT NULL,
    `administrator_id` CHAR(36) NOT NULL,
    `note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT `order_status_history_status_changed_check` CHECK (`previous_status` <> `new_status`),
    INDEX `order_status_history_order_id_created_at_idx`(`order_id`, `created_at`),
    INDEX `order_status_history_administrator_id_created_at_idx`(`administrator_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `users_role_status_created_at_idx` ON `users`(`role`, `status`, `created_at`);

-- AddForeignKey
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_administrator_id_fkey` FOREIGN KEY (`administrator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
