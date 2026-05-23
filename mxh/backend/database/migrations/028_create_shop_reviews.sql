-- Migration 028: Shop product reviews & ratings (Shopee-style)
-- Rule: chỉ buyer của đơn hàng đã 'completed' mới được đánh giá.
--       Một đơn = một review duy nhất (UNIQUE order_id).
--       Seller có thể trả lời 1 lần.

CREATE TABLE IF NOT EXISTS shop_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL UNIQUE,
    product_id INT NOT NULL,
    buyer_id INT NOT NULL,
    seller_id INT NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    content TEXT NOT NULL,
    images JSON DEFAULT NULL COMMENT 'Optional review images',
    seller_reply TEXT NULL,
    replied_at TIMESTAMP NULL,
    is_hidden TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Admin có thể ẩn review vi phạm',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id)   REFERENCES shop_orders(id)   ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES shop_products(id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id)   REFERENCES users(id)         ON DELETE CASCADE,
    FOREIGN KEY (seller_id)  REFERENCES users(id)         ON DELETE CASCADE,
    INDEX idx_product (product_id, is_hidden),
    INDEX idx_seller  (seller_id, is_hidden),
    INDEX idx_buyer   (buyer_id),
    INDEX idx_rating  (product_id, rating, is_hidden),
    INDEX idx_created (product_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert migration record
INSERT INTO _migrations (filename, executed_at) VALUES ('028_create_shop_reviews.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
