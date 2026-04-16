# OKR-KPI System Backend - Project Documentation

## 📋 Project Overview

**OKR-KPI System Backend** is a comprehensive Node.js/Express API for managing Objectives & Key Results (OKR) and Key Performance Indicators (KPI) across multi-tenant organizations. It supports hierarchical organizational units, role-based access control (RBAC), AI-assisted goal generation, and real-time KPI tracking.

- **Project Type:** Multi-tenant SaaS Backend API
- **Node.js Version:** v22-alpine (Docker)
- **Database:** PostgreSQL 16 (Neon in production)
- **Cache:** Redis (Upstash in production)
- **ORM:** Prisma v7.6.0 with PrismaPg adapter

---

## 🏗️ Architecture Overview

### Technology Stack

| Layer              | Technology             | Purpose                                                     |
| ------------------ | ---------------------- | ----------------------------------------------------------- |
| **Runtime**        | Node.js v22-alpine     | Lightweight production runtime                              |
| **Framework**      | Express.js v5          | Web framework                                               |
| **Database**       | PostgreSQL 16 + Prisma | Relational data with advanced types (ltree for hierarchies) |
| **Cache**          | Redis                  | Session/job queue storage                                   |
| **ORM**            | Prisma v7.6.0          | Type-safe database access                                   |
| **Authentication** | JWT (cookies)          | Token-based auth with HttpOnly cookies                      |
| **File Storage**   | Cloudinary SDK v2      | Cloud image uploads                                         |
| **Job Scheduling** | node-cron v4.2.1       | Monthly token reset jobs                                    |
| **AI Integration** | OpenAI/Gemini APIs     | LLM-powered goal generation                                 |
| **API Docs**       | Swagger/OpenAPI 3.0.0  | Interactive API documentation                               |
| **Validation**     | Zod                    | Input schema validation                                     |
| **Container**      | Docker + Swarm         | Production orchestration                                    |

### Core Principles

- **Multi-tenancy:** Isolated data per company via `company_id` field + Row Level Security (RLS) policies
- **Hierarchical Access:** Organizational units (ltree structure) + path-based visibility rules
- **Audit Trail:** Soft deletes (`deleted_at` timestamps) for all entities
- **Performance:** Pure Prisma (no adapters) leveraging Rust query engine
- **Health Checks:** Docker Swarm-compatible probes at `/api/health/*`

---

## 📁 Project Structure

