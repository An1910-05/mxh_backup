#!/usr/bin/env bash
# Chạy từ thư mục gốc dự án MXH (chmod +x start-docker.sh trên Linux/VPS).
# 1 = MySQL trong Docker (profile local-db). 2 = MySQL ngoài — xem deploy/VPS.md
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

normalize_host() {
  local t="${1//[$'\t\r\n']/}"
  t="${t#"${t%%[![:space:]]*}"}"
  t="${t%"${t##*[![:space:]]}"}"
  [[ -z "$t" ]] && { echo ""; return; }
  t="${t#http://}"
  t="${t#https://}"
  t="${t%%/*}"
  t="${t%%:*}"
  echo "$t"
}

echo ""
echo "=== MXH — Chọn cách chạy database ==="
echo "  1) MySQL trong Docker trên máy này (COMPOSE_PROFILES=local-db)"
echo "  2) MySQL bên ngoài — máy nhà / máy khác (không chạy container MySQL)"
echo ""
read -r -p "Chọn 1 hoặc 2: " choice

host_val="localhost"
db_remote=""

if [[ "$choice" == "2" ]]; then
  echo ""
  read -r -p "MXH_PUBLIC_HOST (IP/domain người dùng mở trình duyệt): " inp
  norm="$(normalize_host "$inp")"
  if [[ -n "$norm" ]]; then
    host_val="$norm"
  fi
  echo ""
  read -r -p "DB_HOST (IP máy nhà / Tailscale; Enter = REPLACE_WITH_HOME_DB_HOST): " db_in
  if [[ -n "${db_in// }" ]]; then
    db_remote="$db_in"
  fi
else
  echo ""
  echo "Chọn Local hay IP/domain (LAN/VPS)?"
  echo "  1) Local — localhost"
  echo "  2) LAN/VPS — nhập IP hoặc domain"
  read -r -p "Chọn 1 hoặc 2: " sub
  if [[ "$sub" == "2" ]]; then
    read -r -p "Nhập IP hoặc domain: " inp
    norm="$(normalize_host "$inp")"
    [[ -n "$norm" ]] && host_val="$norm"
  fi
fi

if [[ "$choice" == "2" ]]; then
  db_line="${db_remote:-REPLACE_WITH_HOME_DB_HOST}"
  cat > .env << EOF
# MXH — Docker Compose (tạo bởi start-docker.sh)
MXH_PUBLIC_HOST=$host_val
# Không dùng container MySQL — không đặt COMPOSE_PROFILES=local-db

DB_HOST=$db_line
DB_PORT=3306
DB_NAME=mxh_social
DB_USER=root
DB_PASS=root
JWT_SECRET=mxh-dev-secret-key-2024
JWT_EXPIRY=86400

# Xem deploy/VPS.md: VPN, SSH tunnel, HTTPS (APP_URL / FRONTEND_URL / VITE_*)
EOF
else
  cat > .env << EOF
# MXH — Docker Compose (tạo bởi start-docker.sh)
MXH_PUBLIC_HOST=$host_val
COMPOSE_PROFILES=local-db

DB_HOST=mysql
DB_PORT=3306
DB_NAME=mxh_social
DB_USER=root
DB_PASS=root
MYSQL_ROOT_PASSWORD=root
JWT_SECRET=mxh-dev-secret-key-2024
JWT_EXPIRY=86400
EOF
fi

echo ""
echo "Đã ghi .env  =>  MXH_PUBLIC_HOST=$host_val"
echo "Frontend: http://${host_val}:5173"
echo ""

docker compose up -d --build

echo ""
echo "Đang chờ container (5s)..."
sleep 5
docker compose ps
echo ""
if [[ "$choice" == "1" ]]; then
  echo "Tiếp theo (lần đầu):"
  echo "  docker compose exec backend php database/migrate.php"
  echo "  docker compose exec backend php database/seed.php"
else
  echo "Kiểm tra DB_HOST và MySQL tại máy nhà (xem deploy/VPS.md), rồi:"
  echo "  docker compose exec backend php database/migrate.php"
fi
