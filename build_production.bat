@echo off
echo ===================================================
echo   TheSSBuddy WMS Enterprise - Production Builder
echo ===================================================
echo.
echo [1/3] Installing Frontend Dependencies...
cd /d "%~dp0\frontend"
call npm install
echo.
echo [2/3] Building Optimized Production React Bundle...
call npm run build
echo.
echo [3/3] Installing Backend Dependencies...
cd /d "%~dp0\backend"
call npm install
echo.
echo ===================================================
echo   Production Build Completed Successfully!
echo   Run "start_production.bat" to start the server.
echo ===================================================
pause