```
okr-kpi-system-BE/
├── prisma/
│   ├── schema.prisma                 # Database schema definition
│   ├── seed.js                       # Seed script for initial data
│   └── migrations/                   # Database migration files
│       └── 202x.../ migration.sql
├── src/
│   ├── index.js                      # Entry point (port binding, startup)
│   ├── server.js                     # Express app factory pattern
│   ├── api/
│   │   ├── index.js                  # Route aggregator
│   │   ├── admin/
│   │   │   ├── companies/            # Company management (CRUD, stats)
│   │   │   └── AdminCompany/         # Company admin users
│   │   ├── auth/                     # Authentication (login, signup, logout)
│   │   ├── users/                    # User profiles & management
│   │   ├── units/                    # Organizational unit hierarchy
│   │   ├── cycle/                    # OKR/KPI planning cycles
│   │   ├── okr/                      # Objectives, Key Results, Check-ins
│   │   │   ├── objective/
│   │   │   ├── key-result/
│   │   │   └── check-in/
│   │   ├── kpi/                      # KPI Dictionaries & Assignments
│   │   │   ├── dictionaries/
│   │   │   ├── assignments/
│   │   │   └── records/
│   │   ├── okr-ai/                   # AI-powered goal generation
│   │   ├── ai-usage/                 # Token usage tracking
│   │   ├── notifications/            # Notification inbox/read-state APIs
│   │   ├── company/                  # Company self-service APIs (ADMIN_COMPANY)
│   │   ├── statistic/                # Analytics & reporting
│   │   ├── health/                   # Liveness/readiness probes
│   │   ├── okr/feedbacks/            # Objective feedback & reply threads
│   │   ├── ***/*.controller.js       # Request handlers
│   │   ├── ***/*.service.js          # Business logic (pure functions)
│   │   └── ***/*.route.js            # Express routes + Swagger docs
│   ├── config/
│   │   └── swagger.config.js         # OpenAPI 3.0.0 setup
│   ├── middlewares/
│   │   ├── auth.js                   # JWT verification & role authorization
│   │   ├── validate.js               # Zod request validation middleware
│   │   ├── rateLimit.js              # Login rate-limit middleware (Redis-backed)
│   │   ├── errorHandler.js           # Global error catching
│   │   └── responseHandler.js        # Standardized response wrapping
│   ├── schemas/
│   │   ├── auth.schema.js            # Zod validation schemas
│   │   ├── objective.schema.js
│   │   ├── kpi.schema.js
│   │   ├── unit.schema.js
│   │   ├── user.schema.js
│   │   ├── feedback.schema.js
│   │   ├── notification.schema.js
│   │   ├── company.schema.js
│   │   └── okrAi.schema.js
│   ├── utils/
│   │   ├── prisma.js                 # Prisma client singleton
│   │   ├── redis.js                  # Redis connection & helpers
│   │   ├── jwt.js                    # Token generation/verification
│   │   ├── bcrypt.js                 # Password hashing
│   │   ├── cloudinary.js             # Image upload & URL generation
│   │   ├── context.js                # Request context (user, company)
│   │   ├── path.js                   # Unit path utilities (ltree)
│   │   ├── okr.js                    # OKR-specific helpers
│   │   ├── date.js                   # Date utilities (UTC normalization)
│   │   ├── cors.js                   # CORS configuration
│   │   ├── appError.js               # Custom error class
│   │   ├── multer.js                 # File upload middleware
│   │   ├── wrapMulter.js             # Multer wrapper for context
│   │   ├── notification.js           # Notification message generator
│   │   └── notificationHelper.js     # Notification creation helper
│   └── jobs/
│       ├── resetTokenUsage.job.js    # Monthly token reset (node-cron)
│       └── feedback.smoke.js         # Reserved smoke script (currently empty)
├── docker-compose.yml                # Production: app service only
├── docker-compose.dev.yml            # Development: app + postgres + redis
├── Dockerfile                        # Multi-stage Node.js 22-alpine build
├── .dockerignore                     # Files excluded from Docker image
├── .env                              # Production environment vars
├── prisma.config.js                  # Prisma CLI config (schema/migrations/seed)
├── scripts/studio.js                 # Prisma Studio launcher with DATABASE_ADMIN_URL
├── .gitignore
├── package.json
└── README.md
```

---

## 🗄️ Database Schema

### Key Entities

#### **Companies** (Multi-tenant Root)

```sql
id (PK), name, slug (UNIQUE), logo (Cloudinary public_id)
is_active, ai_plan (FREE|SUBSCRIPTION|PAY_AS_YOU_GO)
token_usage, credit_cost, usage_limit
```

- AI plan management for feature gates
- Token tracking for LLM usage billing
- One company = one tenant

#### **Users**

```sql
id (PK), company_id (FK), email, password, role
avatar_url, job_title, unit_id (FK), is_active
UNIQUE(email, company_id) - email unique per company
```

- Roles: ADMIN (platform), ADMIN_COMPANY (company-level), EMPLOYEE
- Soft delete via `deleted_at`

#### **Units** (Org Hierarchy via ltree)

```sql
id (PK), company_id (FK), name, parent_id (FK)
manager_id (FK → Users), path (ltree type)
```

- Hierarchical org structure: path = '1.2.3' (PostgreSQL native)
- Manager = user assigned to unit
- Used for access control & OKR scoping

#### **Cycles** (Planning Periods)

```sql
id (PK), company_id (FK), name, start_date, end_date, is_locked
```

- OKRs and KPIs scoped to cycles
- Locked cycles prevent modifications

#### **Objectives** (OKRs)

```sql
id (PK), company_id (FK), title, cycle_id, unit_id, owner_id
status (Draft|Active|Pending_Approval|Rejected|Completed)
visibility (PUBLIC|INTERNAL|PRIVATE), access_path (ltree)
parent_objective_id (FK) - for hierarchies
progress_percentage, approved_by (FK)
```

