# Thuyết trình Kiến trúc Hệ thống MXH — Nội dung đầy đủ 15 Slide

---

# PHẦN MỞ ĐẦU (Slide 1–3)

---

## Slide 1 — Trang bìa (Cover)

### Tiêu đề: MXH — Mạng Xã Hội

### Nội dung

```
┌─────────────────────────────────────────────┐
│                                             │
│          MXH — Mạng Xã Hội                 │
│                                             │
│     Kiến trúc hệ thống & Thiết kế kỹ thuật │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  Nhóm: [Tên nhóm]                          │
│  Ngày: [Ngày thuyết trình]                  │
│  Môn học: [Tên môn]                         │
│                                             │
└─────────────────────────────────────────────┘
```

**Stack ngắn gọn hiển thị trên cover (dạng badge):**
- React 18 · PHP 8.1 · MySQL 8 · Docker · GraphQL · WebSocket

---

## Slide 2 — Vấn đề & Bối cảnh

### Tiêu đề: Tại sao xây dựng hệ thống này?

### Nội dung chính

**Bài toán đặt ra:**

Người dùng hiện nay cần một nền tảng mạng xã hội mà:
- Kết nối được với bạn bè, chia sẻ bài viết, hình ảnh
- Nhắn tin thời gian thực, không cần reload trang
- Mua bán hàng hoá trực tuyến trong cùng nền tảng
- Giải trí nhẹ nhàng (mini-game) ngay trong ứng dụng

**Vấn đề kỹ thuật cần giải quyết:**

| Vấn đề | Yêu cầu kỹ thuật |
|--------|-----------------|
| Dữ liệu phức tạp, nhiều quan hệ | API linh hoạt, tránh over-fetch/under-fetch |
| Chat phải realtime | Kết nối hai chiều, không polling liên tục |
| Thanh toán an toàn | Escrow, tích hợp cổng thanh toán thực |
| Môi trường phát triển nhất quán | Containerisation, dễ deploy |
| Giao diện đẹp, hỗ trợ dark mode | Component-based UI, CSS custom properties |

**Phạm vi dự án — MVP (Minimum Viable Product):**

> Xây dựng đầy đủ các tính năng cốt lõi của mạng xã hội trong khuôn khổ đồ án, vận hành được thực tế, không phụ thuộc framework nặng.

---

## Slide 3 — Mục tiêu & Phạm vi

### Tiêu đề: Mục tiêu hệ thống MXH

### Nội dung chính

**Mục tiêu chức năng — 8 nhóm tính năng:**

| # | Tính năng | Trạng thái |
|---|-----------|-----------|
| 1 | Đăng ký / Đăng nhập / Quản lý hồ sơ | ✅ Hoàn thành |
| 2 | Bài viết: đăng, like, bình luận, @mention | ✅ Hoàn thành |
| 3 | Kết bạn, theo dõi, gợi ý bạn bè | ✅ Hoàn thành |
| 4 | Nhắn tin 1-1 và nhóm (realtime WebSocket) | ✅ Hoàn thành |
| 5 | Thông báo sự kiện (like, kết bạn, mention) | ✅ Hoàn thành |
| 6 | Story 24h tự xoá | ✅ Hoàn thành |
| 7 | Shop: đăng bán, đặt hàng, MoMo, GHN | ✅ Hoàn thành |
| 8 | Mini-game: Tài Xỉu, Cờ Caro | ✅ Hoàn thành |

**Mục tiêu phi chức năng:**
- **Bảo mật:** JWT stateless, SQL prepared statements, validate input
- **Khả năng mở rộng:** Phân tầng rõ ràng (Controller → Service → Repository)
- **Nhất quán môi trường:** Docker Compose chạy được trên mọi máy
- **Trải nghiệm:** Giao diện tiếng Việt, responsive desktop + mobile, dark mode

