-- Game config
CREATE TABLE IF NOT EXISTS tiu_xai_config (
  config_key VARCHAR(50) NOT NULL,
  config_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Game sessions
CREATE TABLE IF NOT EXISTS tiu_xai_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dice1 TINYINT UNSIGNED NULL,
  dice2 TINYINT UNSIGNED NULL,
  dice3 TINYINT UNSIGNED NULL,
  total_points TINYINT UNSIGNED NULL,
  result ENUM('tiu','xai') NULL,
  is_jackpot TINYINT(1) DEFAULT 0,
  jackpot_snapshot BIGINT DEFAULT 0,
  total_bet_tiu BIGINT DEFAULT 0,
  total_bet_xai BIGINT DEFAULT 0,
  player_count_tiu INT DEFAULT 0,
  player_count_xai INT DEFAULT 0,
  reward_processed TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  rewarded_at TIMESTAMP NULL
) ENGINE=InnoDB AUTO_INCREMENT=1990001 DEFAULT CHARSET=utf8mb4;

-- Player bets
CREATE TABLE IF NOT EXISTS tiu_xai_bets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  user_id INT NOT NULL,
  side ENUM('tiu','xai') NOT NULL,
  amount BIGINT NOT NULL,
  win_amount BIGINT DEFAULT 0,
  status ENUM('pending','won','lost','refunded') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_session_user (session_id, user_id),
  INDEX idx_user_id (user_id),
  FOREIGN KEY (session_id) REFERENCES tiu_xai_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Jackpot pool (single row)
CREATE TABLE IF NOT EXISTS tiu_xai_jackpot (
  id INT NOT NULL DEFAULT 1,
  pool BIGINT DEFAULT 50000000,
  total_paid BIGINT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Default config
INSERT INTO tiu_xai_config (config_key, config_value) VALUES
  ('bet_duration', '30'),
  ('min_bet', '10000'),
  ('max_bet', '10000000'),
  ('win_multiplier', '195'),
  ('jackpot_contrib_pct', '1'),
  ('jackpot_min_pool', '50000000')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);

-- Seed jackpot pool if not exists
INSERT IGNORE INTO tiu_xai_jackpot (id, pool) VALUES (1, 261238062);

INSERT INTO _migrations (filename, executed_at) VALUES ('016_tiu_xai_game.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
