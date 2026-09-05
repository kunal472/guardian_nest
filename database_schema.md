# Project Guardian: Database & Storage Schema

To ensure the platform is highly reliable and performant during an emergency, we use a hybrid storage approach. This document defines the exact table structures, key-value formats, and storage buckets so developers can easily reference them when building the features.

---

## 1. PostgreSQL (Permanent Core Data)

PostgreSQL is our single source of truth. It stores relational data, historical records, and user profiles. We use standard UUIDs for all primary keys.

### Table: `users`
Stores all end-users, admins, and responders.
- `id` (UUID, Primary Key)
- `phone` (String, Unique, Indexed)
- `password_hash` (String)
- `name` (String)
- `role` (Enum: `USER`, `RESPONDER`, `ADMIN`)
- `is_volunteer` (Boolean, default: false)
- `ml_sensitivity` (Enum: `LOW`, `MEDIUM`, `HIGH`, default: `MEDIUM`)
- `created_at` (Timestamp)

### Table: `emergency_contacts`
A one-to-many relationship with `users` for automated SMS fallback.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key -> `users.id`)
- `contact_name` (String)
- `phone_number` (String)
- `priority_order` (Integer)

### Table: `incidents` (The "Paper Trail")
Stores the official record of a distress signal.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key -> `users.id`)
- `trigger_type` (Enum: `MANUAL_SOS`, `AUDIO_SCREAM`, `DEVICE_SNATCH`, `DEAD_MAN_SWITCH`)
- `status` (Enum: `ACTIVE`, `DISPATCHED`, `RESOLVED`, `FALSE_ALARM`)
- `started_at` (Timestamp)
- `resolved_at` (Timestamp, Nullable)
- `resolved_by_user_id` (UUID, Foreign Key -> `users.id`, Nullable)
- `evidence_audio_url` (String, Nullable) - *Link to encrypted AWS S3 bucket*

### Table: `incident_location_logs`
The historical breadcrumb trail for an incident (written asynchronously in batches from Redis to avoid locking the DB).
- `id` (UUID, Primary Key)
- `incident_id` (UUID, Foreign Key -> `incidents.id`)
- `lat` (Float)
- `lng` (Float)
- `battery_level` (Integer)
- `logged_at` (Timestamp)

---

## 2. Redis (Real-Time In-Memory Broker)

Redis is used exclusively for ephemeral, high-speed data. If Redis crashes, no permanent data is lost, but active map tracking might briefly stutter.

### A. Active Incident Cache
Fast lookup for the current status of an ongoing emergency.
- **Key**: `incident:{incidentId}:active`
- **Value** (JSON):
  ```json
  {
    "userId": "u_123",
    "lastLat": 40.7128,
    "lastLng": -74.0060,
    "lastUpdated": 1686665000,
    "activeResponders": ["u_456", "u_789"]
  }
  ```
- **TTL (Time to Live)**: Expires 1 hour after resolution.

### B. Volunteer Geospatial Index (Redis GEO)
Used to instantly calculate which volunteers are within a specific radius of a distress signal.
- **Key**: `volunteers:active_locations`
- **Commands Used**:
  - `GEOADD volunteers:active_locations -74.0060 40.7128 "user_id_456"` (When a volunteer opens the app).
  - `GEORADIUS volunteers:active_locations -74.0060 40.7128 500 m` (Finds all volunteers within 500 meters of a triggered SOS in under 1 millisecond).

---

## 3. AWS S3 / Object Storage (Evidence Vault)

We never store binary files inside PostgreSQL. Large files are uploaded directly from the Edge Client to secure cloud storage.

### Bucket: `guardian-evidence-vault`
- **Path Structure**: `/{incident_id}/evidence_{timestamp}.m4a`
- **Security**: Files are encrypted at rest. The bucket is entirely private. 
- **Access Strategy**: When an Admin or Investigator needs to listen to an audio log, the backend generates a short-lived **Presigned URL** (valid for 5 minutes) and passes it via the GraphQL API to the dashboard.
