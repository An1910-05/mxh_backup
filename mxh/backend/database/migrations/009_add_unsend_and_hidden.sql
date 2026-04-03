USE mxh_social;

ALTER TABLE messages ADD COLUMN is_unsent BOOLEAN NOT NULL DEFAULT FALSE AFTER is_deleted;

CREATE TABLE IF NOT EXISTS message_hidden (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    hidden_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_hidden (message_id, user_id),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
