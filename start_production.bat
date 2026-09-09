@echo off
echo ===================================================
echo   TheSSBuddy WMS Enterprise - Production Launcher
echo ===================================================
echo.
cd /d "%~dp0\backend"
echo [1/2] Starting WMS Enterprise Node.js Backend Server...
echo Application will run on http://localhost:5000
echo.
node src/server.js
pause

