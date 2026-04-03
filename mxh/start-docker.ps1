# Chạy từ thư mục gốc dự án MXH. Ghi .env rồi docker compose up --build.
# 1 = MySQL trong Docker (profile local-db). 2 = MySQL ngoài (máy nhà / VPS khác) — xem deploy/VPS.md
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location $root

function Normalize-HostInput([string]$raw) {
  $t = $raw.Trim()
  if ([string]::IsNullOrWhiteSpace($t)) { return $null }
  $t = $t -replace '^\s*https?://', ''
  $t = ($t -split '/')[0]
  $t = ($t -split ':')[0]
  return $t.Trim()
}

Write-Host ''
Write-Host '=== MXH — Chọn cách chạy database ===' -ForegroundColor Cyan
Write-Host '  1) MySQL trong Docker trên máy này (dev đơn giản, COMPOSE_PROFILES=local-db)'
Write-Host '  2) MySQL bên ngoài — máy nhà / máy khác (không chạy container MySQL; cần DB_HOST trong .env)'
Write-Host ''
$choice = Read-Host 'Chon 1 hoac 2'

$hostValue = 'localhost'
$dbHostRemote = $null

if ($choice -eq '2') {
  Write-Host ''
  Write-Host 'Nhap MXH_PUBLIC_HOST (IP/domain nguoi dung mo trinh duyet, vd: 203.0.113.10 hoac tenmien.com)' -ForegroundColor Yellow
  $inp = Read-Host 'MXH_PUBLIC_HOST'
  $norm = Normalize-HostInput $inp
  if ($null -eq $norm -or [string]::IsNullOrWhiteSpace($norm)) {
    Write-Host 'Khong hop le — dung localhost.' -ForegroundColor Yellow
  } else {
    $hostValue = $norm
  }
  Write-Host ''
  $dbIn = Read-Host 'DB_HOST (IP may nha / Tailscale; Enter de ghi REPLACE_WITH_HOME_DB_HOST va sua sau)'
  if (-not [string]::IsNullOrWhiteSpace($dbIn)) {
    $dbHostRemote = $dbIn.Trim()
  }
} else {
  Write-Host ''
  Write-Host 'Chon Local (localhost) hay IP/domain (LAN/VPS)?' -ForegroundColor Cyan
  Write-Host '  1) Local    — localhost'
  Write-Host '  2) LAN/VPS  — nhap IP hoac domain'
  $sub = Read-Host 'Chon 1 hoac 2'
  if ($sub -eq '2') {
    $inp = Read-Host 'Nhap IP hoac domain'
    $norm = Normalize-HostInput $inp
    if ($null -ne $norm -and -not [string]::IsNullOrWhiteSpace($norm)) {
      $hostValue = $norm
    }
  }
}

$envPath = Join-Path $root '.env'

if ($choice -eq '2') {
  $dbLine = if ($null -ne $dbHostRemote) { $dbHostRemote } else { 'REPLACE_WITH_HOME_DB_HOST' }
  @(
    '# MXH — Docker Compose (tạo bởi start-docker.ps1)',
    "MXH_PUBLIC_HOST=$hostValue",
    '# Không dùng container MySQL trên máy này — xóa hoặc không đặt COMPOSE_PROFILES=local-db',
    '',
    "DB_HOST=$dbLine",
    'DB_PORT=3306',
    'DB_NAME=mxh_social',
    'DB_USER=root',
    'DB_PASS=root',
    'JWT_SECRET=mxh-dev-secret-key-2024',
    'JWT_EXPIRY=86400',
    '',
    '# Xem deploy/VPS.md: VPN, SSH tunnel, firewall, HTTPS (APP_URL / FRONTEND_URL / VITE_*)'
  ) | Set-Content -Path $envPath -Encoding utf8
} else {
  @(
    '# MXH — Docker Compose (tạo bởi start-docker.ps1)',
    "MXH_PUBLIC_HOST=$hostValue",
    'COMPOSE_PROFILES=local-db',
    '',
    'DB_HOST=mysql',
    'DB_PORT=3306',
    'DB_NAME=mxh_social',
    'DB_USER=root',
    'DB_PASS=root',
    'MYSQL_ROOT_PASSWORD=root',
    'JWT_SECRET=mxh-dev-secret-key-2024',
    'JWT_EXPIRY=86400'
  ) | Set-Content -Path $envPath -Encoding utf8
}

Write-Host ''
Write-Host "Da ghi $envPath" -ForegroundColor Green
Write-Host "MXH_PUBLIC_HOST=$hostValue"
Write-Host ''
Write-Host 'Frontend: http://' -NoNewline; Write-Host "$hostValue" -NoNewline -ForegroundColor Yellow; Write-Host ':5173'
Write-Host ''

docker compose up -d --build

Write-Host ''
Write-Host 'Dang cho container (5s)...'
Start-Sleep -Seconds 5
docker compose ps
Write-Host ''
if ($choice -eq '1') {
  Write-Host 'Tiep theo (lan dau):' -ForegroundColor Cyan
  Write-Host '  docker compose exec backend php database/migrate.php'
  Write-Host '  docker compose exec backend php database/seed.php'
} else {
  Write-Host 'Kiem tra DB_HOST trong .env va mo MySQL cho VPS (xem deploy/VPS.md), roi:' -ForegroundColor Cyan
  Write-Host '  docker compose exec backend php database/migrate.php'
}
