# CRM Application - PERN Stack

Ứng dụng quản lý thông tin khách hàng (hộ kinh doanh) sử dụng PERN Stack.

## Tech Stack

- **PostgreSQL** - Database
- **Express.js** - Backend API
- **React 19** - Frontend (Vite + TypeScript)
- **Node.js** - Runtime
- **Drizzle ORM** - Type-safe ORM
- **Tailwind CSS v4 + Shadcn/ui** - UI
- **Docker Compose** - Deployment

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 22+
- npm 10+

### Development

```bash
# Start PostgreSQL
docker compose up -d db

# Backend
cd server
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev

# Frontend
cd client
npm install
npm run dev
```

### Production

```bash
docker compose up -d --build
```

## Project Structure

```
CRM/
├── server/          # Express.js API
├── client/          # React frontend
├── nginx/           # Reverse proxy config
└── docker-compose.yml
```

## Default Admin

- **Mã nhân viên:** `ADMIN001`
- **Mật khẩu:** `Admin@123` (thay đổi sau lần đăng nhập đầu)