- Hierarchical (parent-child relationships)
- Visibility rules + RLS policies
- Approval workflow

#### **KeyResults** (OKR Metrics)

```sql
id (PK), objective_id (FK), title, target_value, current_value
unit, weight, due_date, progress_percentage
```

- Weighted scoring for parent objectives
- Check-ins track progress

#### **KPIDictionaries** (KPI Templates)

```sql
id (PK), company_id (FK), name, unit, evaluation_method
unit_id (FK) - scope to org unit
```

- Reusable KPI templates
- Evaluation method: Positive|Negative|Stabilizing

#### **KPIAssignments** (KPI Instances)

```sql
id (PK), company_id (FK), kpi_dictionary_id, cycle_id
owner_id, unit_id, visibility, access_path (ltree)
target_value, current_value, progress_percentage
parent_assignment_id - for nested KPI hierarchies
```

- Assigned to users or units
- Can have child assignments (hierarchy)
- Current value calculated from children if has children

#### **KPIRecords** (KPI History)

```sql
id (PK), kpi_assignment_id (FK), period_start, period_end
actual_value, progress_percentage, status (ON_TRACK|AT_RISK|CRITICAL)
```

#### **AIUsageLogs** (Token Tracking)

```sql
id (PK), company_id, user_id, feature_name, model_name
input_tokens, output_tokens, total_tokens, credit_cost
status (PENDING|SUCCESS|FAILED|BILLED)
```

- Normalized across OpenAI/Gemini providers
- Used for billing & rate limiting

#### **Feedbacks** (Objective Discussion Threads)

```sql
id (PK), company_id, objective_id, kr_tag_id (nullable), user_id, parent_id
content (TEXT), sentiment, status, created_at, updated_at
```

- Supports threaded replies (max depth = 1)
- `kr_tag_id` can tag a specific key result in the objective
- Designed for collaboration and issue escalation on objectives

#### **Notifications** + **NotificationRecipients**

```sql
Notifications: id, company_id, event_type, ref_type, ref_id, message, created_at
NotificationRecipients: notification_id, recipient_id, read_at (composite PK)
```

- Event-log style notifications with per-recipient read tracking
- Supports inbox, unread counter, mark-one, mark-all-read flows

### Additional Enums In Active Use

- `ProgressStatus`: `Draft`, `Pending_Approval`, `Rejected`, `NOT_STARTED`, `ON_TRACK`, `AT_RISK`, `CRITICAL`, `COMPLETED`
- `KPIEvaluationType`: `MAXIMIZE`, `MINIMIZE`, `TARGET`
- `KPITrend`: `Upward`, `Downward`, `Stable`
- `FeedbackSentiment`: `POSITIVE`, `NEUTRAL`, `NEGATIVE`, `MIXED`, `UNKNOWN`
- `FeedbackStatus`: `PRAISE`, `CONCERN`, `SUGGESTION`, `QUESTION`, `BLOCKER`, `RESOLVED`, `FLAGGED`
- `ReferenceType`: `KPI`, `OBJECTIVE`, `CYCLE`, `UNIT`, `FEEDBACK`
- `EventType`: `CREATED`, `UPDATED`, `DELETED`, `ASSIGNED`, `STATUS_CHANGED`, `COMMENTED`, `REPLIED`, `LOCKED`, `CLONED`, `REMINDER`
- `AIUsageStatus`: `PENDING`, `SUCCESS`, `FAILED`, `REFUNDED`, `BILLED`, `EXCLUDED`

### Advanced Features

**ltree (PostgreSQL):** Hierarchical paths for org units & objectives

- Operators: `<@` (is_descendant), `@>` (is_ancestor), `||` (concat)
- Enables efficient ancestor/descendant queries

**RLS Policies:** Row-level security for multi-tenancy

- Users see data only for their company_id

**Soft Deletes:** All entities have `deleted_at` timestamp

- Queries filter `WHERE deleted_at IS NULL`

