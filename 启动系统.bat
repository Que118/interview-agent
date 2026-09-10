@echo off
cd /d "D:\qjy\workplace\project_002_???Agent????????\src\frontend"

if not exist "node_modules" (
    echo [1/3] Installing frontend dependencies...
    call npm install
)

echo [2/3] Starting Backend...
cd /d "D:\qjy\workplace\project_002_???Agent????????\src\backend"
start "Backend" cmd /c "python -m uvicorn main:app --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak >nul

echo [3/3] Starting Frontend...
cd /d "D:\qjy\workplace\project_002_???Agent????????\src\frontend"
start "Frontend" cmd /c "npm run dev"

timeout /t 5 /nobreak >nul
echo.
echo ============================================
echo   Backend : http://localhost:8000
echo   Frontend: http://localhost:3000
echo ============================================
echo.
pause