**Ngoài phạm vi (Out of scope):**
- Livestream video, gọi thoại/video
- Mobile app native (iOS/Android)
- Tích hợp AI/ML vào feed

---

# PHẦN KIẾN TRÚC (Slide 4–10)

---

## Slide 4 — Tổng quan kiến trúc hệ thống

### Tiêu đề: Kiến trúc tổng thể hệ thống MXH

### Nội dung chính

Hệ thống MXH được xây dựng theo mô hình **Client–Server** với 3 tầng rõ ràng:

```
┌──────────────────────────────────────┐
│         Trình duyệt (Client)         │
│         React 18 + Vite 5            │
└────────────────┬─────────────────────┘
                 │ HTTPS (GraphQL / REST)
                 ▼
┌────────────────────────────────────────────────────┐
│               Backend Server                        │
│         PHP 8.1 (thuần, không framework)            │
│   ┌──────────────┐     ┌─────────────────────────┐  │
│   │  HTTP Server │     │  WebSocket Server        │  │
│   │  (GraphQL +  │     │  (Ratchet — chỉ chat)   │  │
│   │   REST API)  │     └─────────────────────────┘  │
│   └──────────────┘                                   │
└────────────────────┬───────────────────────────────┘
                     │ PDO / prepared statements
                     ▼
┌──────────────────────────────────────┐
│             MySQL 8                  │
│         (InnoDB, utf8mb4)            │
└──────────────────────────────────────┘
```

**Triển khai bằng Docker Compose gồm 4 service:**

| Service | Vai trò | Cổng |
|---------|---------|------|
| `frontend` | Node.js chạy Vite dev server | 5173 |
| `backend` | PHP xử lý HTTP (GraphQL + REST) | 8000 |
| `websocket` | PHP xử lý WebSocket realtime (chat) | 8080 |
| `mysql` | Cơ sở dữ liệu MySQL 8 | 3306 |

**Điểm đáng chú ý:**
- **GraphQL là API chính** cho toàn bộ tính năng mạng xã hội
- **REST** chỉ dùng cho 4 nhóm đặc biệt: Auth, Upload, Chat, Link Preview
- **WebSocket** tách riêng thành process độc lập — không chạy chung HTTP server
- Frontend được **bind-mount** nên Vite HMR cập nhật tức thì; backend cần rebuild image mới có hiệu lực

---

## Slide 5 — Các thành phần chính

### Tiêu đề: Các module chức năng của hệ thống

### Nội dung chính

Hệ thống MXH gồm **8 nhóm tính năng** chính, mỗi nhóm tương ứng với một tập hợp Service + Repository + GraphQL Type riêng:

| # | Module | Chức năng cụ thể |
|---|--------|-----------------|
| 1 | **Xác thực (Auth)** | Đăng ký, đăng nhập, quản lý phiên JWT, xác thực email |
| 2 | **Bài viết (Post)** | Đăng bài, like, bình luận, đề cập (@mention), xem chi tiết |
| 3 | **Mạng xã hội** | Kết bạn (gửi/chấp nhận/từ chối), theo dõi (follow), gợi ý bạn bè |
| 4 | **Tin nhắn (Chat)** | Chat 1-1, chat nhóm, realtime qua WebSocket, lịch sử hội thoại |
| 5 | **Thông báo** | Nhận thông báo like/comment/kết bạn/mention — polling 45 giây |
| 6 | **Story** | Đăng ảnh/video 24h tự xoá, xem story bạn bè |
| 7 | **Shop** | Đăng bán sản phẩm, đặt hàng, escrow, thanh toán MoMo, vận chuyển GHN |
| 8 | **Mini-game** | Tài Xỉu (cược coin), Caro (đấu cờ 2 người) |

**Mỗi module tuân theo cấu trúc phân tầng 4 lớp bắt buộc:**

```
GraphQL Resolver (QueryType / MutationType)
         ↓
     Service (business logic)
         ↓
   Repository (truy vấn DB)
         ↓
    MySQL qua PDO
```

