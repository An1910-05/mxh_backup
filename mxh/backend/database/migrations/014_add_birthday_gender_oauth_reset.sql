ALTER TABLE users ADD COLUMN birthday DATE DEFAULT NULL AFTER password_hash;
ALTER TABLE users ADD COLUMN gender VARCHAR(10) DEFAULT NULL AFTER birthday;
ALTER TABLE users ADD COLUMN google_id VARCHAR(255) DEFAULT NULL AFTER gender;
ALTER TABLE users ADD COLUMN reset_token VARCHAR(100) DEFAULT NULL AFTER google_id;
ALTER TABLE users ADD COLUMN reset_token_expires DATETIME DEFAULT NULL AFTER reset_token;

INSERT INTO _migrations (filename, executed_at)
VALUES ('014_add_birthday_gender_oauth_reset.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
