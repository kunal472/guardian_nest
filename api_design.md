# Project Guardian: API & Event Bus Design

Since our architecture uses a hybrid approach, we define both the synchronous REST & GraphQL APIs (for deterministic CRUD & analytical queries) and the real-time Event Bus (for mission-critical emergency telemetry).

---

## Part 1: Architecture Overview ("One Backend, Two Doors")

Project Guardian utilizes a **Dual-API & WebSocket Event Bus** running on a single **NestJS 11** backend with the **Fastify Adapter**:

1. **REST API for Edge Clients (Mobile/Web)**: Fast, deterministic, and cacheable endpoints for authentication, profile updates, emergency contact management, and multipart/base64 encrypted audio evidence uploads.
2. **GraphQL API for Admin Dashboard**: A single `/graphql` endpoint allowing the admin console to execute complex multi-relational queries (users, historical incidents, responder logs) without over-fetching or multiple round-trips.
3. **Socket.IO Event Bus for Emergency Operations**: Low-latency, bidirectional WebSocket connection for distress triggers, dynamic live GPS location streams, and proximity sentinel alerts.

---

## Part 2: Detailed API Contract & Event Topics

### A. Synchronous REST API (Fastify Controllers)

#### 1. Authentication & User Management (`/api/auth` & `/api/users`)

**Register User**
- **Endpoint**: `POST /api/auth/register`
- **Request Body**:
  ```json
  {
    "phone": "+1234567890",
    "password": "plain_text_password",
    "name": "Jane Doe",
    "role": "USER"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "token": "jwt_token_string",
    "user": {
      "id": "7b8f9e01-2345-6789-abcd-ef0123456789",
      "phone": "+1234567890",
      "name": "Jane Doe",
      "role": "USER"
    }
  }
  ```

**Login**
- **Endpoint**: `POST /api/auth/login`
- **Request Body**:
  ```json
  {
    "phone": "+1234567890",
    "password": "plain_text_password"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "token": "jwt_token_string",
    "user": {
      "id": "7b8f9e01-2345-6789-abcd-ef0123456789",
      "name": "Jane Doe",
      "role": "USER"
    }
  }
  ```

**Get Current User Profile**
- **Endpoint**: `GET /api/users/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response** (`200 OK`):
  ```json
  {
    "id": "7b8f9e01-2345-6789-abcd-ef0123456789",
    "phone": "+1234567890",
    "name": "Jane Doe",
    "role": "USER",
    "isVolunteer": false,
    "mlSensitivity": "MEDIUM",
    "emergencyContacts": [
      {
        "id": "c1234567-89ab-cdef-0123-456789abcdef",
        "contactName": "Emergency Contact 1",
        "phoneNumber": "+1987654321",
        "priorityOrder": 1
      }
    ]
  }
  ```

**Update Profile & ML Sensitivity**
- **Endpoint**: `PUT /api/users/me`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "name": "Jane Doe",
    "isVolunteer": true,
    "mlSensitivity": "HIGH"
  }
  ```
- **Response** (`200 OK`): Updated User object.

**Manage Emergency Contacts**
- **Add Contact**: `POST /api/users/me/emergency-contacts`
- **Delete Contact**: `DELETE /api/users/me/emergency-contacts/:id`

---

#### 2. Incidents & Evidence Management (`/api/incidents`)

**Create Emergency Incident (REST Fallback)**
- **Endpoint**: `POST /api/incidents`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "lat": 40.7128,
    "lng": -74.0060,
    "triggerType": "AUDIO_SCREAM",
    "batteryLevel": 88,
    "evidenceAudioUrl": "/uploads/evidence/evidence_123.m4a"
  }
  ```
- **Response** (`201 Created`): Created Incident object.

**Log Throttled Location Update**
- **Endpoint**: `POST /api/incidents/:id/location`
- **Request Body**:
  ```json
  {
    "lat": 40.7129,
    "lng": -74.0061,
    "batteryLevel": 87
  }
  ```
- **Response** (`200 OK`): `{ "success": true }`

**Upload Encrypted Audio Evidence Vault**
- **Endpoint**: `POST /api/incidents/:id/evidence`
- **Headers**: `Authorization: Bearer <token>`
- **Payload Options**:
  1. *Multipart file stream*: Field name `file`
  2. *Base64 JSON payload*: `{ "audioBase64": "data:audio/m4a;base64,..." }`
  3. *Direct URL*: `{ "evidenceAudioUrl": "https://..." }`
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "incidentId": "inc_123",
    "evidenceAudioUrl": "/uploads/evidence/evidence_inc_123_1773900000.m4a",
    "vaultSize": 145200,
    "timestamp": "2026-06-13T10:00:00.000Z"
  }
  ```

