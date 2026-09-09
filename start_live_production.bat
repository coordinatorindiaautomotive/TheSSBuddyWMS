@echo off
TITLE TheSSBuddy Enterprise WMS — 1-Click Live Production Launcher
COLOR 0A
CLS

echo ======================================================================
echo  🚀 THESSBUDDY ENTERPRISE WMS — STARTING LIVE PRODUCTION DEPLOYMENT
echo ======================================================================
echo.

echo [1/3] Building Production Optimized Frontend...
cd /d "%~dp0frontend"
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Frontend build failed!
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Registering / Starting Enterprise Backend Server...
cd /d "%~dp0backend"
start /b node src/server.js

echo.
echo [3/3] Opening Live Production WMS Portal in Browser...
timeout /t 3 /nobreak >nul
start http://localhost:5000

echo.
echo ======================================================================
echo  ✅ THESSBUDDY ENTERPRISE WMS IS NOW LIVE & RUNNING IN PRODUCTION!
echo ======================================================================
echo  🌐 Production Localhost URL: http://localhost:5000
echo  📡 Production LAN Network URL: http://172.20.25.3:5000
echo  ⚡ Auto-Sync & Database Choice: Available in Masters -> Settings
echo ======================================================================
echo.
pause
