# Project Guardian: Database & Storage Schema

To ensure the platform is highly reliable and performant during an emergency, we use a hybrid storage approach. This document defines the relational database tables, in-memory structures, and audio vault storage contracts.

---

## 1. PostgreSQL (Permanent Core Data via Prisma ORM)

PostgreSQL is our single source of truth. It stores relational data, historical records, and user profiles. We use standard UUIDs for all primary keys.

### Table: `users`
Stores all end-users, admins, and responders.
- `id` (UUID, Primary Key)
- `phone` (String, Unique, Indexed)
- `password_hash` (String)
- `name` (String)
- `role` (Enum: `USER`, `RESPONDER`, `ADMIN`, default: `USER`)
- `is_volunteer` (Boolean, default: `false`)
- `ml_sensitivity` (Enum: `LOW`, `MEDIUM`, `HIGH`, default: `MEDIUM`)
- `created_at` (Timestamp with Time Zone)

### Table: `emergency_contacts`
A one-to-many relationship with `users` for automated SMS fallback.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key -> `users.id` with `onDelete: Cascade`)
- `contact_name` (String)
- `phone_number` (String)
- `priority_order` (Integer, default: 1)
- `created_at` (Timestamp with Time Zone)

### Table: `incidents` (The Emergency Ledger)
Stores the official record of a distress signal.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key -> `users.id` with `onDelete: Cascade`)
- `trigger_type` (Enum: `MANUAL_SOS`, `AUDIO_SCREAM`, `DEVICE_SNATCH`, `DEAD_MAN_SWITCH`)
- `status` (Enum: `ACTIVE`, `DISPATCHED`, `RESOLVED`, `FALSE_ALARM`, default: `ACTIVE`)
- `started_at` (Timestamp with Time Zone)
- `resolved_at` (Timestamp with Time Zone, Nullable)
- `resolved_by_user_id` (UUID, Foreign Key -> `users.id`, Nullable)
- `evidence_audio_url` (String, Nullable) — Link to local `/uploads/evidence` or encrypted S3 vault

### Table: `incident_location_logs`
The historical breadcrumb trail for an incident (written through server-side 2-second rate-throttling to prevent DB connection saturation).
- `id` (UUID, Primary Key)
- `incident_id` (UUID, Foreign Key -> `incidents.id` with `onDelete: Cascade`)
- `lat` (Float / Double Precision)
- `lng` (Float / Double Precision)
- `battery_level` (Integer, Nullable)
- `logged_at` (Timestamp with Time Zone)

---

## 2. Redis (Real-Time In-Memory Broker & Cache)

Redis is used exclusively for ephemeral, high-speed data, proximity indexing, and throttling locks.

### A. Active Incident Cache
Fast lookup for the current state of an ongoing emergency.
- **Key**: `incident:${incidentId}:active`
- **Value** (JSON):
  ```json
  {
    "lat": 40.7128,
    "lng": -74.0060,
    "batteryLevel": 85,
    "lastUpdated": 1773900000
  }
  ```
- **TTL**: 3600 seconds (1 Hour).

### B. Volunteer Geospatial Index (Redis GEO)
Used to instantly calculate which volunteers are within 500 meters of a distress signal.
- **Key**: `volunteers:active_locations`
- **Commands**:
  - `GEOADD volunteers:active_locations -74.0060 40.7128 "user_id_456"` (When volunteer location updates).
  - `GEOSEARCH volunteers:active_locations FROMLONLAT -74.0060 40.7128 BYRADIUS 500 m` (Finds volunteers within 500 meters in `< 1ms`).

### C. User Socket Session Map
- **Key**: `user:socket:${userId}`
- **Value**: Socket ID string (e.g. `s_abc123`)
- **TTL**: 86400 seconds (24 Hours).

---

## 3. Evidence Audio Storage Vault

Large audio buffers and recordings are never stored inside PostgreSQL rows.
- **Local Storage**: Files saved under `/backend/uploads/evidence/evidence_${incidentId}_${timestamp}.m4a`.
- **Cloud S3 Bucket**: `guardian-evidence-vault` with 300-second Presigned URLs for authenticated responder and admin playback.
