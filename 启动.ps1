Write-Host "============================================"  -ForegroundColor Cyan
Write-Host "  智能面试评估系统 — 一键启动" -ForegroundColor Cyan
Write-Host "============================================"  -ForegroundColor Cyan
Write-Host ""

$backendDir = "D:\qjy\workplace\project_002_多模态Agent智能面试评估系统\src\backend"
$frontendDir = "D:\qjy\workplace\project_002_多模态Agent智能面试评估系统\src\frontend"

Write-Host "[1/2] 启动 FastAPI 后端..." -ForegroundColor Yellow
Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload" -WorkingDirectory $backendDir -WindowStyle Normal

Write-Host "[2/2] 安装依赖并启动 Next.js..." -ForegroundColor Yellow
Push-Location $frontendDir
cmd /c "npm install"
Start-Process -FilePath "cmd" -ArgumentList "/c", "npm run dev" -WorkingDirectory $frontendDir -WindowStyle Normal
Pop-Location

Write-Host ""
Write-Host "============================================"  -ForegroundColor Cyan
Write-Host "  后端: http://localhost:8000" -ForegroundColor Green
Write-Host "  前端: http://localhost:3000" -ForegroundColor Green
Write-Host "  API文档: http://localhost:8000/docs" -ForegroundColor Green
Write-Host "============================================"  -ForegroundColor Cyan
