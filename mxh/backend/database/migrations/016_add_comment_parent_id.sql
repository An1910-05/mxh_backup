-- Add parent_id column to comments (for threaded replies)
-- MySQL 8.0 safe: check INFORMATION_SCHEMA first

SET @col_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'comments'
      AND COLUMN_NAME = 'parent_id'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE comments ADD COLUMN parent_id INT NULL DEFAULT NULL AFTER post_id, ADD INDEX idx_comments_parent_id (parent_id)',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO _migrations (filename) VALUES ('016_add_comment_parent_id')
ON DUPLICATE KEY UPDATE filename = filename;
