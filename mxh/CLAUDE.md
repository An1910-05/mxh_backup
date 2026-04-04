# CLAUDE.md — Quy luật bắt buộc cho AI model làm việc với project MXH

> File này là **nguồn sự thật duy nhất** về cấu trúc, quy ước, và ràng buộc của project.
> Mọi AI model (Claude, GPT, Copilot, v.v.) **PHẢI đọc file này trước** khi viết hoặc sửa bất kỳ dòng code nào.
> Vi phạm bất kỳ mục nào dưới đây = code sai, cần rollback.

---

## 1. Tổng quan kiến trúc — KHÔNG ĐƯỢC thay đổi

```
mxh/
├── backend/          # PHP 8.1+, KHÔNG dùng framework (thuần PHP)
│   ├── public/
│   │   ├── index.php       # Entry point — routing REST + GraphQL
│   │   └── router.php      # Phục vụ file tĩnh /uploads/, delegate index.php
│   ├── src/
│   │   ├── Config/          # Database.php, PdoOptions.php
│   │   ├── Controllers/     # Chỉ dùng cho REST (Auth, Upload, Chat, LinkPreview)
│   │   ├── GraphQL/
│   │   │   ├── Schema.php        # Build schema (query + mutation)
│   │   │   ├── TypeRegistry.php  # Singleton registry cho tất cả GraphQL types
│   │   │   ├── Queries/QueryType.php      # TẤT CẢ queries trong 1 file
│   │   │   ├── Mutations/MutationType.php # TẤT CẢ mutations trong 1 file
│   │   │   └── Types/              # Mỗi type 1 file (PostType.php, UserType.php, ...)
│   │   ├── Helpers/         # Hàm tiện ích (Response, JWT, Mention)
│   │   ├── Middleware/      # CORS, Auth (JWT Bearer)
│   │   ├── Repositories/   # Truy vấn DB trực tiếp (PDO, prepared statements)
│   │   ├── Services/        # Business logic, gọi Repository
│   │   ├── Validators/      # Validate input
│   │   └── WebSocket/       # ChatServer (Ratchet) — CHỈ cho chat
│   ├── database/
│   │   ├── migrations/      # SQL files theo thứ tự 001_, 002_, ...
│   │   ├── migrate.php      # Runner
│   │   └── seed.php         # Tài khoản thử
│   └── uploads/             # File user upload (avatar, media, cover)
├── frontend/         # React 18 + Vite 5, KHÔNG TypeScript
│   └── src/
│       ├── components/      # UI components tái sử dụng
│       ├── contexts/        # React Context (Auth, Chat)
│       ├── hooks/           # Custom hooks
│       ├── mobile/          # Layout + components + hooks riêng cho mobile
│       ├── pages/           # Mỗi trang 1 file (*Page.jsx)
│       ├── services/        # API layer (api.js, graphql.js, auth.js, chat.js, websocket.js)
│       ├── config.js        # API_ORIGIN từ env
│       ├── App.jsx          # Routing + AppShell (desktop/mobile)
│       └── main.jsx         # Entry point
└── docker-compose.yml
```

**CỨNG — KHÔNG ĐƯỢC:**
- Thêm framework PHP (Laravel, Symfony, Slim)
- Chuyển sang TypeScript
- Thêm state management (Redux, Zustand, MobX)
- Thay đổi cấu trúc thư mục hiện tại
- Tách `QueryType.php` hoặc `MutationType.php` thành nhiều file
- Đổi cổng mặc định trong code (8000, 8080, 5173 — chỉ đổi qua env)

---

## 2. Quy ước backend (PHP)

### 2.1 Phân tầng bắt buộc — 4 lớp

```
Controller (REST) hoặc QueryType/MutationType (GraphQL)
    ↓ gọi
Service (business logic)
    ↓ gọi
Repository (truy vấn DB)
    ↓ dùng
PDO (qua Database::getConnection())
```

