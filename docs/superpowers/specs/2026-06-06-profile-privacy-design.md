# Thiết kế: Chế độ trang cá nhân Public / Private

**Ngày:** 2026-06-06
**Trạng thái:** Đã duyệt thiết kế, chờ kế hoạch triển khai

## 1. Mục tiêu

Cho phép người dùng đặt trang cá nhân ở chế độ **Public** hoặc **Private**.

- **Public** (mặc định): bất kỳ ai cũng xem được bài viết, story, thông tin trang cá nhân.
- **Private**: chỉ **bạn bè** (`friendships.status = 'accepted'`) mới xem được. **Người theo dõi không phải bạn bè cũng không xem được.**

## 2. Quy tắc lõi

Hàm trung tâm `canView(viewer, owner)` trả về `true` khi **một trong** các điều sau đúng:

1. Chủ tài khoản (`owner`) đang ở chế độ **public** (`is_private = 0`), HOẶC
2. `viewer === owner` (chính chủ luôn xem được nội dung của mình), HOẶC
3. `viewer` và `owner` là **bạn bè** (`friendships.status = 'accepted'`).

Mọi trường hợp còn lại → `false` (bị chặn). Viewer ẩn danh (chưa đăng nhập) + owner private → luôn `false`.

## 3. Phạm vi (đã chốt với user)

| Quyết định | Lựa chọn |
|---|---|
| Khi private, ẩn cái gì | **Khóa gần như toàn bộ** — chỉ chừa avatar + tên + nút kết bạn |
| Story | **Cũng khóa** theo cùng quy tắc canView |
| Tìm kiếm & lời mời kết bạn | **Vẫn hiển thị** trong tìm kiếm (chỉ avatar + tên), **vẫn nhận** được lời mời kết bạn |
| Màn hình khóa | Hiện thông báo *"Tài khoản này ở chế độ riêng tư. Kết bạn để xem bài viết."* + nút kết bạn |
| Mặc định | **Public** cho tất cả tài khoản hiện tại và tài khoản mới |

**Ngoài phạm vi:** Hoạt động của user private trên nội dung công khai của người khác (bình luận / like / mention) **không** bị ẩn — quyền riêng tư chỉ áp lên trang/bài/story của *chính họ*.

## 4. Kiến trúc (Hướng 1 — cổng tập trung + lọc SQL)

### 4.1 Database — migration `031_add_profile_privacy.sql`

```sql
ALTER TABLE users ADD COLUMN is_private TINYINT(1) NOT NULL DEFAULT 0;
INSERT INTO _migrations (filename, executed_at)
VALUES ('031_add_profile_privacy.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
```

`DEFAULT 0` = public, giữ nguyên hành vi hiện tại. Tự chạy qua `migrate.php` (glob tất cả `*.sql`).

### 4.2 Cổng kiểm tra — `App\Services\PrivacyService` (mới)

Nguồn sự thật duy nhất cho quyền xem. Phụ thuộc `UserRepository` + `FriendshipRepository`.

- `canView(?int $viewerId, int $ownerId): bool` — dùng cho query 1 chủ thể.
- `friendIds(int $viewerId): array` — cấp danh sách id bạn bè để dựng bộ lọc feed.

Cài đặt `canView`:
1. Lấy `owner = userRepo->findById(ownerId)`; nếu `is_private == 0` → `true`.
2. Nếu `viewerId === ownerId` → `true`.
3. Nếu `viewerId === null` → `false`.
4. Ngược lại: `friendRepo->getFriendshipStatus(viewerId, ownerId) === 'accepted'`.

### 4.3 Repository

- **UserRepository**
  - Thêm `u.is_private` vào danh sách cột của `findById` (hiện liệt kê tường minh, không `SELECT *`).
  - Thêm `setPrivacy(int $userId, bool $isPrivate): bool`.
- **PostRepository** — `findAll` và `findByUserIds` nhận thêm tham số `?int $viewerId = null, array $friendIds = []`:
  - Chèn điều kiện: `AND (u.is_private = 0 OR p.user_id = :viewer OR p.user_id IN (:friendIds...))`.
  - Khi `viewerId === null`: `AND u.is_private = 0`.
  - Khi `friendIds` rỗng: chỉ còn `is_private = 0 OR p.user_id = :viewer`.
  - Giữ `LIMIT/OFFSET` sau bộ lọc → phân trang vẫn đúng.
- **StoryRepository** — `findFeedStories` lọc tác giả tương tự.

### 4.4 Service

