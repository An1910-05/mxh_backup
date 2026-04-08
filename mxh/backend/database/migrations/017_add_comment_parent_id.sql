-- Add parent_id to comments for threaded replies (2-level)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comments' AND COLUMN_NAME = 'parent_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE comments ADD COLUMN parent_id INT NULL DEFAULT NULL AFTER post_id, ADD INDEX idx_comments_parent_id (parent_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO _migrations (filename, executed_at) VALUES ('017_add_comment_parent_id.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
