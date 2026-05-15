CREATE TABLE IF NOT EXISTS caro_rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NULL,
    password_hash VARCHAR(255) NULL,
    visibility ENUM('private', 'public') NOT NULL DEFAULT 'private',
    is_matchmaking TINYINT(1) NOT NULL DEFAULT 0,
    status ENUM('waiting', 'playing', 'finished', 'abandoned') NOT NULL DEFAULT 'waiting',
    creator_id INT NOT NULL,
    opponent_id INT NULL,
    current_turn ENUM('X', 'O') NOT NULL DEFAULT 'X',
    winner_symbol ENUM('X', 'O', 'draw') NULL,
    winner_user_id INT NULL,
    board_size TINYINT UNSIGNED NOT NULL DEFAULT 15,
    win_length TINYINT UNSIGNED NOT NULL DEFAULT 5,
    move_count INT UNSIGNED NOT NULL DEFAULT 0,
    board_state MEDIUMTEXT NULL,
    last_move_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_caro_rooms_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_caro_rooms_opponent FOREIGN KEY (opponent_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_caro_rooms_winner FOREIGN KEY (winner_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_caro_rooms_code (code),
    INDEX idx_caro_rooms_status (status),
    INDEX idx_caro_rooms_matchmaking (is_matchmaking, status),
    INDEX idx_caro_rooms_creator (creator_id, status),
    INDEX idx_caro_rooms_opponent (opponent_id, status),
    INDEX idx_caro_rooms_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO _migrations (filename) VALUES ('023_create_caro_tables')
ON DUPLICATE KEY UPDATE filename = filename;
