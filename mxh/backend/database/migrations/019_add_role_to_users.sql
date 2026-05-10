-- Migration 019: Add role column to users table
-- Note: MySQL 8.0 does NOT support `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`.
-- Idempotency is handled by `_migrations` table tracking; do not re-apply manually.

ALTER TABLE users ADD COLUMN role ENUM('user', 'admin') NOT NULL DEFAULT 'user';

ALTER TABLE users ADD COLUMN is_blocked TINYINT(1) NOT NULL DEFAULT 0;

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_blocked ON users(is_blocked);

INSERT INTO _migrations (filename, executed_at) VALUES ('019_add_role_to_users.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
