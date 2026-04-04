-- Add balance column to users
ALTER TABLE users ADD COLUMN balance INT NOT NULL DEFAULT 0;

-- Transactions table for payment history
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    txn_ref VARCHAR(100) NOT NULL UNIQUE,
    amount INT NOT NULL,
    description VARCHAR(255) DEFAULT NULL,
    status ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'pending',
    vnp_response_code VARCHAR(10) DEFAULT NULL,
    vnp_transaction_no VARCHAR(50) DEFAULT NULL,
    bank_code VARCHAR(20) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_txn_ref (txn_ref),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO _migrations (filename) VALUES ('015_add_balance_and_transactions');
