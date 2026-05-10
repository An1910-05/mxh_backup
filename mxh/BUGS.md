# MXH — Danh sách lỗi & vấn đề kỹ thuật

> File này ghi lại toàn bộ bug, vấn đề còn tồn đọng, và các lỗi đã được sửa trong dự án.
> Cập nhật lần cuối: 2026-05-11

---

## Đã sửa (Fixed)

### [FIX-002] Migration 019 + 020 lỗi syntax trên MySQL 8.0
- **Mức độ:** Nghiêm trọng (chặn migrate.php → backend không khởi tạo được DB mới)
- **Phát hiện:** 2026-05-11
- **Sửa:** 2026-05-11
- **Mô tả:** Cả 019 và 020 dùng `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` và `CREATE INDEX IF NOT EXISTS`. Cú pháp này **chỉ tồn tại trên MariaDB** — MySQL 8.0 báo lỗi 1064 (`syntax error near 'IF NOT EXISTS'`). Hậu quả: `docker compose exec backend php database/migrate.php` dừng tại 019, không chạy được 020 và 021 (shop tables) trên DB mới. Ngoài ra file 019 còn thiếu hàng `INSERT INTO _migrations` cuối file → kể cả nếu chạy được, runner sẽ vẫn cố chạy lại lần sau.
- **File sửa:** `backend/database/migrations/019_add_role_to_users.sql`, `backend/database/migrations/020_group_chat_phase1.sql`
- **Cách sửa:** Đổi sang `ALTER TABLE ... ADD COLUMN ...` và `CREATE INDEX ...` thuần. Idempotency được đảm bảo bởi bảng `_migrations` (migrate.php không chạy lại file đã có entry). Bổ sung `INSERT INTO _migrations ('019_add_role_to_users.sql', NOW())` cuối 019. Backfill `_migrations` cho DB hiện tại đã có columns/indexes: `INSERT INTO _migrations (filename) VALUES ('019_...'),('020_...')`.

### [FIX-003] Trang Thông báo nuốt lỗi tải → người dùng không phân biệt được “rỗng” vs “lỗi” (BUG-002)
- **Mức độ:** Nhỏ (UX / debug)
- **Phát hiện:** 2026-04 (BUGS.md cũ)
- **Sửa:** 2026-05-11
- **Mô tả:** `NotificationsPage.jsx` catch lỗi của `getNotifications()` rồi set `items=[]` mà không có state lỗi → user thấy “Chưa có thông báo” trong cả 2 trường hợp.
- **File sửa:** `frontend/src/pages/NotificationsPage.jsx`
- **Cách sửa:** Thêm state `error`, set bên trong `.catch()`, render khối thông báo lỗi riêng (`Lỗi tải thông báo: {error}`) khi `error` tồn tại; đồng thời `console.error` cho dev DevTools (đã có sẵn).

### [FIX-001] `leaflet` thiếu trong `package.json`
- **Mức độ:** Nghiêm trọng (build lỗi)
- **Phát hiện:** 2026-04-14
- **Sửa:** 2026-04-14
- **Mô tả:** `LocationPicker.jsx` import `leaflet` và `leaflet/dist/leaflet.css` nhưng gói này không có trong `dependencies` của `frontend/package.json`. Khi vite build gặp `LocationPicker`, quá trình build thất bại hoàn toàn.
- **File lỗi:** `frontend/src/components/LocationPicker.jsx:2`
- **File sửa:** `frontend/package.json`
- **Cách sửa:** Thêm `"leaflet": "^1.9.4"` vào `dependencies`.
- **Lưu ý:** Cần rebuild Docker image frontend (`docker compose up -d --build frontend`) hoặc chạy `npm install` trong `frontend/` để áp dụng.

### [FIX-BUG-001] LikeService — Không có thông báo khi ai đó like bài viết
- **Mức độ:** Trung bình
- **Phát hiện:** 2026-04
- **Sửa:** đã được áp dụng (xác nhận lại 2026-05-11)
- **File sửa:** `backend/src/Services/LikeService.php`, `frontend/src/pages/NotificationsPage.jsx`
- **Cách sửa:** `LikeService::likePost()` đã insert `NotificationRepository::insert($postOwnerId, 'like', ...)` khi like mới (kiểm tra `$isNew` và `$postOwnerId !== $userId`). `TYPE_LABEL` trong `NotificationsPage.jsx` đã có entry `like: 'đã thích bài viết của bạn'`.

---

## Còn tồn đọng (Open)

### [BUG-003] Migration 011 không idempotent nếu chạy thủ công lần 2
- **Mức độ:** Vận hành (rủi ro thấp khi đi qua migrate.php)
- **File:** `backend/database/migrations/011_notifications_mentions_location.sql`
- **Mô tả:** Các câu `ALTER TABLE posts ADD COLUMN location_label ...` và tương tự trên `comments` không có `IF NOT EXISTS` (MySQL 8.0 không hỗ trợ). Nếu ai đó apply file thủ công (vd `mysql < 011_...sql`) trên DB đã chạy migration → MySQL báo `Duplicate column name`.
- **Tình trạng:** Khi đi qua `migrate.php`, runner kiểm tra `_migrations` trước khi chạy → an toàn. Đã thêm comment cảnh báo ở đầu file. Không có cách viết idempotent thuần SQL trên MySQL 8.0 mà vẫn tương thích với migrate.php (runner split theo `;` nên không dùng được stored procedure).
- **Khuyến nghị:** Luôn chạy migration qua `docker compose exec backend php database/migrate.php`, không apply file thủ công.

---

## Lỗi đã ghi nhận trong lịch sử (Historical)

### [HIST-001] `websocket.js` — Error detection không hoạt động với unsend/hide
- **Phát hiện & Sửa:** 2025-04
- **Mô tả:** `handleFrame` từng truyền chỉ `data` vào callback, khiến `unsendMessage` / `hideMessage` không phát hiện được lỗi từ server.
- **Cách sửa:** Tách `resolve` / `reject` rõ ràng và check `frame.type === 'error'` trong `handleFrame`.
- **File:** `frontend/src/services/websocket.js`
