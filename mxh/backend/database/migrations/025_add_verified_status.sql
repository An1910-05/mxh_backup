-- Add verified badge subscription to users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_verified TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS verified_until TIMESTAMP NULL DEFAULT NULL;

-- Auto-expire: is_verified stays 1 until app logic checks verified_until
-- Application layer resets is_verified = 0 when verified_until < NOW()

INSERT INTO _migrations (filename, executed_at) VALUES ('025_add_verified_status.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
