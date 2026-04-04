ALTER TABLE posts DROP COLUMN sticker_url;

INSERT INTO _migrations (filename, executed_at)
VALUES ('012_drop_post_sticker_column.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