---

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/login` - Authenticate (sets HttpOnly cookie)
- `POST /api/auth/refresh-token` - Rotate refresh token, issue new access token
- `PATCH /api/auth/change-password` - Change current password
- `GET /api/auth/me` - Get current authenticated user
- `POST /api/auth/logout` - Clear session
- `POST /api/auth/logout-all` - Revoke all sessions
- `GET /api/auth/sessions` - List active sessions
- `DELETE /api/auth/sessions/:sessionId` - Revoke one session

### Health Checks (Docker Swarm)

- `GET /api/health` - Full check (database + Redis), returns status/uptime/services
- `GET /api/health/live` - Liveness probe (always 200)
- `GET /api/health/ready` - Readiness probe (DB + Redis validation)

### Companies (Admin)

- `GET /api/admin/companies` - List all companies (paginated)
- `GET /api/admin/companies/me` - Current company details (ADMIN_COMPANY only)
- `GET /api/admin/companies/:id/stats` - Company stats (users, OKRs, KPIs, AI usage)
- `POST /api/admin/companies` - Create company (multipart: name, slug, logo)
- `PUT /api/admin/companies/:id` - Update company
- `DELETE /api/admin/companies/:id` - Deactivate (soft delete)
- `PATCH /api/admin/companies/:id/logo` - Upload/update logo
- `DELETE /api/admin/companies/:id/logo` - Delete logo

### Users

- `GET /api/users` - List users (filtered by company)
- `GET /api/users/:id` - User details
- `POST /api/users` - Create user (ADMIN_COMPANY only, multipart: avatar)
- `PUT /api/users/:id` - Update user profile/avatar
- `DELETE /api/users/:id` - Soft delete user

### Units (Org Hierarchy)

- `GET /api/units` - List all units (tree structure with stats)
- `GET /api/units/:id` - Unit details + member count
- `POST /api/units` - Create unit (parent_id optional, manager_id)
- `PUT /api/units/:id` - Update unit (name, parent, manager)
- `DELETE /api/units/:id` - Hard delete (only if no members/children)

### Cycles

- `GET /api/cycles` - List cycles
- `POST /api/cycles` - Create cycle (start_date, end_date)
- `PUT /api/cycles/:id` - Update cycle
- `DELETE /api/cycles/:id` - Delete cycle
- `PATCH /api/cycles/:id/lock` - Lock cycle
- `PATCH /api/cycles/:id/unlock` - Unlock cycle
- `POST /api/cycles/:id/clone` - Clone selected objectives/KPIs into cycle

### Objectives (OKRs)

- `GET /api/objectives` - List (with tree structure + filters)
- `GET /api/objectives/:id` - Get objective + key results
- `POST /api/objectives` - Create objective
- `PUT /api/objectives/:id` - Update objective
- `POST /api/objectives/:id/submit` - Submit for approval
- `POST /api/objectives/:id/approve` - Approve (requires authority)
- `PATCH /api/objectives/:id/publish` - Publish objective (Draft -> progress status)
- `POST /api/objectives/:id/reject` - Reject with comment
- `POST /api/objectives/:id/revert-to-draft` - Revert objective to Draft
- `DELETE /api/objectives/:id` - Soft delete

### Key Results

- `GET /api/key-results` - List (filtered by objective)
- `POST /api/key-results` - Create KR
- `PUT /api/key-results/:id` - Update KR
- `DELETE /api/key-results/:id` - Soft delete

### Check-ins (OKR Progress)

- `GET /api/check-ins` - List check-ins (filtered by KR)
- `POST /api/check-ins` - Add check-in (achieved_value, evidence_url, comment)
- `PUT /api/check-ins/:id` - Update check-in
- `DELETE /api/check-ins/:id` - Delete check-in

### Feedbacks (Objective Collaboration)

- `GET /api/objectives/:objectiveId/feedbacks` - List root feedbacks with reply tree
- `POST /api/objectives/:objectiveId/feedbacks` - Create feedback on objective
- `GET /api/objectives/:objectiveId/feedbacks/:feedbackId` - Get single feedback
- `PATCH /api/objectives/:objectiveId/feedbacks/:feedbackId` - Update feedback
- `DELETE /api/objectives/:objectiveId/feedbacks/:feedbackId` - Delete feedback and replies
- `GET /api/feedbacks/:id/replies` - List replies of a root feedback
- `POST /api/feedbacks/:id/replies` - Create reply (`RESOLVED`/`FLAGGED` flow)

### KPI Management

- `GET /api/kpi/dictionaries` - List KPI templates
- `POST /api/kpi/dictionaries` - Create template
- `PUT /api/kpi/dictionaries/:id` - Update template
- `DELETE /api/kpi/dictionaries/:id` - Soft delete template

- `GET /api/kpi/assignments` - List assignments (nested tree, paginated root only)
- `POST /api/kpi/assignments` - Create assignment (owner_id or unit_id, not both)
- `PUT /api/kpi/assignments/:id` - Update assignment
- `DELETE /api/kpi/assignments/:id` - Soft delete (cascade option)

- `GET /api/kpi/records` - List historical records
- `POST /api/kpi/records` - Add new record
- `PUT /api/kpi/records/:id` - Update record

### AI Features

- `POST /api/okr-ai/generate-key-results/:objectiveId` - Generate KRs for objective
- `POST /api/okr-ai/get-visible-objective-ids` - Get IDs user can view (for batch AI operations)
- `POST /api/okr-ai/generate-test` - Test endpoint

### AI Usage Tracking

- `GET /api/ai-usage` - List token usage logs (paginated)

### Notifications

- `GET /api/notifications` - List user notifications (filters: read-state, paging)
- `GET /api/notifications/unread-count` - Unread count
- `PATCH /api/notifications/read-all` - Mark all as read
- `PATCH /api/notifications/:id/read` - Mark one as read

### Company (Self-service for ADMIN_COMPANY)

- `GET /api/company/me` - Get own company profile
- `GET /api/company/stats` - Company-level summary stats
- `PATCH /api/company/logo` - Upload/update company logo
- `DELETE /api/company/logo` - Remove company logo
- `GET /api/company/ai-usage/logs` - Company AI usage logs with filters

---

## 🔐 Authentication & Authorization

### JWT Implementation

- **Token:** Signed with `JWT_SECRET` environment variable
- **Payload (active code):** `{ id, company_id, role, email, unit_path }`
- **Access token TTL:** 15 minutes
- **Refresh token TTL:** 7 days (or 30 days when `remember_me=true`)
- **Storage:** HttpOnly cookies `accessToken` + `refreshToken`

### Middleware Chain

```javascript
authenticate → requestContext.run(...) → authorize("ADMIN_COMPANY") → controller
```

- `authenticate` - Verifies JWT from cookie, extracts user context
- `authenticate` - Also injects AsyncLocalStorage request context: `company_id`, `role`, `user_id`, `unit_path`
- `authorize(roles...)` - Checks role against allowed roles
- `validate(schema, source)` - Validates body/query/params and stores parsed input in `req.validated`
- `loginRateLimit` - Redis-based throttle (5 attempts/10 minutes per IP), returns `429` + `Retry-After`
- `errorHandler` - Catches all errors, returns standardized response

### Role-Based Access Control (RBAC)

| Role              | Scope    | Permissions                                               |
| ----------------- | -------- | --------------------------------------------------------- |
| **ADMIN**         | Platform | All companies, user management, billing                   |
| **ADMIN_COMPANY** | Company  | Own company management, employee CRUD                     |
| **EMPLOYEE**      | Company  | Own data, view shared objectives/KPIs based on visibility |

### Visibility Rules (OKRs & KPIs)

- **PUBLIC** - Visible to all employees
- **INTERNAL** - Visible to same unit + ancestor/descendant units
- **PRIVATE** - Visible to owner + ancestor unit members

---

## 📊 Key Features

### 1. **Hierarchical Org Units**

- PostgreSQL `ltree` type for efficient path queries
- Path format: `'1.2.3'` (parent.child.grandchild)
- Ancestors/descendants resolved via operators (`<@`, `@>`)
- Used for: OKR scoping, KPI filtering, visibility rules

### 2. **OKR Management**

- Hierarchical objectives (parent-child relationships)
- Weighted key results
- Check-in system for progress tracking
- Approval workflow (Draft → Pending → Active/Rejected)
- Visibility: PUBLIC, INTERNAL (unit scope), PRIVATE (owner only)

### 3. **KPI Tracking**

- Reusable KPI dictionaries (templates)
- Assignments to users or units
- Nested assignments (parent-child hierarchy)
- Current value auto-calculated from children
- Historical records + trend tracking
- Status: ON_TRACK, AT_RISK, CRITICAL

### 4. **AI-Assisted Goal Generation**

- Generates key results for objectives
- Supports OpenAI GPT-4 and Google Gemini
- Token logging for billing
- Configurable pricing (PAY_AS_YOU_GO, SUBSCRIPTION, FREE plans)
- Exponential backoff retry logic for resilience

### 5. **Multi-tenant Isolation**

- Company as root isolation
- RLS policies in PostgreSQL
- Every query filters by `company_id`
- User can only access own company data

### 6. **Image Management**

- Avatar uploads (users, admin users)
- Logo uploads (companies)
- Cloudinary integration (cloud storage + CDN)
- Multer middleware with request context wrapping

### 7. **Job Scheduling**

- Monthly token usage reset (1st of month, 00:00 Asia/Ho_Chi_Minh timezone)
- Uses node-cron with timezone support
- Initialized in `server.js` during app bootstrap

### 8. **Health Checks**

- Docker Swarm compatible probes
- Checks database + Redis availability
- Liveness: `GET /api/health/live` (always 200)
- Readiness: `GET /api/health/ready` (verifies dependencies)
- Full: `GET /api/health` (detailed service status + uptime)

### 9. **Analytics & Reporting**

- Company-wide statistics (user counts, entity counts)
- OKR progress tracking by cycle/unit
- KPI health dashboard (ON_TRACK, AT_RISK, CRITICAL distribution)
- Unit performance comparison
- User engagement metrics
- AI token usage trends for billing analysis

---

## ⚙️ Configuration & Environment

### Environment Variables

```env
# Node Environment
NODE_ENV=development|production
PORT=3000
HOST=0.0.0.0
BASE_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:pass@neon.local/db
DATABASE_ADMIN_URL=postgresql://admin:pass@neon.local/db (seed only)

