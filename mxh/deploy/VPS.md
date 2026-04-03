# Triển khai MXH trên VPS + MySQL tại máy nhà

Tài liệu này mô tả cách chạy **ứng dụng (Docker) trên VPS** trong khi **MySQL chỉ chạy trên máy tính ở nhà**, nhằm giảm RAM/chi phí VPS. Kết nối DB từ xa cần **an toàn** — không nên mở MySQL ra Internet kiểu “1.2.3.4:3306 mật khẩu yếu”.

## Tóm tắt kiến trúc

| Thành phần | Vị trí |
|------------|--------|
| `frontend`, `backend`, `websocket` | VPS (Docker Compose) |
| MySQL | Máy nhà (cài đặt trực tiếp hoặc Docker tại nhà) |
| Người dùng | Truy cập website qua IP/domain VPS |

Container `mysql` trong `docker-compose.yml` chỉ bật khi có **profile** `local-db`. Trên VPS **không** bật profile này; `DB_HOST` trỏ tới máy nhà (hoặc tunnel).

## Các cách kết nối VPS ↔ MySQL nhà (khuyến nghị theo độ an toàn)

### 1) VPN mesh (khuyến nghị): Tailscale / ZeroTier / WireGuard

- Cài VPN trên **VPS** và **máy nhà**.
- MySQL tại nhà chỉ **listen** trên IP VPN (ví dụ Tailscale `100.x.y.z`), **không** cần mở port 3306 ra modem.
- Trong `.env` trên VPS: `DB_HOST=<IP Tailscale của máy nhà>`, `DB_PORT=3306`.
- Tạo user MySQL chỉ cho host VPN, ví dụ: `CREATE USER 'mxh'@'100.%' IDENTIFIED BY '...';` (tùy dải IP VPN).

**Ưu điểm:** Không lộ MySQL ra Internet; ổn định khi IP nhà thay đổi (nếu dùng tên máy Tailscale).

### 2) SSH tunnel (VPS kết nối “vào” nhà)

- Trên **máy nhà** hoặc router, thiết lập SSH server để VPS đăng nhập được (hoặc ngược lại: máy nhà `ssh -R` tới VPS — cần hiểu rõ bảo mật).
- Trên VPS, chạy tunnel ví dụ: cổng local `127.0.0.1:3307` → MySQL tại nhà `127.0.0.1:3306`.
- Trong `.env`: `DB_HOST=127.0.0.1`, `DB_PORT=3307`.

**Ưu điểm:** MySQL không cần public; traffic qua SSH.

### 3) Mở port MySQL trên modem + firewall (rủi ro cao hơn)

Chỉ dùng nếu hiểu rõ:

- **Port forward** modem: `WAN:3306` → `PC_Nhà:3306`.
- Trên máy nhà: firewall chỉ cho **IP công khai của VPS** vào cổng 3306.
- MySQL: user `IDENTIFIED BY` mạnh; có thể bật `require ssl` và mount CA vào container backend (`DB_SSL_CA`, `DB_SSL_VERIFY` trong `.env`).
- IP VPS thay đổi → cập nhật rule firewall.

**Nhược điểm:** Tấn công brute-force vào MySQL trên Internet; cần mật khẩu mạnh + (nên) SSL.

### 4) Dynamic DNS

Nếu IP nhà thay đổi, dùng DDNS + một trong các cách trên (VPN hoặc firewall theo IP VPS).

## Cấu hình `.env` trên VPS (không dùng container MySQL)

Tạo file `.env` cạnh `docker-compose.yml`:

```env
MXH_PUBLIC_HOST=tenmien-cua-ban.com

# Quan trọng: không bật profile local-db
# (xóa dòng COMPOSE_PROFILES hoặc để trống)

DB_HOST=<IP hoặc hostname máy nhà / Tailscale>
DB_PORT=3306
DB_NAME=mxh_social
DB_USER=mxh_remote
DB_PASS=<mật khẩu mạnh>

JWT_SECRET=<chuỗi ngẫu nhiên dài>

# HTTPS (sau khi có reverse proxy + chứng chỉ)
APP_URL=https://api.tenmien-cua-ban.com
FRONTEND_URL=https://tenmien-cua-ban.com
VITE_API_URL=https://api.tenmien-cua-ban.com
VITE_GRAPHQL_URL=https://api.tenmien-cua-ban.com/graphql
VITE_WS_URL=wss://api.tenmien-cua-ban.com:8080
```

**CORS:** `FRONTEND_URL` phải **khớp chính xác** origin trình duyệt (gồm `https://`, không có dấu `/` cuối trừ khi bạn cố ý).

## MySQL trên máy nhà

1. Tạo database `mxh_social` (hoặc trùng `DB_NAME`).
2. Tạo user cho phép kết nối từ IP VPS hoặc dải VPN, ví dụ:

```sql
CREATE USER 'mxh_remote'@'%' IDENTIFIED BY '...';
-- hoặc hạn chế: 'mxh_remote'@'IP_VPS' / 'mxh_remote'@'100.%'
GRANT ALL PRIVILEGES ON mxh_social.* TO 'mxh_remote'@'%';
FLUSH PRIVILEGES;
```

3. `bind-address` trong `my.cnf`: với VPN, thường bind `0.0.0.0` hoặc IP VPN; **không** mở public nếu không cần.

## Khởi động trên VPS

```bash
docker compose up -d --build
docker compose exec backend php database/migrate.php
# tùy chọn: docker compose exec backend php database/seed.php
```

**Không** chạy `docker compose --profile local-db up` trên kiểu triển khai này (sẽ thêm container MySQL trên VPS).

## Reverse proxy + HTTPS (truy cập Internet “bình thường”)

Trỏ DNS domain về IP VPS. Dùng **Caddy** hoặc **Nginx** làm reverse proxy:

- `https://tenmien.com` → frontend `:5173`
- `https://api.tenmien.com` → backend `:8000`
- WebSocket `wss://` cùng host API hoặc subdomain — cần `Upgrade` / `Connection` headers.

Xem file mẫu: `deploy/nginx-mxh.example.conf` (chỉnh domain và đường dẫn chứng chỉ).

Sau khi có HTTPS, **bắt buộc** cập nhật `APP_URL`, `FRONTEND_URL`, `VITE_*` như trên và **restart** frontend container để Vite nhận biến môi trường.

## Kiểm tra nhanh

1. Từ VPS: `docker compose exec backend php -r "new PDO('mysql:host='.getenv('DB_HOST').';port='.getenv('DB_PORT'), getenv('DB_USER'), getenv('DB_PASS'));"`  
   (hoặc dùng `mysql` client nếu có).
2. Mở `https://...` (hoặc `http://IP:5173` khi chưa có TLS) — đăng nhập, tạo bài, chat.
3. Xem log: `docker compose logs -f backend websocket`.

## Ghi chú bảo mật

- Đổi `JWT_SECRET` production; không commit file `.env`.
- Giới hạn ai được phép kết nối MySQL (VPN / firewall / user host cụ thể).
- Sao lưu định kỳ database tại máy nhà.