**Quy tắc:**
- **Controller** KHÔNG được gọi trực tiếp Repository → phải qua Service
- **Service** KHÔNG được `echo` hoặc trả HTTP response
- **Repository** KHÔNG được chứa business logic → chỉ CRUD thuần
- **GraphQL resolver** (trong QueryType/MutationType) được gọi Service trực tiếp
- **MỌI truy vấn DB** phải dùng prepared statements (`?` placeholder), KHÔNG BAO GIỜ nối chuỗi SQL
- PDO config: `ATTR_EMULATE_PREPARES => false`, `FETCH_ASSOC`, `ERRMODE_EXCEPTION`

### 2.2 Đặt tên file và class

| Loại | Đặt tên | Ví dụ |
|------|---------|-------|
| Repository | `{Entity}Repository.php` | `PostRepository.php` |
| Service | `{Entity}Service.php` | `PostService.php` |
| Controller | `{Entity}Controller.php` | `AuthController.php` |
| GraphQL Type | `{Entity}Type.php` | `PostType.php` |
| Validator | `{Entity}Validator.php` | `PostValidator.php` |
| Helper | `{Name}Helper.php` hoặc `{Name}.php` | `MentionHelper.php`, `Response.php` |
| Migration | `{NNN}_{mô_tả}.sql` | `011_notifications_mentions_location.sql` |

- Namespace: `App\{Thư_mục}` — ví dụ `App\Services`, `App\Repositories`
- Autoload: PSR-4 (`"App\\": "src/"` trong composer.json)

### 2.3 Thêm tính năng mới — checklist bắt buộc

Khi thêm một entity/tính năng mới (ví dụ: "Reaction"), PHẢI tạo **đầy đủ** các file theo thứ tự:

1. **Migration SQL** — `database/migrations/{NNN_kế_tiếp}_{tên}.sql`
   - Cuối file PHẢI có: `INSERT INTO _migrations (filename, executed_at) VALUES ('{filename}', NOW()) ON DUPLICATE KEY UPDATE executed_at = NOW();`
   - Dùng `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` khi có thể
2. **Repository** — `src/Repositories/{Entity}Repository.php`
3. **Service** — `src/Services/{Entity}Service.php`
4. **GraphQL Type** — `src/GraphQL/Types/{Entity}Type.php`
5. **Đăng ký Type** — thêm vào `src/GraphQL/TypeRegistry.php` (property static + method)
6. **Query/Mutation** — thêm field vào `QueryType.php` và/hoặc `MutationType.php`
7. **Frontend service** — thêm hàm vào `frontend/src/services/graphql.js`
8. **Frontend page/component** — tạo hoặc sửa file trong `pages/` hoặc `components/`
9. **Route** — thêm `<Route>` vào `App.jsx` nếu cần trang mới
10. **Navbar/TabBar** — cập nhật nếu thêm tab mới

**KHÔNG ĐƯỢC bỏ qua bước nào.** Thiếu bước = tính năng không hoạt động.

### 2.4 GraphQL — quy ước

- **Tất cả queries** nằm trong `QueryType.php` — KHÔNG tách file
- **Tất cả mutations** nằm trong `MutationType.php` — KHÔNG tách file
- **Mỗi Type** 1 file riêng trong `Types/` và PHẢI đăng ký trong `TypeRegistry.php`
- `TypeRegistry` dùng **singleton pattern** (`??=`) — KHÔNG tạo instance mới
- Resolver cần auth: kiểm tra `$context['user']` hoặc gọi `self::requireAuth($context)`
- Auth context đến từ `AuthMiddleware::optionalAuth()` trong `handleGraphQL()` ở `index.php`

### 2.5 REST — quy ước

- Route đăng ký bằng `switch(true)` trong `public/index.php`
- Controller nhận request, gọi Service, trả JSON qua `Response::success()` hoặc `Response::error()`
- Auth: `AuthMiddleware::requireAuth()` hoặc `AuthMiddleware::optionalAuth()`
- **GraphQL là API chính** cho hầu hết tính năng — REST chỉ dùng cho: Auth, Upload, Chat REST, Link Preview

### 2.6 Authentication

