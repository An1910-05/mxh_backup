@echo off
title MXH - iPock Social Network
chcp 65001 >nul
cd /d "%~dp0"

:menu
cls
echo.
echo ============================================
echo   MXH - iPock Social Network
echo ============================================
echo.

:: Kiem tra Docker dang chay khong
docker info >nul 2>&1
if errorlevel 1 (
    echo [LOI] Docker Desktop chua chay!
    echo Hay mo Docker Desktop roi chay lai file nay.
    pause
    exit /b 1
)

echo Chon che do:
echo.
echo   [KHOI DONG]
echo   1) Khoi dong nhanh       (container cu, khong build)
echo   2) Rebuild + khoi dong   (khi sua Dockerfile / package.json / backend PHP)
echo   3) Apply compose changes (khi sua docker-compose.yml: down + build + up)
echo.
echo   [XEM LOG]
echo   4) Log tat ca
echo   5) Log frontend only     (theo doi Vite HMR khi sua .jsx/.css)
echo.
echo   [TIEN ICH]
echo   6) Dung tat ca container
echo   7) Reset node_modules    (khi doi package.json hoac esbuild loi binding)
echo   8) Verify source mount   (kiem tra volume frontend da mount dung)
echo   9) Thoat
echo.
set /p choice=Chon (1-9):

if "%choice%"=="1" goto start_quick
if "%choice%"=="2" goto start_build
if "%choice%"=="3" goto apply_compose
if "%choice%"=="4" goto show_logs_all
if "%choice%"=="5" goto show_logs_fe
if "%choice%"=="6" goto stop_all
if "%choice%"=="7" goto reset_node_modules
if "%choice%"=="8" goto verify_mount
if "%choice%"=="9" exit /b 0

echo Lua chon khong hop le. Vui long thu lai.
timeout /t 2 /nobreak >nul
goto menu

:start_quick
echo.
echo Dang khoi dong container...
docker compose --profile local-db up -d
goto done

:start_build
echo.
echo Dang build va khoi dong container (co the mat vai phut)...
docker compose --profile local-db up -d --build
goto done

:apply_compose
echo.
echo Dang ap dung thay doi docker-compose.yml...
echo (down -^> build -^> up --force-recreate de pick up volume moi)
docker compose --profile local-db down
docker compose --profile local-db build
docker compose --profile local-db up -d --force-recreate
goto done

:show_logs_all
echo.
echo Hien thi log tat ca (Ctrl+C de thoat)...
docker compose --profile local-db logs -f
echo.
echo Da thoat xem log. Quay lai menu...
timeout /t 2 /nobreak >nul
goto menu

:show_logs_fe
echo.
echo Hien thi log frontend (Ctrl+C de thoat)...
echo Khi ban sua .jsx/.css tren host, se thay dong: "hmr update /src/..."
echo Neu khong thay -^> volume mount chua active, chon option 3.
echo.
docker compose --profile local-db logs -f frontend
echo.
echo Da thoat xem log. Quay lai menu...
timeout /t 2 /nobreak >nul
goto menu

:stop_all
echo.
echo Dang dung tat ca container...
docker compose --profile local-db down
echo Da dung xong.
pause
goto menu

:reset_node_modules
echo.
echo CANH BAO: Se xoa named volume frontend_node_modules va cai lai.
set /p confirm=Tiep tuc? (y/n):
if /i not "%confirm%"=="y" goto menu
echo.
docker compose --profile local-db down
docker volume rm mxh_frontend_node_modules 2>nul
docker compose --profile local-db build frontend
docker compose --profile local-db up -d
echo Da reset node_modules xong.
goto done

:verify_mount
echo.
echo Kiem tra volume frontend da mount source tu host chua...
echo.
echo --- Line count file TaiXiuFloatingWidget.jsx trong container ---
docker compose exec frontend wc -l /app/src/components/TaiXiuFloatingWidget.jsx 2>nul
if errorlevel 1 (
    echo [LOI] Container frontend chua chay. Hay chon option 1 hoac 2 truoc.
    pause
    goto menu
)
echo.
echo --- Line count file tren host (Windows) ---
find /c /v "" "frontend\src\components\TaiXiuFloatingWidget.jsx"
echo.
echo Neu hai so KHOP -^> volume mount OK, HMR se hoat dong.
echo Neu KHONG khop -^> chon option 3 de apply compose changes.
echo.
pause
goto menu

:done
echo.
echo Dang cho container san sang...
timeout /t 5 /nobreak >nul
echo.
docker compose ps
echo.
echo ============================================
echo   Truy cap ung dung tai:
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:8000
echo   WebSocket: ws://localhost:8080
echo ============================================
echo.
echo MEO: Sau khi sua file .jsx/.css tren Windows, Vite HMR se tu
echo reload browser trong 1-2 giay. Khong can restart container.
echo Chon option 5 de theo doi log HMR.
echo.
pause
goto menu