# Cache
REDIS_URL=redis://:password@upstash.local:6379

# Authentication
JWT_SECRET=your-secret-key-min-32-chars
CORS_ORIGINS=http://localhost:5173,https://example.com
CORS_CREDENTIALS=true

# Admin User (Seed)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=SecurePassword123

# AI Integration
AI_PROVIDER=gemini|openai
GEMINI_API_KEY=xxx
OPENAI_API_KEY=xxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
GEMINI_MODEL=gemini-2.5-flash
GEMINI_MAX_ATTEMPTS=3
AI_PAY_AS_YOU_GO_PRICE_PER_1M_TOKENS=10000

# Cloudinary
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

# Swagger
SWAGGER_ENABLE_ABSOLUTE_SERVER=false
```

### Development Setup

```bash
# Configure .env (repo currently uses single .env file)
# Example local URLs:
# DATABASE_URL=postgresql://user:pass@localhost:5432/okr_kpi_db
# REDIS_URL=redis://localhost:6379

# Start services
docker-compose -f docker-compose.dev.yml up -d

# Run migrations
npx prisma migrate dev

# Seed database
npm run seed

# Prisma Studio with admin database URL override
npm run studio

# Start dev server (auto-reload)
npm run dev
```

### Production Deployment

```bash
# Build Docker image
docker build -t okr-kpi-system:latest .