- JWT Bearer token trong header `Authorization: Bearer {token}`
- Tạo/verify: `JWTHelper.php` dùng `firebase/php-jwt`
- Secret: env `JWT_SECRET`, expiry: env `JWT_EXPIRY` (mặc định 86400s = 24h)
- Frontend lưu token trong `localStorage` (key: `token`)

---

## 3. Quy ước frontend (React)

### 3.1 Stack — KHÔNG thay đổi

- **React 18** — functional components + hooks, KHÔNG class components
- **Vite 5** — bundler
- **React Router DOM v6** — routing
- **CSS thuần** — `styles.css` (desktop), `mobile/mobile.css` (mobile)
- **KHÔNG TypeScript**, KHÔNG Tailwind, KHÔNG CSS modules, KHÔNG styled-components
- **KHÔNG state management** ngoài React Context (AuthContext, ChatContext)

### 3.2 Đặt tên file

| Loại | Đặt tên | Ví dụ |
|------|---------|-------|
| Page | `{Name}Page.jsx` | `NotificationsPage.jsx` |
| Component | `{Name}.jsx` (PascalCase) | `PostCard.jsx`, `Navbar.jsx` |
| Hook | `use{Name}.js` | `useAuth.js`, `useNotificationUnread.js` |
| Context | `{Name}Context.jsx` | `AuthContext.jsx` |
| Service | `{name}.js` (camelCase) | `graphql.js`, `api.js` |

### 3.3 API layer — quy ước gọi API

```
Component/Page
    ↓ gọi
services/graphql.js (cho GraphQL) hoặc services/api.js (cho REST)
    ↓ gọi
graphqlFetch() hoặc restFetch() (trong api.js)
    ↓
fetch() tới backend
```

**Quy tắc:**
- **graphql.js**: chứa TẤT CẢ hàm gọi GraphQL — mỗi hàm export 1 query/mutation
- **api.js**: chứa `graphqlFetch()`, `restFetch()`, `uploadFile()` — KHÔNG chứa business logic
- **auth.js**: chứa hàm login, register, logout, getMe
- **chat.js**: chứa hàm REST cho chat
- **websocket.js**: WebSocket client cho chat realtime
- **KHÔNG tạo file service mới** — thêm hàm vào file hiện có
- Token tự động gắn qua `authHeaders()` trong `api.js`

### 3.4 Routing

- Tất cả routes trong `App.jsx`
- Route cần đăng nhập: bọc bằng `<ProtectedRoute>`
- Route công khai: chỉ `/login` và `/register`
- Route `/:customUrl` là catch-all cho profile — PHẢI đặt cuối cùng

### 3.5 Layout Desktop vs Mobile

- Desktop (> 768px): `<Navbar />` trên cùng
- Mobile (≤ 768px): `<MobileLayout>` bao gồm `MobileHeader` + `MobileTabBar`
- Logic chọn layout: `AppShell` trong `App.jsx` dùng `useIsMobile()`
- **Khi thêm tab mới:** PHẢI cập nhật CẢ `Navbar.jsx` VÀ `MobileTabBar.jsx`
- **Khi thêm badge:** dùng hook pattern giống `useNotificationUnread.js`

### 3.6 Ngôn ngữ giao diện

- UI hiển thị bằng **tiếng Việt** (label, placeholder, thông báo lỗi, trạng thái)
- Code (biến, hàm, comment kỹ thuật) bằng **tiếng Anh**
- Ví dụ đúng: `<button>Đăng nhập</button>`, `const [loading, setLoading] = useState(false)`
- Ví dụ sai: `<button>Login</button>`, `const [dangNhap, setDangNhap] = useState(false)`

---

## 4. Database — quy ước

### 4.1 Migration

- File SQL trong `backend/database/migrations/`, đánh số `{NNN}_` tăng dần (001, 002, ...)
- Bảng `_migrations` theo dõi file đã chạy — migration runner: `database/migrate.php`
- Chạy: `docker compose exec backend php database/migrate.php`
- **Mỗi migration PHẢI INSERT vào `_migrations`** ở cuối file
- **KHÔNG SỬA migration đã chạy** — tạo migration mới để ALTER
- Dùng `IF NOT EXISTS` / `IF EXISTS` khi có thể để migration idempotent

