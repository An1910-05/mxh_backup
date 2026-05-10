-- Migration 022: Shop seller applications + users.is_seller flag
-- Workflow: user submit application -> admin approve/reject -> on approve, set users.is_seller = 1
-- Note: MySQL 8.0 không hỗ trợ ADD COLUMN IF NOT EXISTS. Idempotency dựa vào _migrations.

CREATE TABLE IF NOT EXISTS shop_seller_applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    store_name VARCHAR(100) NOT NULL,
    intro TEXT NOT NULL,
    phone VARCHAR(30) NOT NULL,
    address VARCHAR(255) NOT NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    rejection_reason TEXT NULL,
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE users ADD COLUMN is_seller TINYINT(1) NOT NULL DEFAULT 0;
CREATE INDEX idx_users_is_seller ON users (is_seller);

INSERT INTO _migrations (filename, executed_at) VALUES ('022_shop_seller_applications.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
