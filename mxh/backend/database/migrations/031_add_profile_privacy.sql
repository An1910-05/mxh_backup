-- Thêm chế độ riêng tư cho trang cá nhân.
-- is_private = 0 (public, mặc định): ai cũng xem được bài viết/story/profile.
-- is_private = 1 (private): chỉ bạn bè (friendships.status = 'accepted') mới xem được.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_private TINYINT(1) NOT NULL DEFAULT 0;

INSERT INTO _migrations (filename, executed_at)
VALUES ('031_add_profile_privacy.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
