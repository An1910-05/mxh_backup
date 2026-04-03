USE mxh_social;

-- Conversations (1-on-1 and future group support)
CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('private', 'group') NOT NULL DEFAULT 'private',
    title VARCHAR(255) NULL,
    avatar VARCHAR(500) NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type (type),
    INDEX idx_updated (updated_at),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Conversation participants
CREATE TABLE IF NOT EXISTS conversation_participants (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('owner', 'admin', 'member') NOT NULL DEFAULT 'member',
    last_read_msg_id BIGINT NULL DEFAULT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_participant (conversation_id, user_id),
    INDEX idx_user (user_id),
    INDEX idx_conversation (conversation_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Messages (cloud-stored, MTProto-inspired fields)
CREATE TABLE IF NOT EXISTS messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    sender_id INT NOT NULL,
    -- MTProto-inspired: unique message identifier per conversation
    msg_id BIGINT NOT NULL,
    -- MTProto-inspired: sequence number for ordering
    seq_no INT NOT NULL DEFAULT 0,
    -- Content
    content TEXT NULL,
    content_type ENUM('text', 'image', 'video', 'file', 'system') NOT NULL DEFAULT 'text',
    media_url VARCHAR(500) NULL,
    media_width INT NULL,
    media_height INT NULL,
    -- Reply threading
    reply_to_msg_id BIGINT NULL,
    -- Edit/delete support
    is_edited BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    edited_at TIMESTAMP NULL,
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_conversation (conversation_id),
    INDEX idx_sender (sender_id),
    INDEX idx_msg_id (conversation_id, msg_id),
    INDEX idx_created (conversation_id, created_at),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Message delivery/read status per user
CREATE TABLE IF NOT EXISTS message_status (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('sent', 'delivered', 'read') NOT NULL DEFAULT 'sent',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_msg_user (message_id, user_id),
    INDEX idx_user_status (user_id, status),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- User online status tracking
CREATE TABLE IF NOT EXISTS user_presence (
    user_id INT PRIMARY KEY,
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
