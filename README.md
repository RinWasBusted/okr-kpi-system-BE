# OKR-KPI System - Backend

OKR (Objectives and Key Results) and KPI (Key Performance Indicators) Management System - Backend API.

## 🚀 Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Prisma** - Database ORM
- **PostgreSQL** - Database
- **dotenv** - Environment variables management

## 📋 Requirements

- Node.js >= 18.x
- npm >= 9.x
- PostgreSQL >= 14.x
- Redis >= 6.x

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/RinWasBusted/okr-kpi-system-BE
cd okr-kpi-system-BE
```

2. Install dependencies:
```bash
npm install
```

3. Create and configure environment variables:

Create a `.env` file at the project root with:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/okr_kpi_db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your_jwt_secret"
PORT=3000
NODE_ENV=development
BASE_URL="http://localhost"
```

4. Run Prisma migrations:
```bash
npx prisma migrate dev
```

5. Generate Prisma Client:
```bash
npx prisma generate
```

## 🏃 Running the Application

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

Server will run at: `http://localhost:3000`
Swagger UI: `http://localhost:3000/api-docs`

## 📡 API Endpoints

### Health Check
- `GET /` - Welcome message
- `GET /api-docs` - Swagger UI

## 🗂️ Project Structure

```
okr-kpi-system-BE/
├── prisma/               # Prisma schema and migrations
├── src/
│   ├── config/          # Application configuration
│   ├── index.js         # Entry point - server startup
│   └── server.js        # Express app setup (factory pattern)
├── .env                 # Environment variables (not committed)
├── .gitignore          # Git ignore rules
└── package.json        # Dependencies and scripts
```

## 🔧 Scripts

- `npm start` - Run production server
- `npm run dev` - Run development server with auto-reload
- `npm run seed` - Seed database
- `npx prisma studio` - Open Prisma Studio to manage database
- `docker compose -f docker-compose.dev.yml up -d` - Create database container for development.
- `npx prisma migrate reset` - Using migrate for database reset.
- `npm run seed` - Seeding database and setting policies
- `npx prisma migrate dev` - Create and run migrations
- `npx prisma generate` - Generate Prisma Client
- `env $(grep -v '^#' .env | xargs) docker stack deploy -c docker-compose.yml okr_kpi_system_server` - Run BE docker compose file on VPS

## 📝 License

ISC
