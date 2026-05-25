# Getting Started Guide

This guide will help you set up and run the MoneyMind application on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

| Software | Version | Download |
|----------|---------|----------|
| Node.js | 18.x or higher | https://nodejs.org/ |
| npm | 9.x or higher | (comes with Node.js) |
| Python | 3.11 or higher | https://python.org/ |
| Docker | Latest | https://docker.com/ |
| Git | Latest | https://git-scm.com/ |

### Optional (for mobile development)

| Software | Purpose |
|----------|---------|
| Xcode | iOS development (macOS only) |
| Android Studio | Android development |
| Expo Go | Mobile app for testing |

## Quick Start (Docker)

The easiest way to get started is using Docker Compose:

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd money-management-app
```

### Step 2: Set Up Environment Variables

```bash
# Copy the environment template
cp .env.example .env

# Edit .env with your preferred settings
# At minimum, change the JWT secrets for production
```

### Step 3: Start All Services

```bash
# Start all Docker containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Step 4: Verify Services

Open your browser and check:

- **Backend API**: http://localhost:3000/health
- **API Documentation**: http://localhost:3000/docs
- **AI Service**: http://localhost:8000/health
- **PGAdmin**: http://localhost:5050 (login: admin@moneymind.local / admin)
- **Redis Commander**: http://localhost:8081
- **RabbitMQ**: http://localhost:15672 (login: guest / guest)

### Step 5: Test the API

```bash
# Register a new user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "name": "Test User"
  }'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

## Manual Setup (Development)

If you prefer to run services individually:

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

The backend will be available at http://localhost:3000

### AI Service Setup

```bash
cd ai-service

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start development server
uvicorn app.main:app --reload
```

The AI service will be available at http://localhost:8000

### Mobile App Setup

```bash
cd mobile

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start Expo development server
npm start

# Press 'w' for web, 'a' for Android, 'i' for iOS
```

## Database Setup

### Using Docker (Recommended)

The PostgreSQL database is automatically set up when you run `docker-compose up`.

### Manual PostgreSQL Setup

```bash
# Create database
createdb money_management

# Set DATABASE_URL in backend/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/money_management?schema=public

# Run migrations
cd backend
npm run db:migrate
```

### Seed Data (Optional)

```bash
cd backend
npm run db:seed
```

## Testing

### Backend Tests

```bash
cd backend

# Unit tests
npm run test

# E2E tests
npm run test:e2e

# With coverage
npm run test:cov
```

### AI Service Tests

```bash
cd ai-service
source venv/bin/activate  # or venv\Scripts\activate on Windows
pytest
```

### Mobile App Tests

```bash
cd mobile
npm test
```

## Common Issues

### Docker Issues

**Problem**: Containers fail to start
```bash
# Check Docker is running
docker info

# View container logs
docker-compose logs

# Restart services
docker-compose restart

# Full reset
docker-compose down -v
docker-compose up -d
```

### Database Issues

**Problem**: Prisma migrations fail
```bash
# Reset database (WARNING: deletes all data)
cd backend
npx prisma migrate reset

# Or manually fix and re-run
npm run db:migrate
```

### Port Conflicts

**Problem**: Port already in use
```bash
# Check what's using the port
# Windows:
netstat -ano | findstr :3000
# macOS/Linux:
lsof -i :3000

# Kill the process or change port in .env
```

### AI Service Issues

**Problem**: Python dependencies fail to install
```bash
# Upgrade pip
pip install --upgrade pip

# Install without cache
pip install --no-cache-dir -r requirements.txt

# Install system dependencies (macOS)
xcode-select --install
```

## Next Steps

1. **Explore the API**: Visit http://localhost:3000/docs
2. **Set up mobile app**: Follow the mobile app setup guide
3. **Configure SMS parsing**: See SMS_PARSING.md
4. **Set up push notifications**: Configure Firebase
5. **Deploy to production**: See DEPLOYMENT.md

## Development Workflow

### Making Changes

1. Create a new branch: `git checkout -b feature/your-feature`
2. Make changes and test locally
3. Commit: `git commit -m "Add your feature"`
4. Push: `git push origin feature/your-feature`
5. Create a Pull Request

### Running in Production

See DEPLOYMENT.md for production deployment instructions.

## Getting Help

- **Documentation**: Check the docs/ folder
- **Issues**: Open an issue on GitHub
- **Email**: support@moneymind.app

## Troubleshooting Checklist

- [ ] Docker is running
- [ ] All required ports are available (3000, 5432, 6379, 5672, 8000)
- [ ] .env files are properly configured
- [ ] Dependencies are installed
- [ ] Database migrations have run
- [ ] No port conflicts
- [ ] Firewall allows local connections