**Get Incident Details & Breadcrumb Logs**
- **Endpoint**: `GET /api/incidents/:id`
- **Response** (`200 OK`): Incident record with `user`, `resolvedByUser`, and `locationLogs` array.

**Update Incident Status**
- **Endpoint**: `PATCH /api/incidents/:id/status`
- **Request Body**:
  ```json
  {
    "status": "DISPATCHED"
  }
  ```
- **Response** (`200 OK`): Updated Incident record.

**Notify Emergency Contacts (SMS Fallback)**
- **Endpoint**: `POST /api/incidents/:id/notify-contacts`
- **Response** (`200 OK`): Dispatched SMS status report.

---

### B. GraphQL API (Admin Intelligence Console)

Mounted at `/graphql` via Apollo Server on Fastify.

```graphql
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

### C. Socket.IO Real-Time Event Bus (`SosGateway`)

WebSockets run on the primary server port (`ws://localhost:3000`).

#### 1. Distress Triggered
- **Event:** `distress:triggered`
- **Publisher:** Mobile Client (SOS button, scream detector, or snatch trigger)
- **Payload Schema:**
  ```json
  {
    "userId": "u_123",
    "lat": 40.7128,
    "lng": -74.0060,
    "triggerType": "AUDIO_SCREAM",
    "batteryLevel": 85,
    "evidenceAudioUrl": "/uploads/evidence/vault_123.m4a"
  }
  ```
- **Server Actions:**
  1. Creates `Incident` record in PostgreSQL (`status: ACTIVE`).
  2. Emits `distress:acknowledged` to the mobile client.
  3. Queries Redis GEO for volunteers within 500m.
  4. Emits `nearby:broadcast` to nearby volunteers and `room:responders`.
  5. Emits `incident:new` globally.

#### 2. Live Location Streaming
- **Event:** `location:update`
- **Publisher:** Mobile Client (1 ping/sec in SOS mode, 1 ping/10sec in standby)
- **Payload Schema:**
  ```json
  {
    "incidentId": "inc_999",
    "lat": 40.7129,
    "lng": -74.0061,
    "batteryLevel": 84
  }
  ```
- **Server Actions:**
  - Throttles PostgreSQL database write (max 1 write every 2 seconds).
  - Updates active incident Redis cache.
  - Broadcasts `location:update` to `room:inc_999` and `room:responders`.
  - Broadcasts `location:breadcrumb` for live map plotting.

#### 3. Proximity Broadcast (Sentinel Mesh)
- **Event:** `nearby:broadcast`
- **Receiver:** Active volunteers within 500m & Responder Console
- **Payload Schema:**
  ```json
  {
    "incidentId": "inc_999",
    "victimId": "u_123",
    "victimName": "Jane Doe",
    "victimPhone": "+1234567890",
    "coordinates": { "lat": 40.7128, "lng": -74.0060 },
    "distanceMeters": 250,
    "batteryLevel": 85,
    "triggerType": "AUDIO_SCREAM",
    "startedAt": "2026-06-13T10:00:00.000Z",
    "status": "ACTIVE"
  }
  ```

#### 4. Responder Status Transition
- **Event:** `responder:status_change`
- **Publisher:** Responder Dashboard
- **Payload Schema:**
  ```json
  {
    "incidentId": "inc_999",
    "responderId": "u_responder_1",
    "status": "DISPATCHED",
    "estimatedArrivalMins": 4
  }
  ```
- **Server Broadcasts:**
  - `events.responder.status_change` to `room:inc_999`
  - `incident:status_changed` and `responder:status_changed` to `room:responders`

#### 5. Dynamic System Configuration
- **Event:** `system:config_update`
- **Publisher:** Admin Dashboard
- **Server Broadcast:** `events.system.configuration_update`
- **Payload Schema:**
  ```json
  {
    "type": "ml_threshold_update",
    "newWeights": { "screamConfidence": 0.85, "snatchThreshold": 2.4 }
  }
  ```
