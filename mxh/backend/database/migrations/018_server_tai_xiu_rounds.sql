-- Chuyển Tài Xỉu sang server-driven rounds
-- Mỗi phiên server chạy 30 giây, mọi người đặt cược, hết giờ server lăn xúc xắc 1 lần

-- 1. Thêm status + betting_deadline vào tai_xiu_rounds
SET @s1 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tai_xiu_rounds' AND COLUMN_NAME = 'status');
SET @q1 = IF(@s1 = 0,
    'ALTER TABLE tai_xiu_rounds ADD COLUMN status ENUM(''betting'',''finished'') NOT NULL DEFAULT ''finished'' AFTER id, ADD COLUMN betting_deadline TIMESTAMP NULL DEFAULT NULL AFTER status',
    'SELECT 1');
PREPARE stmt1 FROM @q1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

-- 2. Cho phép dice/total/result_key NULL (dùng cho phiên đang betting chưa có kết quả)
ALTER TABLE tai_xiu_rounds
    MODIFY dice_1 TINYINT UNSIGNED NULL DEFAULT NULL,
    MODIFY dice_2 TINYINT UNSIGNED NULL DEFAULT NULL,
    MODIFY dice_3 TINYINT UNSIGNED NULL DEFAULT NULL,
    MODIFY total   TINYINT UNSIGNED NULL DEFAULT NULL,
    MODIFY result_key ENUM('tai','xiu') NULL DEFAULT NULL;

-- 3. Thêm is_pending vào tai_xiu_bets
SET @s2 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tai_xiu_bets' AND COLUMN_NAME = 'is_pending');
SET @q2 = IF(@s2 = 0,
    'ALTER TABLE tai_xiu_bets ADD COLUMN is_pending TINYINT(1) NOT NULL DEFAULT 0 AFTER bet_amount',
    'SELECT 1');
PREPARE stmt2 FROM @q2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- 4. Cho phép result fields trong bets NULL (chờ phiên resolve)
ALTER TABLE tai_xiu_bets
    MODIFY result_key    ENUM('tai','xiu') NULL DEFAULT NULL,
    MODIFY did_win       TINYINT(1) NULL DEFAULT NULL,
    MODIFY net_amount    INT NULL DEFAULT NULL,
    MODIFY balance_after INT NULL DEFAULT NULL;

INSERT INTO _migrations (filename) VALUES ('018_server_tai_xiu_rounds')
ON DUPLICATE KEY UPDATE filename = filename;
