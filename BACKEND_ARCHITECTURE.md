# Project Guardian: Backend & Event Bus Architecture

This document provides a comprehensive specification of the Core Backend in Project Guardian (`/backend`). It details the **NestJS 11** Fastify architecture, REST API controllers, Apollo GraphQL module, Socket.IO Real-Time Gateway, authentication flow, and server-side rate limiting / throttling strategy.

---

## 1. Core Architecture Overview

The backend uses a **"One Backend, Two Doors" Dual-API & Event Bus** architecture built with **NestJS 11**, **Fastify Adapter**, **Apollo GraphQL**, **Prisma ORM 7**, and **Socket.io**:

```
                  ┌─────────────────────────────────────────┐
                  │              HTTP / HTTPS               │
                  └────┬───────────────────────────────┬────┘
                       │                               │
                       ▼                               ▼
            ┌─────────────────────┐        ┌───────────────────────┐
            │ Fastify REST API    │        │ Apollo GraphQL Server │
            │ (/api/auth, etc.)   │        │       (/graphql)      │
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
├── prisma/
│   └── schema.prisma                 # Prisma ORM models and PostgreSQL enums
├── src/
│   ├── app.module.ts                 # Root application module wiring all submodules
│   ├── main.ts                       # Fastify application bootstrap & CORS/Multipart setup
│   ├── auth/                         # JWT Authentication & Passport Strategy
│   │   ├── auth.controller.ts        # POST /api/auth/register, POST /api/auth/login
│   │   ├── auth.module.ts            # AuthModule definition & JwtModule config
│   │   ├── auth.service.ts           # User authentication, bcrypt hashing & JWT signing
│   │   ├── dto/                      # RegisterDto, LoginDto
│   │   ├── jwt-auth.guard.ts         # Fastify-compatible JWT Auth Guard
│   │   └── jwt.strategy.ts           # Passport JWT Strategy extraction
│   ├── common/                       # Shared decorators (e.g. CurrentUser)
│   ├── gateway/                      # Real-time WebSocket Gateway
│   │   ├── gateway.module.ts         # GatewayModule definition
│   │   ├── sos.gateway.ts            # Socket.io gateway handling SOS, location & broadcast
│   │   └── types/socket.types.ts     # TypeScript interfaces for WebSocket payloads
│   ├── graphql/                      # Apollo GraphQL Module
│   │   ├── graphql.module.ts         # GraphQLModule configuring Apollo Driver on Fastify
│   │   ├── models/                   # GraphQL ObjectTypes (User, Incident, LocationLog)
│   │   └── resolvers/                # GraphQL Resolvers (UsersResolver, IncidentsResolver)
│   ├── incidents/                    # Incidents & Location Telemetry Module
│   │   ├── incidents.controller.ts   # REST endpoints for incidents, locations, audio vault
│   │   ├── incidents.module.ts       # IncidentsModule definition
│   │   ├── incidents.service.ts      # Incident CRUD, Redis throttling & S3 presigning
│   │   └── dto/                      # CreateIncidentDto
│   ├── notifications/                # Multi-channel emergency alert service
│   │   ├── notifications.module.ts
│   │   └── notifications.service.ts  # SMS & automated emergency notification dispatcher
│   ├── prisma/                       # Database persistence layer
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts         # PrismaClient lifecycle hook provider
│   ├── redis/                        # In-memory caching & Geospatial indexing
│   │   ├── redis.module.ts
│   │   └── redis.service.ts          # ioredis client provider (GEOADD, GEOSEARCH, session)
│   ├── users/                        # User profile management
│   │   ├── users.controller.ts       # GET /api/users/me, PUT /api/users/me, contacts
│   │   ├── users.module.ts
│   │   └── users.service.ts          # User and EmergencyContact database operations
│   └── volunteers/                   # Sentinel mesh opt-in
│       ├── volunteers.controller.ts  # POST /api/volunteers/opt-in
│       ├── volunteers.module.ts
│       └── volunteers.service.ts     # Volunteer status toggling & Redis GEO registration
├── uploads/evidence/                 # Local directory for stored audio vault payloads
├── .env                              # Environment variables (DATABASE_URL, REDIS_URL, etc.)
├── package.json                      # NestJS 11 & Fastify dependencies
└── tsconfig.json                     # TypeScript configuration
```

---

## 3. API Specifications & Contracts

### A. Synchronous REST API Routes (Fastify Controllers)

#### 1. Authentication Controller (`/api/auth`)
* `POST /api/auth/register`
  * **Body**: `{ "phone": "string", "password": "string", "name": "string", "role"?: "USER" | "RESPONDER" | "ADMIN" }`
  * **Action**: Hashes password using `bcryptjs` (salt rounds: 10), creates User in PostgreSQL via Prisma, returns signed JWT token.
* `POST /api/auth/login`
  * **Body**: `{ "phone": "string", "password": "string" }`
  * **Action**: Verifies phone and password with bcrypt, returns signed JWT token and user profile object.

#### 2. User Profile Controller (`/api/users`)
* `GET /api/users/me`
  * **Headers**: `Authorization: Bearer <token>`
  * **Response**: Returns user record including emergency contacts.
* `PUT /api/users/me`
  * **Headers**: `Authorization: Bearer <token>`
  * **Body**: `{ "name"?: string, "isVolunteer"?: boolean, "mlSensitivity"?: "LOW" | "MEDIUM" | "HIGH" }`
  * **Response**: Updated user record.
* `POST /api/users/me/emergency-contacts`
  * **Headers**: `Authorization: Bearer <token>`
  * **Body**: `{ "contactName": string, "phoneNumber": string, "priorityOrder"?: number }`
  * **Response**: Newly created emergency contact.