# Deploy to Docker Swarm
env IMAGE_TAG=latest $(grep -v '^#' .env | xargs) \
  docker stack deploy -c docker-compose.yml okr_kpi_system

# Health check endpoint
curl http://localhost:3000/api/health/ready
```

---

## 🧠 Service Layer Patterns

### Service Functions (Pure Business Logic)

```javascript
export const listObjectives = async (
  user,
  filters,
  includeKeyResults,
  page,
  perPage,
) => {
  // 1. Check permissions (getVisibleObjectiveIds)
  // 2. Query data (prisma.objectives.findMany)
  // 3. Build response objects (formatObjective)
  // 4. Return formatted data with metadata
  return { data, total, lastPage };
};
```

Key patterns:

- **No request/response objects** - Controllers pass parsed data
- **User context** - First parameter for authorization checks
- **Error handling** - throw `AppError(message, statusCode)`
- **Transactions** - Use `prisma.$transaction(async (tx) => {...})`
- **Soft deletes** - Always filter `WHERE deleted_at IS NULL`
- **Pagination** - Return `{ data, meta: { total, page, per_page, last_page } }`

### Controller Functions (Request Handling)

```javascript
export const listObjectives = async (req, res) => {
  // 1. Validate input (schema.parse)
  // 2. Call service
  // 3. Return response via responseHandler
  res.success("Objectives retrieved", 200, result);
};
```

### Key Utilities

**prisma.js** - Singleton with PrismaPg adapter

```javascript
export default new PrismaClient({
  adapter: new PrismaPg({ url: DATABASE_URL }),
});
```

**context.js** - Middleware extracts user + company from JWT

```javascript
req.user = { id, companyId, role, email };
req.company = { id: companyId };
```

**path.js** - ltree helpers for unit hierarchies

```javascript
getUnitPath(unitId); // returns '1.2.3'
getUnitAncestors(unitId); // returns all parent units
getUnitDescendants(unitId); // returns all child units
isAncestorUnit(ancestorId, descendantId); // boolean
```

**okr.js** - OKR-specific helpers

```javascript
recalculateObjectiveProgress(objectiveId);
calculateKeyResultProgress(kr, now);
```

---

## 🚀 Deployment Guide

### Docker Swarm Setup

1. **Build image:**

   ```bash
   docker build -t okr-kpi-system-be:latest .
   ```

2. **Push to registry:**

   ```bash
   docker tag okr-kpi-system-be:latest myregistry/okr-kpi-system-be:latest
   docker push myregistry/okr-kpi-system-be:latest
   ```

3. **Deploy stack:**

   ```bash
   docker stack deploy -c docker-compose.yml okr_kpi_system
   ```

4. **Scaling:**
   - Update `deploy.replicas` in docker-compose.yml
   - Rolling updates: `parallelism=1`, `order=start-first`

5. **Monitoring:**
   - Health check endpoint: `/api/health/ready`
   - Service logs: `docker service logs okr_kpi_system_app`

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure `BASE_URL` to public domain
- [ ] Set strong `JWT_SECRET` (32+ characters)
- [ ] Use external PostgreSQL (Neon) + Redis (Upstash)
- [ ] Configure AI provider keys (GEMINI_API_KEY or OPENAI_API_KEY)
- [ ] Enable Cloudinary for image uploads
- [ ] Set CORS origins to frontend domain
- [ ] Enable HTTPS/SSL in reverse proxy
- [ ] Set up database backups
- [ ] Configure monitoring/alerting

---

## 🐛 Troubleshooting

### Common Issues

**P1001: Database connection error**

- Check `DATABASE_URL` format (must include host, port, database name)
- Verify network connectivity to database
- Ensure .env vs .env.development context is correct

**Redis connection errors**

- Check `REDIS_URL` format (redis://[:password]@host:port)
- Verify Redis service is running
- Test with: `redis-cli -u $REDIS_URL ping`

**Swagger docs not loading**

- Check `SWAGGER_ENABLE_ABSOLUTE_SERVER` setting
- Verify `BASE_URL` is correct
- Disable in production: check NODE_ENV condition in swagger.config.js

**Multer file upload fails**

- Verify file size within limits (default 5MB)
- Check Cloudinary credentials
- Ensure wrapMulter wrapper is applied to routes

**Token reset job not running**

- Verify node-cron syntax: `'0 0 1 * *'` = every 1st at 00:00
- Check timezone: Asia/Ho_Chi_Minh
- Inspect logs: `console.log` in resetTokenUsageJob function

**Validation returns 422**

- Request payload/query/params fails Zod schema in `validate` middleware
- Error format: `success=false`, `error.code=VALIDATION_ERROR`

**Login gets 429 Too Many Requests**

- Login is rate-limited per IP (5 attempts/10 minutes)
- Check response header `Retry-After` for retry seconds

---

## 🔄 Documentation Sync Snapshot (April 16, 2026)

This section is an additive sync summary derived from current source files to help coding agents quickly map what each file group is responsible for.

### File Context Map (Current)

- `src/index.js`: Bootstraps app by calling `createApp()` and binding `HOST`/`PORT`.
- `src/server.js`: App factory; sets middleware stack, swagger, `/api` router, db/redis connections, and scheduled jobs.
- `src/api/index.js`: Aggregates all feature routers (`auth`, `admin`, `units`, `users`, `cycles`, `okr`, `kpi`, `okr-ai`, `ai-usage`, `statistics`, `notifications`, `company`).
- `src/api/auth/*`: Cookie-based auth with refresh-token rotation, multi-session management, logout-all, and session revocation.
- `src/api/company/*`: Company self-service APIs for `ADMIN_COMPANY` (profile/stats/logo/AI usage logs).
- `src/api/notifications/*`: Notification inbox endpoints with read-state mutation and unread counter.
- `src/api/okr/objective/*`: Objective lifecycle + approval flow + publish/revert-to-draft.
- `src/api/okr/feedbacks/*`: Objective feedback threads, KR tagging, one-level reply workflow.
- `src/api/okr/key-result/*`, `src/api/okr/check-in/*`: KR CRUD and periodic check-ins.
- `src/api/kpi/*`: KPI dictionary/assignment/record workflows and progress tracking.
- `src/api/cycle/*`: Cycle CRUD + lock/unlock + clone objective/KPI items.
- `src/middlewares/auth.js`: Cookie JWT auth + request context injection.
- `src/middlewares/validate.js`: Zod validation wrapper writing parsed values into `req.validated`.
- `src/middlewares/rateLimit.js`: Redis login attempt throttling and `Retry-After` support.
- `src/schemas/*.schema.js`: Zod schemas per domain (auth/user/unit/objective/kpi/feedback/notification/company/okrAi).
- `src/utils/context.js`: AsyncLocalStorage context container used by auth and DB-aware services.
- `src/utils/notification.js`, `src/utils/notificationHelper.js`: Notification message generation and persistence helper flow.
- `src/utils/prisma.js`: Prisma client singleton.
- `src/utils/redis.js`: Redis client initialization/helpers.
- `src/jobs/resetTokenUsage.job.js`: Monthly token reset scheduler.
- `src/jobs/feedback.smoke.js`: Empty placeholder script.
- `prisma/schema.prisma`: Core data model including feedback + notification tables and expanded enums.
- `prisma.config.js`: Prisma schema/migration/seed config.
- `scripts/studio.js`: Launches Prisma Studio with `DATABASE_ADMIN_URL` override.

### Important Corrections vs Older Notes

- Active auth flow is login/refresh/session-based; `signup` endpoint is not present in current `auth.route.js`.
- Access + refresh cookies are both used; token lifecycle is 15m access with refresh rotation.
- Objective status and KPI status now share expanded `ProgressStatus` values.
- Feedback and notification features are first-class modules in API and schema.
- Repo currently uses `.env` (no `.env.development` or `.env.docker` file in workspace root).

---

## 📈 Performance Optimization

### Current Optimizations

1. **Prisma Raw Queries:** ltree operations use raw SQL for best performance
2. **CTEs (Common Table Expressions):** Used for complex stats aggregations
3. **Pagination:** Root entities only (tree structure client-side)
4. **Connection Pooling:** PrismaPg handles via native Postgres driver
5. **Indexes:** Foreign keys, company_id, soft deletes

### Future Optimizations

- Add Redis caching for frequently accessed data (units, cycles)
- Implement GraphQL for flexible querying
- Database query profiling: `EXPLAIN ANALYZE`
- Implement API rate limiting

---

## 📚 Additional Resources

- **Prisma Docs:** https://www.prisma.io/docs
- **PostgreSQL ltree:** https://www.postgresql.org/docs/current/ltree.html
- **Express.js Guide:** https://expressjs.com/
- **Cloudinary SDK:** https://cloudinary.com/documentation/node_integration
- **Swagger/OpenAPI:** https://swagger.io/specification/

---

## 👥 Team & Contribution

**Created:** Backend team
**Current Maintainers:** [Tyler Pham]
**Last Updated:** April 16, 2026

### Git Workflow

- Main branch: production-ready code
- Feature branches: `feature/xxx`
- Migrations: Run before deployment
- Tests: Configure in package.json

---

## 📝 License

ISC
