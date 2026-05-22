ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_login_device ENUM('mobile', 'web') DEFAULT NULL;

INSERT INTO _migrations (filename, executed_at) VALUES ('026_add_last_login_device.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