* `DELETE /api/users/me/emergency-contacts/:id`
  * **Headers**: `Authorization: Bearer <token>`
  * **Response**: Deleted emergency contact confirmation.

#### 3. Incidents Controller (`/api/incidents`)
* `POST /api/incidents`
  * **Headers**: `Authorization: Bearer <token>`
  * **Body**: `{ "lat": number, "lng": number, "triggerType": "MANUAL_SOS" | "AUDIO_SCREAM" | "DEVICE_SNATCH" | "DEAD_MAN_SWITCH", "batteryLevel"?: number, "evidenceAudioUrl"?: string }`
  * **Response**: Created incident record.
* `POST /api/incidents/:id/location`
  * **Body**: `{ "lat": number, "lng": number, "batteryLevel"?: number }`
  * **Action**: Throttled insertion into PostgreSQL with real-time Redis cache update.
* `POST /api/incidents/:id/evidence`
  * **Headers**: `Authorization: Bearer <token>`
  * **Body**: Multipart audio stream, Base64 audio payload (`audioBase64`), or direct URL (`evidenceAudioUrl`).
  * **Action**: Saves evidence file to `/uploads/evidence`, updates incident record with URL.
* `GET /api/incidents`
  * **Query**: `?status=ACTIVE|DISPATCHED|RESOLVED|FALSE_ALARM`
  * **Response**: List of incidents matching filter with location logs and user relation.
* `GET /api/incidents/active/count`
  * **Response**: `{ "activeIncidentsCount": number }`
* `GET /api/incidents/:id`
  * **Response**: Detailed incident with victim info, responder info, and breadcrumb logs.
* `PATCH /api/incidents/:id/status`
  * **Body**: `{ "status": "ACTIVE" | "DISPATCHED" | "RESOLVED" | "FALSE_ALARM" }`
  * **Action**: Updates incident status and broadcasts `incident:status_changed` over Socket.IO.
* `POST /api/incidents/:id/notify-contacts`
  * **Action**: Dispatches emergency SMS notifications to the victim's saved contacts.
* `GET /api/incidents/:id/audio-presigned-url`
  * **Response**: Short-lived presigned URL for playback.

#### 4. Volunteers Controller (`/api/volunteers`)
* `POST /api/volunteers/opt-in`
  * **Headers**: `Authorization: Bearer <token>`
  * **Response**: Toggles `isVolunteer: true` and initializes Redis GEO status.

---

## 4. GraphQL Schema & Resolvers (`/graphql`)

Mounted via `@nestjs/apollo` with Fastify driver at `/graphql`:

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
  evidenceAudioUrl: String
  locationLogs: [LocationLog!]!
  user: User!
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

## 5. Socket.io Real-Time Event Bus (`SosGateway`)

WebSockets authenticate during connection via `socket.handshake.auth.token` or `Authorization` headers.

| Incoming Event | Payload | Action |
| :--- | :--- | :--- |
| `distress:triggered` | `{ lat, lng, triggerType, batteryLevel, evidenceAudioUrl }` | 1. Creates `Incident` record in Postgres (`ACTIVE`).<br>2. Joins client to `room:inc_${incident.id}`.<br>3. Emits `distress:acknowledged` to sender.<br>4. Searches Redis GEO (`volunteers:active_locations`) within 500m.<br>5. Emits `nearby:broadcast` to nearby volunteers and `room:responders`.<br>6. Emits `incident:new` globally. |
| `location:update` | `{ incidentId, lat, lng, batteryLevel }` | 1. Throttles DB write (max 1 write per 2s to Postgres).<br>2. Updates Redis cache.<br>3. Broadcasts `location:update` to `room:inc_${id}` and `room:responders`.<br>4. Emits `location:breadcrumb` globally. |
| `volunteer:location_update` | `{ volunteerId, lat, lng }` | Updates Redis GEO: `GEOADD volunteers:active_locations lng lat volunteerId`. |
| `join:incident` | `{ incidentId }` | Adds socket connection to `room:inc_${incidentId}`. |
| `responder:status_change` | `{ incidentId, status, responderId, estimatedArrivalMins }` | Updates Postgres record and emits `events.responder.status_change`, `incident:status_changed`, and `responder:status_changed`. |
| `system:config_update` | `{ type, newWeights, ... }` | Broadcasts `events.system.configuration_update` globally to edge devices. |

---

## 6. Server-Side Rate-Limiting & Throttling Blueprint

To protect PostgreSQL connections during continuous 1-second GPS location streams, server-side throttling is enforced in `incidents.service.ts`:

```typescript
// Throttled Postgres Log Insertion in IncidentsService
const lastDbWriteKey = `incident:${incidentId}:last_db_write`;
const now = Math.floor(Date.now() / 1000);
const lastWrite = await this.redisService.getClient().get(lastDbWriteKey);

// 1. Redis Cache is always updated immediately for sub-millisecond tracking
await this.redisService.getClient().set(
  `incident:${incidentId}:active`,
  JSON.stringify({ lat, lng, batteryLevel, lastUpdated: now }),
  'EX',
  3600
);

// 2. PostgreSQL insertions are throttled to 1 write every 2 seconds per incident
if (!lastWrite || now - parseInt(lastWrite, 10) >= 2) {
  await this.redisService.getClient().set(lastDbWriteKey, now.toString(), 'EX', 3600);
  await this.prisma.incidentLocationLog.create({
    data: { incidentId, lat, lng, batteryLevel },
  });
}
```

---

## 7. Step-by-Step Backend Launch Commands

```bash
# 1. Enter backend directory
cd backend

# 2. Install dependencies
bun install

# 3. Generate Prisma client & sync database
bunx prisma generate
bunx prisma db push

# 4. Start NestJS development server
bun run dev
```
