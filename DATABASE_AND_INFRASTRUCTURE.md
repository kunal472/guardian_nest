# Project Guardian: Database, Redis & Infrastructure Architecture

This document provides a comprehensive specification of the data storage layers, in-memory caching engines, cloud evidence storage, and Docker container infrastructure in Project Guardian.

---

## 1. Primary Database: PostgreSQL (Prisma ORM)

PostgreSQL serves as the primary relational database for permanent data persistence.

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

### C. Native SQL Bootstrap Script (`db/init.sql`)
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('USER', 'RESPONDER', 'ADMIN');
CREATE TYPE ml_sensitivity AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE trigger_type AS ENUM ('MANUAL_SOS', 'AUDIO_SCREAM', 'DEVICE_SNATCH', 'DEAD_MAN_SWITCH');
CREATE TYPE incident_status AS ENUM ('ACTIVE', 'DISPATCHED', 'RESOLVED', 'FALSE_ALARM');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'USER',
    is_volunteer BOOLEAN DEFAULT FALSE,
    ml_sensitivity ml_sensitivity DEFAULT 'MEDIUM',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE emergency_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    contact_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    priority_order INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    trigger_type trigger_type NOT NULL,
    status incident_status DEFAULT 'ACTIVE',
    startedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by_user_id UUID REFERENCES users(id),
    evidence_audio_url VARCHAR(1024)
);

CREATE TABLE incident_location_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    battery_level INTEGER,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. In-Memory Engine: Redis Data Structures

Redis is used for high-velocity session caching, ephemeral incident states, and sub-millisecond geospatial indexing.

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
       "userId": "u_123",
       "lastLat": 40.7128,
       "lastLng": -74.0060,
       "lastUpdated": 1770800000,
       "activeResponders": ["u_456"]
     }
     ```
   * **TTL**: 3600 seconds (1 Hour)

3. **Active Volunteer Geospatial Index (Redis GEO)**
   * **Key**: `volunteers:active_locations`
   * **Data Structure**: Sorted Set (Geospatial Index)
   * **Commands**:
     ```bash
     # Add/Update Volunteer location
     GEOADD volunteers:active_locations -74.0060 40.7128 "user_id_456"

     # Search for volunteers within 500 meters of SOS coordinates
     GEOSEARCH volunteers:active_locations FROMLONLAT -74.0060 40.7128 BYRADIUS 500 m
     ```

---

## 3. Object Storage: AWS S3 Evidence Vault

* **Bucket Name**: `guardian-evidence-vault`
* **Object Path Structure**: `/{incident_id}/evidence_{timestamp}.m4a`
* **Access Pattern**: Audio chunks (30s encrypted PCM/M4A) uploaded directly from mobile client. Admins generate short-lived **AWS Presigned URLs** (valid for 300s) via Apollo GraphQL resolvers to play back audio.

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
      - ./backend/db/init.sql:/docker-entrypoint-initdb.d/init.sql

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

## 5. Master Recreation Guide (End-to-End Environment Setup)

To recreate the entire infrastructure and bring up all database services from scratch:

```bash
# 1. Clone & enter repository
git clone <repository_url>
cd guardian_new

# 2. Start PostgreSQL 15 & Redis 7 Docker Containers
docker-compose up -d

# 3. Verify Docker services are running
docker ps

# 4. Run Prisma database migrations inside backend
cd backend
bun install
npx prisma db push

# 5. Launch Core Backend API & Socket Server
bun dev

# 6. Launch Responder Dashboard (in separate terminal)
cd ../dashboards/responder_dashboard
bun install
bun dev

# 7. Launch Admin Dashboard (in separate terminal)
cd ../admin_dashboard
bun install
bun dev

# 8. Launch Mobile Edge Client (in separate terminal)
cd ../../mobile
bun install
bun start
```
