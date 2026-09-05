# Project Guardian: Backend & Event Bus Architecture

This document provides a complete specification of the Core Backend in Project Guardian (`/backend`). It details the REST API routes, Apollo GraphQL Server, Socket.io Real-Time Gateway, authentication flow, and server-side rate limiting / throttling strategy.

---

## 1. Core Architecture Overview

The backend uses a **"One Backend, Two Doors" Dual-API & Event Bus** architecture built with Node.js/Bun, Express, Apollo GraphQL, Prisma, and Socket.io:

```
                  ┌─────────────────────────────────────────┐
                  │              HTTP / HTTPS               │
                  └────┬───────────────────────────────┬────┘
                       │                               │
                       ▼                               ▼
            ┌─────────────────────┐        ┌───────────────────────┐
            │  REST API Gateway   │        │ GraphQL Apollo Server │
            │  (/api/auth, etc.)  │        │       (/graphql)      │
            └──────────┬──────────┘        └───────────┬───────────┘
                       │                               │
                       └───────────────┬───────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │  PostgreSQL Database (Prisma) │
                       └───────────────────────────────┘
                                       ▲
                                       │
            ┌──────────────────────────┴───────────────┐
            │ Real-Time Socket.io Event Bus Gateway    │
            │ (distress:triggered, location:update)    │
            └──────────────────────────┬───────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │     Redis Cache & GEO Index   │
                       └───────────────────────────────┘
```

---

## 2. Directory & File Breakdown (`/backend`)

```
backend/
├── config/
│   └── db.ts                # Prisma client and Redis client connections
├── db/
│   └── init.sql             # Native SQL bootstrap script for PostgreSQL
├── graphql/
│   ├── context.ts           # GraphQL request context (Auth extraction)
│   ├── resolvers.ts         # Resolvers for User & Incident queries/mutations
│   └── schema.ts            # Type definitions for Apollo Server
├── middleware/
│   └── auth.ts              # Express JWT middleware & TypeScript types
├── prisma/
│   └── schema.prisma        # Prisma ORM models and enums
├── routes/
│   ├── auth.ts              # POST /api/auth/register, POST /api/auth/login
│   ├── users.ts             # GET /api/users/me, PUT /api/users/me
│   └── volunteers.ts        # POST /api/volunteers/opt-in
├── sockets/
│   └── sosHandler.ts        # Socket.io listeners (SOS trigger, location updates)
├── types/
│   └── socket.ts            # Socket payload interfaces & strict event contracts
├── .env                     # Environment configuration variables
├── package.json             # Scripts & npm/bun dependencies
├── server.ts                # HTTP, Express, GraphQL & Socket.io server entrypoint
└── tsconfig.json            # TypeScript configuration
```

---

## 3. API Specifications & Contracts

### A. Synchronous REST API Routes

#### 1. Authentication Router (`/api/auth`)
* `POST /api/auth/register`
  * **Body**: `{ "phone": "string", "password": "string", "name": "string", "role"?: "USER" | "RESPONDER" | "ADMIN" }`
  * **Action**: Hashes password using Bun password hashing (`Bun.password.hash`), creates User record in PostgreSQL via Prisma, returns JWT token signed with `JWT_SECRET`.
* `POST /api/auth/login`
  * **Body**: `{ "phone": "string", "password": "string" }`
  * **Action**: Verifies user phone and password hash (`Bun.password.verify`), returns signed JWT token and user profile object.

#### 2. User Profile Router (`/api/users`)
* `GET /api/users/me`
  * **Headers**: `Authorization: Bearer <token>`
  * **Response**: Returns full user record including emergency contacts.
* `PUT /api/users/me`
  * **Headers**: `Authorization: Bearer <token>`
  * **Body**: `{ "name"?: string, "isVolunteer"?: boolean, "mlSensitivity"?: "LOW"|"MEDIUM"|"HIGH" }`
  * **Response**: Updated user record.

#### 3. Volunteer Network Router (`/api/volunteers`)
* `POST /api/volunteers/opt-in`
  * **Headers**: `Authorization: Bearer <token>`
  * **Response**: Toggles `isVolunteer: true` on user record and initializes volunteer state in Redis.

---

### B. GraphQL Schema & Resolvers (`/graphql`)

Apollo Server mounted at `/graphql` serves complex analytical requests for the Admin Dashboard.

