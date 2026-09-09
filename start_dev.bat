@echo off
TITLE TheSSBuddy WMS — Local Development Launcher
COLOR 0B
echo ===================================================
echo   TheSSBuddy WMS - Starting Local Dev Servers
echo ===================================================
echo.
echo [1/2] Starting Backend Server (Port 5000)...
start "TheSSBuddy Backend" cmd /k "cd /d %~dp0backend && npm run dev"
echo.
echo [2/2] Starting Frontend Server (Port 5173)...
start "TheSSBuddy Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
echo.
echo ===================================================
echo   Servers are running!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:5000
echo ===================================================