**Ví dụ module Shop** — các file liên quan:
- `ShopProductService.php` → `ShopProductRepository.php`
- `ShopOrderService.php` → `ShopOrderRepository.php`
- `ShopEscrowRepository.php` (giữ tiền trung gian)
- `MomoService.php` (tích hợp thanh toán)
- `GhnTrackingService.php` (theo dõi vận chuyển)

---

## Slide 6 — Luồng dữ liệu

### Tiêu đề: Luồng xử lý request trong hệ thống

### Nội dung chính

#### Luồng GraphQL (tính năng chính)

```
1. Người dùng thao tác trên giao diện (React)
         ↓
2. Component gọi hàm trong services/graphql.js
         ↓
3. graphql.js gọi graphqlFetch() trong services/api.js
         ↓
4. api.js gửi POST /graphql kèm:
   - Header: Authorization: Bearer {JWT_token}
   - Body: { query: "...", variables: {...} }
         ↓
5. Backend: AuthMiddleware kiểm tra JWT
   - Hợp lệ → inject $context['user']
   - Không hợp lệ → trả lỗi 401
         ↓
6. GraphQL engine phân tích query → gọi resolver
   trong QueryType.php (đọc) hoặc MutationType.php (ghi)
         ↓
7. Resolver gọi Service tương ứng
         ↓
8. Service thực thi business logic → gọi Repository
         ↓
9. Repository chạy SQL prepared statement qua PDO
         ↓
10. Kết quả trả ngược lên: DB → Repository → Service
    → Resolver → GraphQL response JSON → Frontend
         ↓
11. React cập nhật state, giao diện re-render
```

#### Luồng REST (trường hợp đặc biệt)

```
POST /auth/login   → AuthController → AuthService → trả JWT
POST /upload       → UploadController → lưu file → trả URL
GET  /chat/history → ChatController → ChatService → MessageRepository
GET  /link-preview → LinkPreviewController → fetch OG metadata
```

#### Luồng WebSocket (chat realtime)

```
Frontend (websocket.js)
   ↕ ws://host:8080
WebSocket Server (Ratchet)
   → ChatServer.php xử lý message
   → ChatProtocol.php định nghĩa giao thức
   → PresenceRepository.php theo dõi user online
   → MessageRepository.php lưu tin nhắn
```

---

## Slide 7 — Thiết kế cơ sở dữ liệu

### Tiêu đề: Thiết kế Database (MySQL)

### Nội dung chính

#### Sơ đồ quan hệ các bảng chính

```
                    ┌─────────┐
                    │  users  │
                    └────┬────┘
          ┌──────────────┼──────────────────┐
          │              │                  │
          ▼              ▼                  ▼
      ┌────────┐    ┌─────────┐      ┌──────────────┐
      │profiles│    │  posts  │      │ friendships  │
      └────────┘    └────┬────┘      │(sender/recv) │
                         │           └──────────────┘
                    ┌────┴─────┐
                    │          │
                    ▼          ▼
               ┌─────────┐ ┌──────┐
               │comments │ │likes │
               └─────────┘ └──────┘

  users ──N:N──► conversations ──1:N──► messages
  users ──1:N──► follows (follower_id → following_id)
  users ──1:N──► notifications (user_id, actor_id)
  users ──1:N──► stories
  users ──1:N──► shop_products ──1:N──► shop_orders
```

#### Quy ước đặt tên & cấu trúc

| Quy tắc | Ví dụ |
|---------|-------|
| Tên bảng: snake_case, số nhiều | `posts`, `shop_orders`, `comment_mentions` |
| Primary key | `id INT AUTO_INCREMENT PRIMARY KEY` |
| Foreign key | `user_id`, `post_id`, `conversation_id` |
| Timestamps | `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP` |
| Soft delete | `deleted_at`, `read_at` (dùng timestamp, không dùng boolean) |
| Engine | `InnoDB` cho tất cả bảng |
| Charset | `utf8mb4` (hỗ trợ emoji, tiếng Việt đầy đủ) |

