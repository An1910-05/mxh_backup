CREATE TABLE IF NOT EXISTS post_mentions (
    post_id INT NOT NULL,
    mentioned_user_id INT NOT NULL,
    PRIMARY KEY (post_id, mentioned_user_id),
    INDEX idx_mentioned (mentioned_user_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS comment_mentions (
    comment_id INT NOT NULL,
    mentioned_user_id INT NOT NULL,
    PRIMARY KEY (comment_id, mentioned_user_id),
    INDEX idx_mentioned (mentioned_user_id),
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(32) NOT NULL,
    actor_id INT NOT NULL,
    post_id INT NULL,
    comment_id INT NULL,
    read_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_unread (user_id, read_at),
    INDEX idx_created (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

ALTER TABLE posts ADD COLUMN location_label VARCHAR(255) NULL;
ALTER TABLE posts ADD COLUMN latitude DECIMAL(10,8) NULL;
ALTER TABLE posts ADD COLUMN longitude DECIMAL(11,8) NULL;

ALTER TABLE comments ADD COLUMN media_url VARCHAR(500) NULL;
ALTER TABLE comments ADD COLUMN media_type ENUM('image','video') NULL;
ALTER TABLE comments ADD COLUMN media_width INT NULL;
ALTER TABLE comments ADD COLUMN media_height INT NULL;

INSERT INTO _migrations (filename, executed_at) VALUES ('011_notifications_mentions_location.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();

SELECT 'Migration 011 applied' AS result;