```graphql
enum UserRole { USER RESPONDER ADMIN }
enum MlSensitivity { LOW MEDIUM HIGH }
enum TriggerType { MANUAL_SOS AUDIO_SCREAM DEVICE_SNATCH DEAD_MAN_SWITCH }
enum IncidentStatus { ACTIVE DISPATCHED RESOLVED FALSE_ALARM }

type User {
  id: ID!
  phone: String!
  name: String!
  role: UserRole!
  isVolunteer: Boolean!
  mlSensitivity: MlSensitivity!
  createdAt: String!
  incidents: [Incident!]!
}

type Incident {
  id: ID!
  userId: String!
  triggerType: TriggerType!
  status: IncidentStatus!
  startedAt: String!
  resolvedAt: String
  resolvedByUserId: String
  locationLogs: [LocationLog!]!
}

type LocationLog {
  id: ID!
  lat: Float!
  lng: Float!
  batteryLevel: Int
  loggedAt: String!
}

type Query {
  users: [User!]!
  user(id: ID!): User
  incidents(status: IncidentStatus): [Incident!]!
  incident(id: ID!): Incident
  activeIncidentsCount: Int!
}

type Mutation {
  updateUserRole(userId: ID!, role: UserRole!): User!
  resolveIncident(incidentId: ID!, status: IncidentStatus!): Incident!
}
```

---

### C. Socket.io Real-Time Event Bus (`/sockets/sosHandler.ts`)

WebSockets are authenticated via handshake JWT tokens (`socket.handshake.auth.token`). Upon connection:
1. User socket ID is cached in Redis: `user:socket:${userId} -> socket.id` (24h TTL).
2. Socket registers the following event listeners:

| Event | Payload | Action |
| :--- | :--- | :--- |
| `distress:triggered` | `{ userId, lat, lng, triggerType, batteryLevel }` | 1. Creates `Incident` record in Postgres (`ACTIVE`).<br>2. Caches `incident:${id}:active` in Redis.<br>3. Logs initial location entry.<br>4. Emits `distress:acknowledged` to client.<br>5. Searches Redis GEO (`volunteers:active_locations`) within 500m.<br>6. Sends `nearby:broadcast` to nearby volunteer sockets. |
| `location:update` | `{ incidentId, lat, lng, batteryLevel }` | 1. Updates Redis active incident cache.<br>2. Inserts location log in Postgres.<br>3. Emits `nearby:broadcast` to room `room:inc_${incidentId}`. |
| `volunteer:location_update` | `{ volunteerId, lat, lng }` | Updates Redis GEO index: `GEOADD volunteers:active_locations lng lat volunteerId`. |
| `join:incident` | `{ incidentId }` | Adds socket connection to room `room:inc_${incidentId}`. |
| `responder:status_change` | `{ incidentId, responderId, status }` | Updates Redis cache & Postgres status (`DISPATCHED`, `RESOLVED`), broadcasts update to incident room. |

---

## 4. Server-Side Rate-Limiting & Throttling Blueprint

To protect PostgreSQL from payload flooding during high-frequency GPS streams, server-side throttling should be enforced in `sosHandler.ts`:

```typescript
// Throttled Postgres Log Insertion Blueprint
const lastDbWriteKey = `incident:${data.incidentId}:last_db_write`;
const now = Math.floor(Date.now() / 1000);
const lastWrite = await redisClient.get(lastDbWriteKey);

// 1. Redis is always updated immediately for real-time tracking
await redisClient.set(cacheKey, JSON.stringify(incidentData), { EX: 3600 });

// 2. PostgreSQL insertions are throttled to 1 write every 2 seconds per incident
if (!lastWrite || now - parseInt(lastWrite, 10) >= 2) {
  await redisClient.set(lastDbWriteKey, now.toString(), { EX: 3600 });
  await prisma.incidentLocationLog.create({
    data: {
      incidentId: data.incidentId,
      lat: data.lat,
      lng: data.lng,
      batteryLevel: data.batteryLevel
    }
  });
}
```

---

## 5. Step-by-Step Backend Recreation Commands

```bash
# 1. Initialize backend directory
mkdir backend && cd backend
bun init -y

# 2. Install dependencies
bun add express cors dotenv jsonwebtoken pg redis socket.io @prisma/client @prisma/adapter-pg @apollo/server @as-integrations/express4 graphql

# 3. Install dev dependencies
bun add -d @types/express @types/jsonwebtoken @types/bun prisma socket.io-client typescript

# 4. Initialize Prisma
npx prisma init

# 5. Start Server (Development Mode)
bun run --watch server.ts
```
