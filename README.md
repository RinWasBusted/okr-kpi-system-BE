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

3. Configure environment variables:
```bash
cp .env.example .env
```

Update the `.env` file with your database credentials:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/okr_kpi_db"
PORT=3000
NODE_ENV=development
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

## 📡 API Endpoints

### Health Check
- `GET /` - Welcome message
- `GET /api/health` - Check server status

## 🗂️ Project Structure

```
okr-kpi-system-BE/
├── prisma/               # Prisma schema and migrations
├── src/
│   ├── config/          # Application configuration
│   ├── index.js         # Entry point - server startup
│   └── server.js        # Express app setup (factory pattern)
├── .env                 # Environment variables (not committed)
├── .env.example         # Environment variables template
├── .gitignore          # Git ignore rules
└── package.json        # Dependencies and scripts
```

## 🔧 Scripts

- `npm start` - Run production server
- `npm run dev` - Run development server with auto-reload
- `npx prisma studio` - Open Prisma Studio to manage database
- `npx prisma migrate dev` - Create and run migrations
- `npx prisma generate` - Generate Prisma Client

## 📝 License

ISC