#### Quản lý schema bằng Migration

- File SQL đánh số tăng dần: `001_init.sql`, `002_...sql`, ...
- Bảng `_migrations` theo dõi file đã chạy — idempotent
- Mỗi migration kết thúc bằng `INSERT INTO _migrations` để tránh chạy lại

---

## Slide 8 — API và giao tiếp

### Tiêu đề: Thiết kế API — GraphQL + REST

### Nội dung chính

#### GraphQL — API chính (endpoint duy nhất)

**Endpoint:** `POST /graphql`

**Cấu trúc schema:**
```
Schema
├── QueryType.php     ← TẤT CẢ query đọc dữ liệu
└── MutationType.php  ← TẤT CẢ mutation ghi dữ liệu
```

**Ví dụ Query tiêu biểu:**

| Query | Mô tả |
|-------|-------|
| `getPosts(limit, offset)` | Lấy danh sách bài viết feed |
| `getProfile(customUrl)` | Lấy thông tin trang cá nhân |
| `getNotifications` | Lấy thông báo của người dùng |
| `searchUsers(query)` | Tìm kiếm người dùng |
| `getConversations` | Lấy danh sách hội thoại chat |

**Ví dụ Mutation tiêu biểu:**

| Mutation | Mô tả |
|----------|-------|
| `createPost(content, images)` | Đăng bài viết mới |
| `toggleLike(postId)` | Like / unlike bài viết |
| `sendFriendRequest(userId)` | Gửi lời mời kết bạn |
| `placeOrder(productId, ...)` | Đặt mua hàng trong shop |
| `placeBet(roundId, choice)` | Đặt cược Tài Xỉu |

#### REST — 4 nhóm đặc biệt

| Nhóm | Endpoint | Lý do dùng REST |
|------|----------|-----------------|
| Auth | `POST /auth/login`, `/auth/register`, `/auth/me` | Cần trả Cookie / set token lần đầu |
| Upload | `POST /upload` | Multipart form-data, không phù hợp GraphQL |
| Chat | `GET /chat/history`, `POST /chat/send` | Tương thích WebSocket fallback |
| Link Preview | `GET /link-preview?url=...` | Proxy fetch URL bên ngoài |

---

## Slide 9 — Bảo mật và phân quyền

### Tiêu đề: Cơ chế xác thực và bảo vệ hệ thống

### Nội dung chính

#### Luồng xác thực JWT

```
[Đăng nhập]
   Người dùng gửi email + mật khẩu
         ↓
   AuthService kiểm tra DB, hash bcrypt
         ↓
   JWTHelper::encode(['user_id' => N])
   dùng thư viện firebase/php-jwt
         ↓
   Trả về JWT token (hết hạn sau 24h)
         ↓
[Lưu trữ & sử dụng]
   Frontend lưu token trong localStorage
         ↓
   Mọi request gắn header:
   Authorization: Bearer {token}
         ↓
[Kiểm tra phía backend]
   AuthMiddleware::optionalAuth() → inject $context['user']
   AuthMiddleware::requireAuth()  → trả 401 nếu không có token
   AdminMiddleware::check()       → trả 403 nếu không phải admin
```

#### 3 cấp độ phân quyền

| Cấp | Điều kiện | Áp dụng cho |
|-----|-----------|-------------|
| **Public** | Không cần token | `/auth/login`, `/auth/register` |
| **User** | JWT hợp lệ | Toàn bộ GraphQL, Upload, Chat |
| **Admin** | JWT + role = admin | `AdminController`, các mutation quản trị |

#### Bảo vệ cơ sở dữ liệu — SQL Injection Prevention

Toàn bộ truy vấn sử dụng **PDO prepared statements** với placeholder `?`:

