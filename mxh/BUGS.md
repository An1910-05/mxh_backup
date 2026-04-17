# MXH — Danh sách lỗi & vấn đề kỹ thuật

> File này ghi lại toàn bộ bug, vấn đề còn tồn đọng, và các lỗi đã được sửa trong dự án.
> Cập nhật lần cuối: 2026-04-17

---

## Đã sửa (Fixed)

### [FIX-001] `leaflet` thiếu trong `package.json`
- **Mức độ:** Nghiêm trọng (build lỗi)
- **Phát hiện:** 2026-04-14
- **Sửa:** 2026-04-14
- **Mô tả:** `LocationPicker.jsx` import `leaflet` và `leaflet/dist/leaflet.css` nhưng gói này không có trong `dependencies` của `frontend/package.json`. Khi vite build gặp `LocationPicker`, quá trình build thất bại hoàn toàn.
- **File lỗi:** `frontend/src/components/LocationPicker.jsx:2`
- **File sửa:** `frontend/package.json`
- **Cách sửa:** Thêm `"leaflet": "^1.9.4"` vào `dependencies`.
- **Lưu ý:** Cần rebuild Docker image frontend (`docker compose up -d --build frontend`) hoặc chạy `npm install` trong `frontend/` để áp dụng.

---

## Còn tồn đọng (Open)

### [BUG-001] Không có thông báo khi ai đó like bài viết
- **Mức độ:** Trung bình
- **File:** `backend/src/Services/LikeService.php` — method `likePost()`
- **Mô tả:** `LikeService::likePost()` tạo bản ghi trong bảng `likes` nhưng **không gọi `NotificationRepository::insert()`** → chủ bài viết không bao giờ nhận được thông báo khi bài bị like. Frontend `NotificationsPage.jsx` (mảng `TYPE_LABEL`) cũng không khai báo loại `like`, xác nhận tính năng chưa được triển khai.
- **Cách sửa đề xuất:**

  **Backend** — thêm vào `LikeService::likePost()` sau khi tạo like thành công:
  ```php
  $postOwnerId = (int)$post['user_id'];
  if ($postOwnerId !== $userId) {
      (new NotificationRepository())->insert($postOwnerId, 'like', $userId, $postId, null);
  }
  ```

  **Frontend** — thêm vào mảng `TYPE_LABEL` trong `NotificationsPage.jsx`:
  ```js
  like: 'đã thích bài viết của bạn',
  ```

---

### [BUG-002] Lỗi trong notification hook bị nuốt im lặng
- **Mức độ:** Nhỏ (UX / debug)
- **File 1:** `frontend/src/hooks/useNotificationUnread.js`
- **File 2:** `frontend/src/pages/NotificationsPage.jsx`
- **Mô tả:** Mọi lỗi (token hết hạn, DB chưa tồn tại, lỗi mạng, lỗi GraphQL) đều bị bắt và bỏ qua hoàn toàn. Người dùng chỉ thấy badge = 0 và danh sách trống — không thể phân biệt "chưa có thông báo" với "đang lỗi".

  ```js
  // useNotificationUnread.js
  } catch { /* ignore */ }

  // NotificationsPage.jsx
  .catch(() => setItems([]))
  ```

- **Cách debug tạm thời:** Mở DevTools → Network → lọc `/graphql` → xem response của `notificationUnreadCount` và `notifications`.
- **Cách sửa đề xuất:** Thêm state lỗi vào `NotificationsPage.jsx`:
  ```jsx
  const [error, setError] = useState(null);
  // ...
  .catch((err) => { setError(err.message); setItems([]); })
  // ...
  {error && <div className="apple-empty">Lỗi tải thông báo: {error}</div>}
  ```

---

### [BUG-003] Migration 011 có thể lỗi khi chạy lại
- **Mức độ:** Vận hành
- **File:** `backend/database/migrations/011_notifications_mentions_location.sql`
- **Mô tả:** Migration 011 chứa các câu `ALTER TABLE posts ADD COLUMN ...` và `ALTER TABLE comments ADD COLUMN ...`. Nếu chạy lại khi cột đã tồn tại, MySQL báo lỗi `Duplicate column name` → migration dừng giữa chừng, bảng `notifications` có thể không được tạo. Hậu quả: mọi GraphQL query liên quan đến notifications ném exception → bị nuốt ở frontend → biểu hiện như "không có thông báo nào".
- **Kiểm tra:**
  ```bash
  docker compose exec backend php database/migrate.php
  # Hoặc trong MySQL:
  SHOW TABLES LIKE 'notifications';
  SELECT * FROM _migrations WHERE filename = '011_notifications_mentions_location.sql';
  ```
- **Cách sửa đề xuất:** Dùng `ADD COLUMN IF NOT EXISTS` (MySQL 8.0+) trong migration, hoặc kiểm tra cột trước khi ALTER trong `migrate.php`.

---

## Lỗi đã ghi nhận trong lịch sử (Historical)

### [HIST-001] `websocket.js` — Error detection không hoạt động với unsend/hide
- **Phát hiện & Sửa:** 2025-04
- **Mô tả:** `handleFrame` từng truyền chỉ `data` vào callback, khiến `unsendMessage` / `hideMessage` không phát hiện được lỗi từ server.
- **Cách sửa:** Tách `resolve` / `reject` rõ ràng và check `frame.type === 'error'` trong `handleFrame`.
- **File:** `frontend/src/services/websocket.js`
