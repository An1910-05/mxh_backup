-- Migration 019: Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role ENUM('user', 'admin') NOT NULL DEFAULT 'user';

-- Add is_blocked column for user management
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked TINYINT(1) NOT NULL DEFAULT 0;

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users(is_blocked);