```php
// ĐÚng — an toàn
$stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
$stmt->execute([$email]);

// SAI — tuyệt đối không làm
$pdo->query("SELECT * FROM users WHERE email = '$email'");
```

Cấu hình PDO: `ATTR_EMULATE_PREPARES => false` — buộc DB engine xử lý prepared statement thực sự.

#### Bảo mật upload file

- Kiểm tra MIME type và extension trước khi lưu
- File lưu tại `backend/uploads/` — không thể thực thi PHP
- Tên file được hash ngẫu nhiên — không đoán được đường dẫn

---

## Slide 10 — Công nghệ sử dụng

### Tiêu đề: Tech Stack của hệ thống MXH

### Nội dung chính

#### Bảng tổng hợp công nghệ

| Tầng | Công nghệ | Phiên bản | Lý do chọn |
|------|-----------|-----------|------------|
| **Frontend** | React | 18 | Component-based, hooks, ecosystem lớn |
| **Build tool** | Vite | 5 | HMR nhanh, bundle tối ưu |
| **Routing** | React Router DOM | v6 | SPA routing chuẩn |
| **Styling** | CSS thuần | — | Không overhead, toàn quyền kiểm soát |
| **Font** | Be Vietnam Pro | — | Đẹp với tiếng Việt |
| **Backend** | PHP | 8.1+ | Thuần PHP, không framework — gọn nhẹ |
| **API chính** | GraphQL | `webonyx/graphql-php` | Flexible query, 1 endpoint duy nhất |
| **Realtime** | Ratchet WebSocket | — | PHP native WebSocket cho chat |
| **Xác thực** | JWT | `firebase/php-jwt` | Stateless, dễ scale |
| **Database** | MySQL | 8 | Quan hệ, ACID, InnoDB |
| **Thanh toán** | MoMo API | — | Phổ biến tại Việt Nam |
| **Vận chuyển** | GHN API | — | Tracking đơn hàng shop |
| **Email** | PHPMailer | — | Gửi email xác thực |
| **Deploy** | Docker Compose | — | 4 service, môi trường nhất quán |

#### Sơ đồ công nghệ theo tầng

```
┌─────────────────────────────────────────┐
│  FRONTEND                               │
│  React 18 · Vite 5 · React Router v6   │
│  CSS thuần · Be Vietnam Pro             │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  BACKEND (PHP 8.1 — không framework)    │
│  GraphQL (webonyx) · REST thuần PHP     │
│  Ratchet WebSocket · PHPMailer          │
│  JWT (firebase) · bcrypt                │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  DATABASE                               │
│  MySQL 8 · InnoDB · utf8mb4             │
│  PDO prepared statements                │
└─────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  INFRASTRUCTURE                         │
│  Docker Compose · 4 service             │
│  MoMo API · GHN API                     │
└─────────────────────────────────────────┘
```

---

# PHẦN VẬN HÀNH (Slide 11–13)

---

## Slide 11 — Triển khai hệ thống

### Tiêu đề: Triển khai với Docker Compose

### Nội dung chính

#### Cấu trúc Docker Compose

```
docker-compose.yml
│
├── service: frontend   (Node 20 Alpine — Vite dev server)
│   ├── Port: 5173:5173
│   ├── bind-mount: ./frontend/src → /app/src  ← Vite HMR hoạt động
│   └── env: VITE_API_ORIGIN=http://localhost:8000
│
├── service: backend    (PHP 8.1 FPM + built-in server)
│   ├── Port: 8000:8000
│   ├── mount: uploads/ (media file)  ← KHÔNG mount code
│   └── env: DB_HOST, JWT_SECRET, MOMO_*, GHN_TOKEN, ...
│
├── service: websocket  (PHP 8.1 — Ratchet)
│   ├── Port: 8080:8080
│   └── cùng image với backend
│
└── service: mysql      (MySQL 8 — optional profile)
    ├── Port: 3306:3306
    └── volume: mysql_data (persistent)
```

