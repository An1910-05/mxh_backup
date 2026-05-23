@echo off
title MXH - iPock Social Network
chcp 65001 >nul
cd /d "%~dp0"
setlocal EnableDelayedExpansion

:check_docker
docker info >nul 2>&1
if errorlevel 1 (
    cls
    echo ============================================
    echo   MXH - iPock Social Network
    echo ============================================
    echo.
    echo [LOI] Docker Desktop chua chay!
    echo.
    echo Mo Docker Desktop, doi vai chuc giay roi nhan phim bat ky de thu lai.
    echo Dong cua so de thoat.
    echo.
    pause >nul
    goto check_docker
)

:menu
cls
echo ============================================
echo   MXH - iPock Social Network
echo ============================================
echo.
echo   1) Khoi dong nhanh        (container cu, khong build)
echo   2) Rebuild + khoi dong    (apply update moi, tu migrate + seed + link uploads)
echo   3) Reset DB hoan toan     (xoa volume MySQL roi rebuild)
echo   4) Chay migrate + seed    (neu can sau khi DB co thay doi)
echo   5) Restore uploads        (link file anh trong uploads/ vao DB)
echo   6) Xem log
echo   7) Dung tat ca container
echo   8) Thoat
echo.
set "choice="
set /p "choice=Chon (1-8): "
if not defined choice goto menu
if "%choice%"=="1" goto start_quick
if "%choice%"=="2" goto start_build
if "%choice%"=="3" goto reset_db
if "%choice%"=="4" goto run_migrate
if "%choice%"=="5" goto run_restore_uploads
if "%choice%"=="6" goto show_logs
if "%choice%"=="7" goto stop_all
if "%choice%"=="8" goto bye
echo [LOI] Lua chon khong hop le: "%choice%"
timeout /t 2 /nobreak >nul
goto menu

:bye
echo.
echo Tam biet!
timeout /t 1 /nobreak >nul
endlocal
exit /b 0

:start_quick
echo.
echo Dang khoi dong container...
docker compose --profile local-db up -d
if errorlevel 1 goto fail
call :wait_mysql
if errorlevel 1 goto fail
call :wait_backend
call :do_migrate
if errorlevel 1 goto fail
call :auto_seed_if_empty
call :do_restore_uploads
goto done

:start_build
echo.
echo Dang rebuild va khoi dong (co the mat vai phut)...
docker compose --profile local-db down
docker compose --profile local-db up -d --build
if errorlevel 1 goto fail
call :wait_mysql
if errorlevel 1 goto fail
call :wait_backend
call :do_migrate
if errorlevel 1 goto fail
call :auto_seed_if_empty
call :do_restore_uploads
goto done

:reset_db
echo.
echo CANH BAO: Hanh dong nay XOA TOAN BO DU LIEU MySQL!
set "confirm="
set /p "confirm=Go ""yes"" de xac nhan: "
if /i not "%confirm%"=="yes" (
    echo Da huy.
    timeout /t 2 /nobreak >nul
    goto menu
)
echo Dang xoa volume va rebuild...
docker compose --profile local-db down -v
docker compose --profile local-db up -d --build
if errorlevel 1 goto fail
call :wait_mysql
if errorlevel 1 goto fail
call :wait_backend
call :do_migrate
if errorlevel 1 goto fail
call :do_seed
if errorlevel 1 goto fail
call :do_restore_uploads
goto done

:run_migrate
echo.
call :wait_mysql
if errorlevel 1 goto fail
call :do_migrate
if errorlevel 1 goto fail
call :auto_seed_if_empty
call :do_restore_uploads
echo.
pause
goto menu

:run_restore_uploads
echo.
call :wait_mysql
if errorlevel 1 goto fail
call :do_restore_uploads
echo.
pause
goto menu

:show_logs
echo.
echo === Log gan day (100 dong cuoi) ===
docker compose logs --tail 100
echo.
echo === Mo cua so log realtime trong tab moi (cua so log se mo ra) ===
start "MXH Logs" cmd /k "cd /d %~dp0 && docker compose logs -f"
echo Cua so log da mo. Dong cua so do de dung theo doi.
echo.
pause
goto menu

:stop_all
echo.
echo Dang dung tat ca container...
docker compose --profile local-db down
echo Da dung xong.
pause
goto menu

:wait_mysql
echo Cho MySQL san sang...
set /a tries=0
:wait_mysql_loop
docker compose exec -T mysql mysqladmin ping -h localhost -uroot -proot --silent >nul 2>&1
if not errorlevel 1 (
    echo   [OK] MySQL ready
    exit /b 0
)
set /a tries+=1
if %tries% GEQ 60 (
    echo   [LOI] MySQL khong san sang sau 120s.
    exit /b 1
)
timeout /t 2 /nobreak >nul
goto wait_mysql_loop

:wait_backend
echo Cho backend san sang...
set /a tries=0
:wait_backend_loop
curl -s -o NUL -w "%%{http_code}" -X POST -H "Content-Type: application/json" -d "{\"query\":\"{__typename}\"}" http://localhost:8000/graphql 2>nul | findstr /R "^200$" >nul
if not errorlevel 1 (
    echo   [OK] Backend ready
    exit /b 0
)
set /a tries+=1
if %tries% GEQ 60 (
    echo   [CANH BAO] Backend chua phan hoi 200 sau 120s. Tiep tuc nhung co the phai check log.
    exit /b 0
)
timeout /t 2 /nobreak >nul
goto wait_backend_loop

:do_migrate
echo.
echo Dang chay migrations...
docker compose exec -T backend php database/migrate.php
if errorlevel 1 (
    echo.
    echo   [LOI] Migrate that bai. Log backend 30 dong cuoi:
    echo.
    docker compose logs --tail 30 backend
    exit /b 1
)
echo   [OK] Migrate xong
exit /b 0

:do_seed
echo.
echo Dang seed du lieu mau...
docker compose exec -T backend php database/seed.php
if errorlevel 1 (
    echo   [LOI] Seed that bai.
    exit /b 1
)
echo   [OK] Seed xong (login: alice@example.com / password123)
exit /b 0

:do_restore_uploads
echo.
echo Dang link anh trong uploads/ vao DB...
docker compose exec -T backend php database/restore_uploads.php
if errorlevel 1 (
    echo   [CANH BAO] Restore uploads loi - khong critical.
    exit /b 0
)
echo   [OK] Restore uploads xong
exit /b 0

:auto_seed_if_empty
echo.
docker compose exec -T mysql mysql -uroot -proot mxh_social -N -B -e "SELECT COUNT(*) FROM users;" 2>nul | findstr /R "^0$" >nul
if not errorlevel 1 (
    echo   DB chua co user, tu seed...
    call :do_seed
) else (
    echo   DB da co user, skip seed.
)
exit /b 0

:fail
echo.
echo [LOI] Thao tac that bai. Goi y kiem tra:
echo   docker compose ps
echo   docker compose logs --tail 50
echo.
pause
goto menu

:done
echo.
docker compose ps
echo.
echo ============================================
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:8000
echo   WebSocket: ws://localhost:8080
echo   MySQL    : localhost:3307 (root/root)
echo ============================================
echo   Login mau: alice@example.com / password123
echo ============================================
echo.
pause
goto menu