### 4.2 Schema conventions

- Tên bảng: **snake_case, số nhiều** (`posts`, `users`, `notifications`, `comment_mentions`)
- Tên cột: **snake_case** (`user_id`, `created_at`, `read_at`)
- Primary key: `id INT AUTO_INCREMENT PRIMARY KEY`
- Foreign key: `{entity}_id` (ví dụ `user_id`, `post_id`)
- Timestamps: `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- Soft delete: dùng timestamp (`read_at`, `deleted_at`) thay vì boolean
- Engine: `InnoDB` cho mọi bảng
- Charset: `utf8mb4` (set ở connection level trong PdoOptions)

### 4.3 Quan hệ hiện tại (KHÔNG phá vỡ)

```
users ──1:1──> profiles
users ──1:N──> posts
users ──1:N──> comments
users ──1:N──> likes
users ──N:N──> users (friendships: sender_id, receiver_id)
users ──1:N──> follows (follower_id → following_id)
users ──1:N──> notifications (user_id = người nhận, actor_id = người tạo)
users ──1:N──> stories
posts ──1:N──> comments
posts ──1:N──> likes
posts ──N:N──> users (post_mentions)
comments ──N:N──> users (comment_mentions)
users ──N:N──> conversations (conversation_participants)
conversations ──1:N──> messages
```

---

## 5. WebSocket — quy ước

- WebSocket CHỈ dùng cho **chat realtime** — process riêng `bin/websocket-server.php`
- Server: Ratchet (`IoServer → HttpServer → WsServer → ChatServer`)
- **KHÔNG dùng WebSocket cho notification** — notification dùng polling (45 giây)
- Frontend client: `services/websocket.js`
- Protocol: MTProto-inspired (xem `ChatProtocol.php`)

---

## 6. Docker — quy ước

- 4 services: `backend` (PHP), `websocket` (PHP), `frontend` (Node), `mysql` (optional profile)
- Network: `mxh_net` (bridge)
- Volumes: `mysql_data` (DB), `backend/uploads` (media files)
- Env vars: đọc từ `.env` ở root project
- **KHÔNG sửa Dockerfile** trừ khi thêm system dependency
- **KHÔNG thêm service mới** vào docker-compose mà không hỏi user

---

## 7. Lỗi thường gặp — AI model HAY MẮC

### 7.1 Quên đăng ký GraphQL Type

Tạo `Types/XyzType.php` nhưng quên:
- Thêm `private static ?XyzType $xyz = null;` vào `TypeRegistry.php`
- Thêm `public static function xyz(): XyzType { ... }` vào `TypeRegistry.php`
→ Lỗi runtime: "Type Xyz not found"

### 7.2 Quên thêm field vào frontend GraphQL query

Backend có field mới nhưng `graphql.js` không request field đó trong query string.
→ Frontend nhận `undefined` cho field đó.

### 7.3 Tạo file service frontend mới thay vì thêm vào file hiện có

Project dùng **1 file `graphql.js` cho tất cả GraphQL calls**. KHÔNG tạo `notificationApi.js`, `postApi.js`, v.v.

### 7.4 Dùng TypeScript / .tsx

Project là **JavaScript thuần**. KHÔNG có tsconfig, KHÔNG dùng `.tsx` hay `.ts`.

### 7.5 Quên cập nhật cả Navbar và MobileTabBar

Thêm tab vào `Navbar.jsx` nhưng quên `MobileTabBar.jsx` (hoặc ngược lại).
→ Desktop có tab, mobile không có (hoặc ngược lại).

### 7.6 Nuốt lỗi bằng `catch {}`

**KHÔNG viết `catch {}` hoặc `catch { /* ignore */ }`** — ít nhất phải `console.error(err)`.
Lỗi này đã gây ra bug "thông báo không hoạt động" (xem README.md mục phân tích lỗi).

### 7.7 Quên migration record

Migration SQL cuối file PHẢI có:
```sql
INSERT INTO _migrations (filename, executed_at) VALUES ('NNN_name.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
```
Nếu thiếu → migration chạy lại lần sau sẽ báo lỗi duplicate.

### 7.8 Thêm notification type nhưng quên frontend label

Backend tạo notification type mới (ví dụ `'like'`) nhưng quên thêm vào `TYPE_LABEL` trong `NotificationsPage.jsx`.
→ Frontend hiển thị raw type string thay vì label tiếng Việt.

### 7.9 Sửa cấu trúc thư mục

KHÔNG di chuyển, đổi tên, hoặc tạo thư mục con mới trong `src/` mà không hỏi user.
Cấu trúc hiện tại là **cố ý phẳng** — đừng "tổ chức lại" thành nhiều lớp con.

---

## 8. Quy tắc cập nhật README.md — BẮT BUỘC

> **Mọi thay đổi đáng kể về dự án ĐỀU PHẢI được ghi vào `README.md`.**
> Không cần chờ "tính năng lớn" — bất kỳ thứ gì thêm/sửa/xóa có thể ảnh hưởng đến người đọc/dev tiếp theo đều phải ghi.

### 8.1 Những thay đổi cần ghi vào README.md

| Loại thay đổi | Bắt buộc ghi? |
|---|---|
| Thêm tính năng mới (dù nhỏ) | ✅ Bắt buộc |
| Thêm migration DB | ✅ Bắt buộc |
| Thêm/sửa GraphQL query/mutation | ✅ Bắt buộc |
| Thêm component/page mới | ✅ Bắt buộc |
| Sửa luồng xử lý hiện có (logic, UI) | ✅ Bắt buộc |
| Cập nhật dependency/cấu hình | ✅ Bắt buộc |
| Sửa bug nhỏ, refactor nội bộ | ⚠️ Nên ghi nếu ảnh hưởng hành vi |
| Sửa typo, comment trong code | ❌ Không cần |

### 8.2 Format ghi vào README.md

Luôn ghi vào mục **"Cập nhật gần đây"** ở đầu README.md. Mỗi entry theo format:

```markdown
## Cập nhật gần đây

- **[Tên tính năng/thay đổi]:** Mô tả ngắn gọn điều đã thay đổi và lý do.
  - File liên quan: `path/to/file.php`, `path/to/component.jsx`
  - Migration (nếu có): `backend/database/migrations/NNN_ten.sql`
```

### 8.3 Quy tắc cụ thể

- Ghi **trước khi kết thúc task** — không để sau
- Dùng **tiếng Việt** trong README
- Giữ mỗi entry **ngắn gọn** (2–4 dòng), không cần giải thích chi tiết implementation
- **Không xóa** các entry cũ trừ khi tính năng đó đã bị loại bỏ hoàn toàn
- Nếu entry cũ bị thay thế bởi thay đổi mới, **cập nhật** entry cũ thay vì thêm mới

---

## 9. Checklist nhanh trước khi hoàn thành task

- [ ] Code mới tuân thủ phân tầng (Controller/Resolver → Service → Repository)?
- [ ] Mọi query DB dùng prepared statements?
- [ ] GraphQL Type mới đã đăng ký trong TypeRegistry?
- [ ] Query/Mutation mới đã thêm vào QueryType/MutationType?
- [ ] Frontend `graphql.js` đã thêm hàm tương ứng?
- [ ] Hàm frontend request đủ fields cần thiết?
- [ ] Migration SQL có `INSERT INTO _migrations` ở cuối?
- [ ] Cập nhật cả Navbar.jsx VÀ MobileTabBar.jsx nếu thêm tab?
- [ ] UI label bằng tiếng Việt?
- [ ] Không nuốt lỗi bằng `catch {}` trống?
- [ ] Không tạo file/thư mục mới khi có thể thêm vào file hiện có?
- [ ] **README.md đã cập nhật theo quy tắc mục 8?** ← KHÔNG ĐƯỢC BỎ QUA
