# Hướng dẫn Deploy & Quản lý MXH Social Network

## Thông tin hiện tại

| Thành phần | Giá trị |
|------------|---------|
| VPS IP | `203.145.47.2` |
| SSH User | `root` |
| SSH Key | `C:\Users\nguye\.ssh\id_ed25519` |
| Tên miền | `huuduyenbl.site` |
| Frontend | `https://huuduyenbl.site` |
| Backend API | `https://api.huuduyenbl.site` |
| WebSocket | `wss://ws.huuduyenbl.site` |
| Code trên VPS | `~/mxh` |

---

## Kiến trúc

```
Người dùng
    ↓ HTTPS
Cloudflare (SSL tự động)
    ↓ HTTP
Nginx (VPS 203.145.47.2)
    ├── huuduyenbl.site      → Docker frontend :5173
    ├── api.huuduyenbl.site  → Docker backend  :8000
    └── ws.huuduyenbl.site   → Docker websocket :8080
                                      ↓
                               MySQL :3306 (Docker)
```

---

## SSH vào VPS

```bash
ssh root@203.145.47.2
# hoặc dùng alias đã cấu hình:
ssh vps-ubuntu
```

---

## Chạy dự án lần đầu (VPS mới)

### 1. Cài Docker
```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER
```

### 2. Upload code
```bash
# Từ máy tính của bạn:
scp -r "C:\Users\nguye\OneDrive\Desktop\mxh_backup\mxh" root@IP_VPS:~/mxh
```

### 3. Tạo file .env trên VPS
```bash
cd ~/mxh
nano .env
```

Nội dung `.env` production:
```env
MXH_PUBLIC_HOST=huuduyenbl.site
COMPOSE_PROFILES=local-db

DB_HOST=mysql
DB_PORT=3306
DB_NAME=mxh_social
DB_USER=root
DB_PASS=root
MYSQL_ROOT_PASSWORD=root
MYSQL_PUBLISH_PORT=3307

JWT_SECRET=mxh-dev-secret-key-2024
JWT_EXPIRY=86400
DB_WAIT_TIMEOUT=120

APP_URL=https://api.huuduyenbl.site
FRONTEND_URL=https://huuduyenbl.site,http://huuduyenbl.site
VITE_API_URL=https://api.huuduyenbl.site
VITE_GRAPHQL_URL=https://api.huuduyenbl.site/graphql
VITE_WS_URL=wss://ws.huuduyenbl.site
```

### 4. Khởi động Docker
```bash
cd ~/mxh
docker compose up -d --build
docker compose exec backend php database/migrate.php
```

### 5. Cài Nginx
```bash
apt install nginx -y
```

Tạo file cấu hình:
```bash
nano /etc/nginx/sites-available/mxh
```

Nội dung:
```nginx
server {
    listen 80;
    server_name huuduyenbl.site www.huuduyenbl.site;
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.huuduyenbl.site;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name ws.huuduyenbl.site;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

Kích hoạt:
```bash
ln -s /etc/nginx/sites-available/mxh /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 6. Cấu hình DNS (Cloudflare hoặc nơi mua tên miền)

Thêm 4 A record trỏ về IP VPS:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` | `203.145.47.2` | ☁️ On |
| A | `www` | `203.145.47.2` | ☁️ On |
| A | `api` | `203.145.47.2` | ☁️ On |
| A | `ws` | `203.145.47.2` | ☁️ On |

> Cloudflare tự lo HTTPS — không cần certbot.

---

## Các lệnh thường dùng trên VPS

```bash
# Xem trạng thái containers
cd ~/mxh && docker compose ps

# Xem log
docker compose logs -f backend
docker compose logs -f frontend

# Restart toàn bộ
docker compose restart

# Rebuild sau khi update code
docker compose up -d --build

# Chỉ rebuild frontend (sau khi đổi .env)
docker compose up -d --build frontend
```

---

## Đổi VPS (chuyển sang IP mới)

### Bước 1 — Copy database
```bash
# Trên VPS cũ, backup database
docker compose exec mysql mysqldump -uroot -proot mxh_social > backup.sql
# Copy file backup về máy
scp root@203.145.47.2:~/mxh/backup.sql .
```

### Bước 2 — Setup VPS mới
Làm lại các bước từ đầu (cài Docker, upload code, cấu hình .env, cài Nginx).

### Bước 3 — Restore database
```bash
# Upload backup lên VPS mới
scp backup.sql root@IP_MOI:~/mxh/
# Restore
docker compose exec -T mysql mysql -uroot -proot mxh_social < backup.sql
```

### Bước 4 — Đổi DNS
Vào nơi mua tên miền, sửa tất cả A record:
```
203.145.47.2  →  IP_MỚI
```

---

## Đổi tên miền mới

### Bước 1 — Sửa .env trên VPS
```bash
nano ~/mxh/.env
```
Thay tất cả `huuduyenbl.site` → `tenmoimoi.com`

### Bước 2 — Sửa Nginx
```bash
nano /etc/nginx/sites-available/mxh
```
Thay tất cả `huuduyenbl.site` → `tenmoimoi.com`

### Bước 3 — Reload và rebuild
```bash
nginx -s reload
cd ~/mxh && docker compose up -d --build frontend
```

### Bước 4 — Trỏ DNS tên miền mới về IP VPS

---

## Thêm CORS cho origin mới

Nếu chạy thêm trên địa chỉ khác (ví dụ Visual Studio `localhost:5006`), thêm vào `.env`:
```env
FRONTEND_URL=https://huuduyenbl.site,http://localhost:5173,http://localhost:5006
```
Rồi rebuild backend:
```bash
docker compose up -d --build backend
```

---

## Chạy trên máy local (development)

```bash
# Khởi động Docker Desktop trước, rồi:
cd mxh
docker --context desktop-linux compose up -d

# Truy cập:
# Frontend: http://localhost:5173
# Backend:  http://localhost:8000
```

---

## Visual Studio (dùng cho bài tập)

Project C# tại: `C:\Users\nguye\source\repos\web-mxh`

- Chỉ là "cửa phụ" proxy sang PHP backend và React frontend
- Chạy: F5 trong Visual Studio → mở `http://localhost:5006`
- Dự án chính PHP/React không liên quan, vẫn chạy bình thường

---

## Lưu ý bảo mật

- Đổi `JWT_SECRET` và `DB_PASS` trước khi deploy thật (hiện đang dùng giá trị mặc định)
- Không commit file `.env` lên Git
- Backup database định kỳ
