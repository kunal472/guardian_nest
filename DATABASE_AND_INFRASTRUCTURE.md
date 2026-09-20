# Project Guardian: Database, Redis & Infrastructure Architecture

This document provides a comprehensive specification of the data storage layers, in-memory caching engines, encrypted evidence storage, and Docker container infrastructure in Project Guardian.

---

## 1. Primary Database: PostgreSQL (Prisma ORM)

PostgreSQL serves as the primary relational database for permanent data persistence, managed via **Prisma ORM 7** with the `@prisma/adapter-pg` driver.

### A. Environment Configuration (`.env`)
```env
DATABASE_URL="postgresql://admin:password@localhost:5432/guardian?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=3000
JWT_SECRET="guardian_jwt_secret_key_123!"
```

### B. Prisma Schema Definition (`prisma/schema.prisma`)
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  USER
  RESPONDER
  ADMIN
}

enum MlSensitivity {
  LOW
  MEDIUM
  HIGH
}

enum TriggerType {
  MANUAL_SOS
  AUDIO_SCREAM
  DEVICE_SNATCH
  DEAD_MAN_SWITCH
}

enum IncidentStatus {
  ACTIVE
  DISPATCHED
  RESOLVED
  FALSE_ALARM
}

model User {
  id                String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  phone             String             @unique @db.VarChar(20)
  passwordHash      String             @map("password_hash") @db.VarChar(255)
  name              String             @db.VarChar(255)
  role              UserRole           @default(USER)
  isVolunteer       Boolean            @default(false) @map("is_volunteer")
  mlSensitivity     MlSensitivity      @default(MEDIUM) @map("ml_sensitivity")
  createdAt         DateTime           @default(now()) @map("created_at") @db.Timestamptz
  emergencyContacts EmergencyContact[]
  incidents         Incident[]         @relation("UserIncidents")
  resolvedIncidents Incident[]         @relation("ResolvedIncidents")

  @@map("users")
}

model EmergencyContact {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId        String   @map("user_id") @db.Uuid
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  contactName   String   @map("contact_name") @db.VarChar(255)
  phoneNumber   String   @map("phone_number") @db.VarChar(20)
  priorityOrder Int      @default(1) @map("priority_order")
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@map("emergency_contacts")
}

model Incident {
  id                String                @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId            String                @map("user_id") @db.Uuid
  user              User                  @relation("UserIncidents", fields: [userId], references: [id], onDelete: Cascade)
  triggerType       TriggerType           @map("trigger_type")
  status            IncidentStatus        @default(ACTIVE)
  startedAt         DateTime              @default(now()) @map("started_at") @db.Timestamptz
  resolvedAt        DateTime?             @map("resolved_at") @db.Timestamptz
  resolvedByUserId  String?               @map("resolved_by_user_id") @db.Uuid
  resolvedByUser    User?                 @relation("ResolvedIncidents", fields: [resolvedByUserId], references: [id])
  evidenceAudioUrl  String?               @map("evidence_audio_url") @db.VarChar(1024)
  locationLogs      IncidentLocationLog[]

  @@map("incidents")
}

model IncidentLocationLog {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  incidentId   String   @map("incident_id") @db.Uuid
  incident     Incident @relation(fields: [incidentId], references: [id], onDelete: Cascade)
  lat          Float
  lng          Float
  batteryLevel Int?     @map("battery_level")
  loggedAt     DateTime @default(now()) @map("logged_at") @db.Timestamptz

  @@map("incident_location_logs")
}
```

---

## 2. In-Memory Engine: Redis Data Structures

Redis 7 (via `ioredis`) is used for real-time session caching, sub-millisecond proximity queries, and database write throttling locks.

### Key Schemas & Data Formats

1. **User Socket Session Map**
   * **Key**: `user:socket:${userId}`
   * **Value**: Socket ID string (e.g. `s_abc123`)
   * **TTL**: 86400 seconds (24 Hours)

2. **Active Incident Real-Time Cache**
   * **Key**: `incident:${incidentId}:active`
   * **Value**:
     ```json
     {
       "lat": 40.7128,
       "lng": -74.0060,
       "batteryLevel": 85,
       "lastUpdated": 1773900000
     }
     ```
   * **TTL**: 3600 seconds (1 Hour)

3. **Active Volunteer Geospatial Index (Redis GEO)**
   * **Key**: `volunteers:active_locations`
   * **Data Structure**: Geospatial Index (Sorted Set)
   * **Operations**:
     ```typescript
     // Add or update volunteer position
     await redis.geoadd('volunteers:active_locations', lng, lat, volunteerId);

     // Query volunteers within 500m radius of SOS coordinates
     const nearbyVolunteers = await redis.geosearch(
       'volunteers:active_locations',
       'FROMLONLAT', lng, lat,
       'BYRADIUS', 500, 'm'
     );
     ```

4. **Postgres Write Throttling Key**
   * **Key**: `incident:${incidentId}:last_db_write`
   * **Value**: Unix timestamp (seconds) of the last persistent write to `incident_location_logs`.
   * **TTL**: 3600 seconds

---

## 3. Evidence Storage & Audio Vault

* **Local Vault**: Handled by Fastify multipart and stream storage in `/backend/uploads/evidence/evidence_${incidentId}_${timestamp}.m4a`.
* **Cloud Vault (AWS S3)**: Encrypted private bucket with short-lived Presigned URLs generated dynamically via `/api/incidents/:id/audio-presigned-url` (valid for 300 seconds).

---

## 4. Container Orchestration: Docker Compose (`docker-compose.yml`)

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: guardian_postgres
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
      POSTGRES_DB: guardian
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: guardian_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 5. Master Environment Setup Guide

```bash
# 1. Start PostgreSQL 15 & Redis 7 Docker Containers
docker compose up -d

# 2. Setup & Launch NestJS Backend
cd backend
bun install
bunx prisma generate
bunx prisma db push
bun run dev

# 3. Launch Responder Dashboard
cd ../dashboards/responder_dashboard
bun install
bun dev

# 4. Launch Admin Dashboard
cd ../admin_dashboard
bun install
bun dev

# 5. Launch Mobile Edge Client
cd ../../mobile
bun install
bun run start
```
