-- 030_add_shipping_carrier.sql
-- Thêm cột lưu đơn vị vận chuyển cho đơn hàng shop (mặc định J&T Express).
-- Chỉ áp dụng cho sản phẩm vật lý; sản phẩm số (auto-deliver) không dùng.
ALTER TABLE shop_orders
    ADD COLUMN IF NOT EXISTS shipping_carrier VARCHAR(50) NULL AFTER tracking_number;

INSERT INTO _migrations (filename, executed_at) VALUES ('030_add_shipping_carrier.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
