@echo off
title MXH - iPock Social Network
chcp 65001 >nul
cd /d "%~dp0"

:menu
cls
echo ============================================
echo   MXH - iPock Social Network
echo ============================================
echo.

docker info >nul 2>&1
if errorlevel 1 (
    echo [LOI] Docker Desktop chua chay! Mo Docker Desktop roi thu lai.
    pause
    exit /b 1
)

echo   1) Khoi dong nhanh        (container cu, khong build)
echo   2) Rebuild + khoi dong    (apply update moi)
echo   3) Xem log
echo   4) Dung tat ca container
echo   5) Thoat
echo.
set /p choice=Chon (1-5):

if "%choice%"=="1" goto start_quick
if "%choice%"=="2" goto start_build
if "%choice%"=="3" goto show_logs
if "%choice%"=="4" goto stop_all
if "%choice%"=="5" exit /b 0

echo Lua chon khong hop le.
timeout /t 2 /nobreak >nul
goto menu

:start_quick
echo.
echo Dang khoi dong container...
docker compose --profile local-db up -d
goto done

:start_build
echo.
echo Dang rebuild va khoi dong (co the mat vai phut)...
docker compose --profile local-db down
docker compose --profile local-db up -d --build
goto done

:show_logs
echo.
echo Hien thi log (Ctrl+C de thoat)...
docker compose --profile local-db logs -f
goto menu

:stop_all
echo.
echo Dang dung tat ca container...
docker compose --profile local-db down
echo Da dung xong.
pause
goto menu

:done
echo.
timeout /t 5 /nobreak >nul
docker compose ps
echo.
echo ============================================
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:8000
echo   WebSocket: ws://localhost:8080
echo ============================================
echo.
pause
goto menu
