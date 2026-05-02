-- Shop/Marketplace Phase 1 MVP - Database Schema
-- Creates tables for products, orders, categories, and escrow transactions

-- Categories table
CREATE TABLE IF NOT EXISTS shop_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(255),
    display_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_slug (slug),
    INDEX idx_active_order (is_active, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Products table
CREATE TABLE IF NOT EXISTS shop_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    seller_id INT NOT NULL,
    category_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    product_type ENUM('physical', 'digital') NOT NULL DEFAULT 'physical',
    price INT NOT NULL COMMENT 'Price in smallest currency unit',
    stock_quantity INT DEFAULT NULL COMMENT 'NULL = unlimited for digital',
    images JSON COMMENT 'Array of image URLs',
    digital_file_url VARCHAR(500) DEFAULT NULL COMMENT 'For digital products',
    status ENUM('draft', 'pending', 'approved', 'rejected', 'sold_out', 'archived') NOT NULL DEFAULT 'draft',
    rejection_reason TEXT,
    view_count INT DEFAULT 0,
    sold_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    approved_by INT NULL,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES shop_categories(id),
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_seller (seller_id),
    INDEX idx_category (category_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at DESC),
    FULLTEXT idx_search (title, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Orders table
CREATE TABLE IF NOT EXISTS shop_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    buyer_id INT NOT NULL,
    seller_id INT NOT NULL,
    product_id INT NOT NULL,
    product_snapshot JSON NOT NULL COMMENT 'Product details at time of purchase',
    quantity INT NOT NULL DEFAULT 1,
    unit_price INT NOT NULL,
    total_price INT NOT NULL,
    commission_rate DECIMAL(5,2) NOT NULL COMMENT 'Platform commission %',
    commission_amount INT NOT NULL,
    seller_amount INT NOT NULL COMMENT 'Amount seller receives',
    status ENUM('pending', 'confirmed', 'shipping', 'delivered', 'completed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
    payment_status ENUM('pending', 'held', 'released', 'refunded') NOT NULL DEFAULT 'pending',
    escrow_transaction_id INT NULL COMMENT 'Reference to escrow transaction',
    shipping_address JSON COMMENT 'For physical products',
    tracking_number VARCHAR(100),
    buyer_notes TEXT,
    seller_notes TEXT,
    cancellation_reason TEXT,
    cancelled_by ENUM('buyer', 'seller', 'admin') NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP NULL,
    shipped_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES shop_products(id),
    INDEX idx_order_number (order_number),
    INDEX idx_buyer (buyer_id),
    INDEX idx_seller (seller_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Escrow transactions table
CREATE TABLE IF NOT EXISTS shop_escrow_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    buyer_id INT NOT NULL,
    seller_id INT NOT NULL,
    amount INT NOT NULL,
    status ENUM('held', 'released', 'refunded') NOT NULL DEFAULT 'held',
    held_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP NULL,
    refunded_at TIMESTAMP NULL,
    notes TEXT,
    FOREIGN KEY (order_id) REFERENCES shop_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_order (order_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default categories
INSERT INTO shop_categories (name, slug, description, icon, display_order) VALUES
('Điện tử', 'dien-tu', 'Điện thoại, laptop, máy tính bảng, phụ kiện công nghệ', '📱', 1),
('Thời trang', 'thoi-trang', 'Quần áo, giày dép, túi xách, phụ kiện thời trang', '👕', 2),
('Đồ gia dụng', 'do-gia-dung', 'Nội thất, đồ dùng nhà bếp, trang trí nhà cửa', '🏠', 3),
('Sách & Văn phòng phẩm', 'sach-van-phong-pham', 'Sách, vở, bút, đồ dùng học tập và văn phòng', '📚', 4),
('Thể thao & Du lịch', 'the-thao-du-lich', 'Dụng cụ thể thao, đồ cắm trại, phụ kiện du lịch', '⚽', 5),
('Sức khỏe & Làm đẹp', 'suc-khoe-lam-dep', 'Mỹ phẩm, chăm sóc da, thực phẩm chức năng', '💄', 6),
('Digital Products', 'digital-products', 'Ebooks, khóa học online, templates, phần mềm', '💾', 7),
('Khác', 'khac', 'Các sản phẩm khác', '📦', 8);

-- Insert migration record
INSERT INTO _migrations (filename, executed_at) VALUES ('021_create_shop_tables.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
