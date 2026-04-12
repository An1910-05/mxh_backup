@echo off
title MXH - iPock Social Network
chcp 65001 >nul
cd /d "%~dp0"

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

echo [1/3] Chon che do khoi dong:
echo   1) Khoi dong nhanh  (giu nguyen container cu, khong build lai)
echo   2) Build lai + chay  (sau khi sua code backend/frontend)
echo   3) Dung tat ca container
echo   4) Xem log
echo.
set /p choice=Chon (1/2/3/4):

if "%choice%"=="1" goto start_quick
if "%choice%"=="2" goto start_build
if "%choice%"=="3" goto stop_all
if "%choice%"=="4" goto show_logs

echo Lua chon khong hop le. Thoat.
pause
exit /b 1

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

:stop_all
echo.
echo Dang dung tat ca container...
docker compose --profile local-db down
echo Da dung xong.
pause
exit /b 0

:show_logs
echo.
echo Hien thi log (Ctrl+C de thoat)...
docker compose logs -f
exit /b 0

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
pause
