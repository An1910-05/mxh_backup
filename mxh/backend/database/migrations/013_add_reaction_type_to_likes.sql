-- Add reaction_type column to likes table to track which emoji reaction was used
ALTER TABLE likes ADD COLUMN IF NOT EXISTS reaction_type VARCHAR(20) NOT NULL DEFAULT 'like' AFTER user_id;

INSERT INTO _migrations (filename, executed_at)
VALUES ('013_add_reaction_type_to_likes.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