- **PostService**
  - `getUserPosts(userId, ..., viewer)`: nếu `!canView(viewer, userId)` → trả `[]`.
  - `getPost(postId, viewer)`: lấy author của post; nếu `!canView(viewer, author)` → ném `RuntimeException(403)`.
  - `getPosts(..., viewer)`: truyền `viewer + friendIds` xuống `postRepo->findAll`.
  - `getFeed(userId, ...)`: truyền `userId + friendIds` xuống `postRepo->findByUserIds` (user theo dõi nhưng private + không phải bạn sẽ bị loại; bài của chính mình luôn qua nhờ `p.user_id = viewer`).
- **ProfileService**
  - `getProfile(userId, viewer)`: thêm `is_private` (setting của chủ) và `is_locked` (= `is_private && !canView(viewer, userId)`).
  - Khi `is_locked == true`: chỉ trả `user_id, username, avatar, is_private, is_locked, friendship_status, friendship_id, friendship_is_sender`; các field còn lại (bio, cover, *_count, ...) trả `null`/`0`.
  - Thêm `setPrivacy(int $userId, bool $isPrivate): array` → cập nhật rồi trả `getProfile(userId, userId)`.
- **StoryService**
  - `getFeedStories(viewer)`: lọc nhóm tác giả theo canView (own + following trừ private-không-phải-bạn).
  - `getUserStories(userId, viewer)`: gọi `canView`, không thấy → `[]`.
- **AuthService.getFullUser**: bảo đảm trả kèm `is_private` (dùng `findByIdFull` = `SELECT *` nên đã có; chỉ cần expose field cho settings response).

### 4.5 GraphQL

- **ProfileType** (`Types/ProfileType.php`): thêm field `is_private: Boolean`, `is_locked: Boolean`.
- **MutationType**: thêm mutation `setPrivacy(isPrivate: Boolean!): Profile` → gọi `ProfileService->setPrivacy(userId, isPrivate)`, yêu cầu auth.
- Các query gating được xử lý ở tầng Service (resolver chỉ truyền `currentUserId`).

### 4.6 Frontend

- **services/graphql.js**
  - Thêm `is_private`, `is_locked` vào query lấy profile (`getProfile` / `getProfileByCustomUrl`).
  - Thêm hàm `setPrivacy(isPrivate)` gọi mutation tương ứng.
- **services/auth.js**: `getSettings` request thêm `is_private` (REST `/auth/settings` đã trả; chỉ cần dùng).
- **SettingsPage.jsx**: thêm mục **"Quyền riêng tư"** vào mảng `sections` (icon khóa) + component `SectionPrivacy` chứa công tắc Public/Private gọi `setPrivacy`, hiển thị trạng thái hiện tại + thông báo thành công/lỗi.
- **ProfilePage.jsx** (và bản mobile nếu tách riêng): khi `profile.is_locked` → render thẻ khóa (*"Tài khoản này ở chế độ riêng tư. Kết bạn để xem bài viết."*) + nút kết bạn; bỏ qua fetch `userPosts`/stories, ẩn cover/bio/số liệu.

### 4.7 start.cmd & README

- **start.cmd**: migration 031 tự chạy qua `do_migrate` (glob) → **không cần label mới**. Vì sửa backend code, áp dụng bằng **bước 2 (Rebuild)**, không phải bước 1 (Khởi động nhanh). Không phát sinh script init mới.
- **README.md**: thêm entry vào mục "Cập nhật gần đây" theo CLAUDE.md §8.

## 5. Điểm chặn rò rỉ (checklist phủ)

- [x] `userPosts` (trang cá nhân)
- [x] `post(id)` (xem 1 bài qua link trực tiếp)
- [x] `posts` (bảng tin chung / khám phá)
- [x] `feed` (bảng tin theo following)
- [x] `feedStories` + stories của 1 user
- [x] Payload `getProfile` (ẩn thông tin khi khóa)

## 6. Kiểm thử

- Backend: mint JWT bằng `JWTHelper::encode(['user_id'=>N])` trong container, curl `/graphql` với 3 vai: chính chủ, bạn bè, người-theo-dõi-không-phải-bạn → xác nhận bài/story/profile hiện hoặc bị khóa đúng.
- Frontend: bật Private ở Settings, xem trang cá nhân bằng tài khoản khác (đã follow nhưng chưa kết bạn) → thấy màn hình khóa; sau khi kết bạn → thấy đầy đủ.
- Nhớ **Rebuild (bước 2)** để nạp thay đổi backend trước khi test.
