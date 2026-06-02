-- Shop product variants — single-tier classifications (Shopee-style "Phân loại").
-- A product can have 0..N variants; each variant has its own price, stock and image.
-- When a product has variants: shop_products.price = min(variant price),
-- shop_products.stock_quantity = sum(variant stock) — kept in sync by ShopProductService.

CREATE TABLE IF NOT EXISTS shop_product_variants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    name VARCHAR(120) NOT NULL COMMENT 'Variant label, e.g. "PB200N Cam"',
    price INT NOT NULL COMMENT 'Price in smallest currency unit',
    stock_quantity INT DEFAULT NULL COMMENT 'NULL = unlimited',
    image VARCHAR(500) DEFAULT NULL COMMENT 'Optional per-variant thumbnail',
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES shop_products(id) ON DELETE CASCADE,
    INDEX idx_product (product_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Orders snapshot which variant was purchased (variant_name kept even if variant later deleted).
ALTER TABLE shop_orders
    ADD COLUMN IF NOT EXISTS variant_id INT DEFAULT NULL AFTER product_id,
    ADD COLUMN IF NOT EXISTS variant_name VARCHAR(120) DEFAULT NULL AFTER variant_id;

INSERT INTO _migrations (filename, executed_at) VALUES ('029_create_shop_product_variants.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
