# Money Management App - Development Script (PowerShell)
# This script starts all development services

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting MoneyMind Development Environment..." -ForegroundColor Green

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Navigate to project root
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Create .env if it doesn't exist
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "⚠️  Please update .env with your configuration" -ForegroundColor Yellow
}

# Start Docker services
Write-Host "🐳 Starting Docker containers..." -ForegroundColor Cyan
docker-compose up -d postgres redis rabbitmq

# Wait for services to be healthy
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# Check PostgreSQL
$pgReady = $false
while (-not $pgReady) {
    try {
        docker exec money_postgres pg_isready -U postgres | Out-Null
        $pgReady = $true
        Write-Host "✅ PostgreSQL is ready" -ForegroundColor Green
    } catch {
        Write-Host "  Waiting for PostgreSQL..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

# Check Redis
$redisReady = $false
while (-not $redisReady) {
    try {
        docker exec money_redis redis-cli ping | Out-Null
        $redisReady = $true
        Write-Host "✅ Redis is ready" -ForegroundColor Green
    } catch {
        Write-Host "  Waiting for Redis..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

# Check RabbitMQ
$rabbitReady = $false
while (-not $rabbitReady) {
    try {
        docker exec money_rabbitmq rabbitmq-diagnostics -q ping | Out-Null
        $rabbitReady = $true
        Write-Host "✅ RabbitMQ is ready" -ForegroundColor Green
    } catch {
        Write-Host "  Waiting for RabbitMQ..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

# Start backend in development mode
Write-Host "🔧 Starting backend development server..." -ForegroundColor Cyan
Set-Location "$projectRoot\backend"
npm install
npm run db:generate
npm run db:migrate
Start-Job -ScriptBlock {
    Set-Location "$using:projectRoot\backend"
    npm run dev
} | Out-Null
Write-Host "✅ Backend started" -ForegroundColor Green

# Start AI service in development mode
Write-Host "🤖 Starting AI service..." -ForegroundColor Cyan
Set-Location "$projectRoot\ai-service"
if (-not (Test-Path "venv")) {
    python -m venv venv
}
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt | Out-Null
Start-Job -ScriptBlock {
    Set-Location "$using:projectRoot\ai-service"
    .\venv\Scripts\Activate.ps1
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
} | Out-Null
Write-Host "✅ AI service started" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Development environment is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Services:" -ForegroundColor Cyan
Write-Host "  - Backend API:    http://localhost:3000"
Write-Host "  - API Docs:       http://localhost:3000/docs"
Write-Host "  - AI Service:     http://localhost:8000"
Write-Host "  - PGAdmin:        http://localhost:5050"
Write-Host "  - Redis Commander: http://localhost:8081"
Write-Host "  - RabbitMQ:       http://localhost:15672"
Write-Host ""
Write-Host "Mobile App:" -ForegroundColor Cyan
Write-Host "  cd mobile && npm start"
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