**Lưu ý quan trọng về deploy:**

| Loại thay đổi | Cần làm gì |
|--------------|-----------|
| Sửa frontend (React/CSS) | Vite HMR tự cập nhật — không cần restart |
| Sửa backend (PHP) | Phải `docker compose build` + restart hoặc `docker compose cp` vào container |
| Thêm migration DB | Chạy `docker compose exec backend php database/migrate.php` |
| Thay đổi cấu hình | Sửa `.env` → restart service liên quan |

#### Quy trình khởi động (start.cmd — menu 7 lựa chọn)

```
1. Khởi động nhanh  → start containers (không rebuild)
2. Rebuild          → build lại image + start (sau khi sửa PHP)
3. Reset DB         → xoá data + migrate + seed lại
4. Migrate + Seed   → chạy SQL mới + tạo data thử
5. Restore uploads  → khôi phục ảnh/video từ backup
6. Xem log          → stream log real-time
7. Stop             → dừng toàn bộ service
```

#### Biến môi trường cần thiết (`.env`)

```
DB_HOST=mysql          DB_NAME=mxh
DB_USER=root           DB_PASS=secret
JWT_SECRET=...         JWT_EXPIRY=86400
MOMO_PARTNER_CODE=...  MOMO_ACCESS_KEY=...
GHN_TOKEN=...          GHN_SHOP_ID=...
VITE_API_ORIGIN=http://localhost:8000
```

---

## Slide 12 — Hiệu năng & Khả năng mở rộng

### Tiêu đề: Hiệu năng và chiến lược mở rộng

### Nội dung chính

#### Các cơ chế tối ưu hiện có

**1. GraphQL — tránh over-fetching**

Client chỉ request đúng fields cần thiết, không nhận dữ liệu thừa:

```graphql
# Chỉ lấy id + content + likeCount — không kéo toàn bộ bài viết
query { getPosts(limit: 10) { id content likeCount } }
```

**2. Notification polling thay vì WebSocket**

Thông báo dùng **polling 45 giây** thay vì WebSocket liên tục — giảm connection overhead vì thông báo không yêu cầu realtime tức thì. Chỉ chat mới dùng WebSocket.

**3. OG Link Preview — cache file-based**

Kết quả fetch metadata URL bên ngoài được cache tại `backend/storage/cache/og/` (hash MD5 của URL) — tránh fetch lại cùng một URL nhiều lần.

**4. PDO Persistent Connection + Connection Pooling**

`ATTR_PERSISTENT => true` trong PDO options — tái sử dụng kết nối DB thay vì tạo mới mỗi request.

**5. Image serving qua router.php**

File tĩnh `/uploads/*` được `router.php` phục vụ trực tiếp, không đi qua PHP application logic.

#### Bottleneck hiện tại & hướng xử lý

| Bottleneck | Nguyên nhân | Hướng giải quyết nếu scale |
|-----------|-------------|---------------------------|
| N+1 query trong GraphQL resolver | Mỗi post load thêm comments, likes riêng | Dataloader / batch query |
| Polling notification 45s | Tạo request DB mỗi 45s/user | Redis Pub/Sub hoặc SSE |
| WebSocket single process | Ratchet chạy 1 process PHP | Horizontal scaling + message broker |
| MySQL single instance | Một điểm ghi/đọc | Read replica khi cần |

#### Khả năng mở rộng kiến trúc hiện tại

```
Hiện tại (MVP):              Khi cần scale:
─────────────────            ──────────────────────────
1 backend container    →     Load balancer + N backend
1 websocket container  →     Redis adapter + N websocket
1 MySQL container      →     Primary + Read replica
File upload local      →     S3 / object storage
```

---

## Slide 13 — Điểm yếu & Hướng cải thiện

### Tiêu đề: Đánh giá hệ thống — Ưu điểm & Hạn chế

### Nội dung chính

