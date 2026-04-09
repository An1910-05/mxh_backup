CREATE TABLE IF NOT EXISTS tai_xiu_rounds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    round_code BIGINT UNSIGNED NOT NULL UNIQUE,
    md5_hash CHAR(32) NOT NULL,
    dice_1 TINYINT UNSIGNED NOT NULL,
    dice_2 TINYINT UNSIGNED NOT NULL,
    dice_3 TINYINT UNSIGNED NOT NULL,
    total TINYINT UNSIGNED NOT NULL,
    result_key ENUM('tai', 'xiu') NOT NULL,
    jackpot_side ENUM('tai', 'xiu') DEFAULT NULL,
    jackpot_payout INT NOT NULL DEFAULT 0,
    tai_pool_snapshot INT NOT NULL DEFAULT 0,
    xiu_pool_snapshot INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tai_xiu_rounds_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tai_xiu_bets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    round_id INT NOT NULL,
    user_id INT NOT NULL,
    bet_side ENUM('tai', 'xiu') NOT NULL,
    bet_amount INT NOT NULL,
    result_key ENUM('tai', 'xiu') NOT NULL,
    did_win TINYINT(1) NOT NULL DEFAULT 0,
    net_amount INT NOT NULL DEFAULT 0,
    balance_after INT NOT NULL DEFAULT 0,
    jackpot_hit TINYINT(1) NOT NULL DEFAULT 0,
    jackpot_payout INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tai_xiu_bets_round FOREIGN KEY (round_id) REFERENCES tai_xiu_rounds(id) ON DELETE CASCADE,
    CONSTRAINT fk_tai_xiu_bets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_tai_xiu_bets_user_created_at (user_id, created_at),
    INDEX idx_tai_xiu_bets_round_id (round_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tai_xiu_jackpot_state (
    id TINYINT UNSIGNED PRIMARY KEY,
    tai_pool INT NOT NULL DEFAULT 50000,
    xiu_pool INT NOT NULL DEFAULT 50000,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO tai_xiu_jackpot_state (id, tai_pool, xiu_pool)
VALUES (1, 50000, 50000)
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO _migrations (filename) VALUES ('017_create_tai_xiu_tables')
ON DUPLICATE KEY UPDATE filename = filename;
