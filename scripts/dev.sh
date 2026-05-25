#!/bin/bash

# Money Management App - Development Script
# This script starts all development services

set -e

echo "🚀 Starting MoneyMind Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Navigate to project root
cd "$(dirname "$0")/.."

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update .env with your configuration"
fi

# Start Docker services
echo "🐳 Starting Docker containers..."
docker-compose up -d postgres redis rabbitmq

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check PostgreSQL
until docker exec money_postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo "  Waiting for PostgreSQL..."
    sleep 2
done
echo "✅ PostgreSQL is ready"

# Check Redis
until docker exec money_redis redis-cli ping > /dev/null 2>&1; do
    echo "  Waiting for Redis..."
    sleep 2
done
echo "✅ Redis is ready"

# Check RabbitMQ
until docker exec money_rabbitmq rabbitmq-diagnostics -q ping > /dev/null 2>&1; do
    echo "  Waiting for RabbitMQ..."
    sleep 2
done
echo "✅ RabbitMQ is ready"

# Start backend in development mode
echo "🔧 Starting backend development server..."
cd backend
npm install
npm run db:generate
npm run db:migrate
npm run dev &
BACKEND_PID=$!
cd ..

# Start AI service in development mode
echo "🤖 Starting AI service..."
cd ai-service
if [ ! -d "venv" ]; then
    python -m venv venv
fi
source venv/bin/activate || source venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
AI_PID=$!
cd ..

echo ""
echo "✅ Development environment is ready!"
echo ""
echo "Services:"
echo "  - Backend API:    http://localhost:3000"
echo "  - API Docs:       http://localhost:3000/docs"
echo "  - AI Service:     http://localhost:8000"
echo "  - PGAdmin:        http://localhost:5050"
echo "  - Redis Commander: http://localhost:8081"
echo "  - RabbitMQ:       http://localhost:15672"
echo ""
echo "Mobile App:"
echo "  cd mobile && npm start"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user interrupt
wait