#### Ưu điểm kỹ thuật

| # | Ưu điểm | Biểu hiện cụ thể |
|---|---------|-----------------|
| 1 | **Kiến trúc phân tầng rõ ràng** | Controller → Service → Repository → PDO, không lẫn lộn trách nhiệm |
| 2 | **GraphQL làm API chính** | 1 endpoint duy nhất, client tự quyết fields cần lấy, tránh over-fetch |
| 3 | **Bảo mật DB tốt** | 100% truy vấn dùng PDO prepared statements, không nối chuỗi SQL |
| 4 | **Chat realtime không polling** | WebSocket Ratchet — tin nhắn đến tức thì, không tốn request liên tục |
| 5 | **Môi trường nhất quán** | Docker Compose 4 service — chạy giống nhau trên mọi máy |
| 6 | **Tính năng đầy đủ cho MVP** | 8 nhóm tính năng hoàn chỉnh: mạng xã hội + shop + game + thanh toán |
| 7 | **Thanh toán & vận chuyển thực** | Tích hợp MoMo API + GHN tracking realtime — không mock |
| 8 | **UI đa nền tảng** | Responsive desktop + mobile, dark mode, font Be Vietnam Pro chuẩn tiếng Việt |
| 9 | **Migration có kiểm soát** | Bảng `_migrations` theo dõi, idempotent, đánh số thứ tự — tránh chạy lại |
| 10 | **Không phụ thuộc framework nặng** | Thuần PHP 8.1 + React — hiểu được toàn bộ stack, không bị "magic" framework ẩn |

#### Điểm yếu kỹ thuật (honest assessment)

| # | Hạn chế | Mức độ ảnh hưởng |
|---|---------|-----------------|
| 1 | **Notification polling 45s** — không thực sự realtime | Trung bình |
| 2 | **Backend không rebuild tự động** — sửa PHP phải rebuild image | Cao (dev workflow) |
| 3 | **Không có test tự động** — không có unit/integration test | Cao |
| 4 | **WebSocket single process** — không scale ngang được dễ dàng | Cao (khi load lớn) |
| 5 | **File upload lưu local** — mất khi container reset | Cao (production) |
| 6 | **GraphQL N+1 queries** — chưa có dataloader/batch | Trung bình |
| 7 | **JWT không có revocation** — không thể logout từ xa, hết hạn mới vô hiệu | Trung bình |
| 8 | **Không có rate limiting** — API có thể bị abuse | Trung bình |

#### Hướng cải thiện ưu tiên

**Ngắn hạn (dễ làm ngay):**
- Thêm **Server-Sent Events (SSE)** thay polling cho notification
- Thêm **volume mount code PHP** trong dev để HMR cả backend
- Viết test cho các Service quan trọng (Auth, Payment)

**Trung hạn:**
- **Redis** làm session store + WebSocket adapter + cache hot data
- Di chuyển upload lên **S3-compatible storage** (MinIO hoặc AWS S3)
- Thêm **JWT blacklist** với Redis khi user logout/bị ban

**Dài hạn (nếu scale production):**
- **GraphQL DataLoader** để giải quyết N+1
- **CI/CD pipeline** (GitHub Actions → build → test → deploy)
- **Monitoring** (Prometheus + Grafana) theo dõi latency, error rate
- Tách WebSocket service sang **Node.js** + Socket.io (nhiều driver scale hơn PHP Ratchet)

#### Bài học kinh nghiệm

> "Kiến trúc phẳng có chủ ý (không framework, không module nhỏ lẻ) giúp đội nhỏ move fast trong MVP, nhưng cần có kế hoạch rõ ràng trước khi scale để tránh nợ kỹ thuật tích luỹ."

---

*File này tổng hợp nội dung đầy đủ 13 slide (Phần mở đầu 1–3 · Kiến trúc 4–10 · Vận hành 11–13) trong bài thuyết trình hệ thống MXH.*
