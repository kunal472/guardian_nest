# Project Guardian: API & Event Bus Design

Since our architecture uses a hybrid approach, we must carefully design both the traditional API (for standard CRUD operations) and the Event Bus (for real-time emergencies).

---

## Part 1: REST vs. GraphQL for the Standard API

When building the standard synchronous API for Project Guardian, we must choose between REST and GraphQL. 

### REST (Representational State Transfer)
**Pros:**
- **Simplicity & Predictability**: Very easy to implement and debug. HTTP caching works perfectly out of the box, which saves battery and data on mobile devices.
- **Strict Contracts**: Endpoints do one thing, making it easier to lock down security (e.g., rate limiting the `/api/auth/login` endpoint is trivial).

**Cons:**
- **Over-fetching / Under-fetching**: Complex dashboards might require hitting multiple endpoints to gather all necessary data.

### GraphQL
**Pros:**
- **Client-Driven Queries**: The client asks for exactly what it needs and nothing more. This is incredibly powerful for complex interfaces like the Admin Dashboard.
- **Single Endpoint**: All data is fetched from a single `/graphql` endpoint, reducing the number of network round-trips.

**Cons:**
- **Complex Caching**: Because everything goes through one `POST` endpoint, traditional browser caching is much harder.
- **Performance Risks**: A malicious or poorly written query could accidentally ask for highly nested, expensive database joins and crash the server.

### Recommendation (The Dual-API Approach)
For an emergency app like Guardian, we will use a **Dual-API Approach** mounted on a single backend server:

1. **REST for Edge Clients (Mobile/Web)**: The absolute highest priority for end-users is reliability, simplicity, and low battery consumption. Exposing traditional routes (e.g., `/api/...`) ensures lightning-fast, cacheable endpoints that are highly predictable during an emergency.
2. **GraphQL for Admin Dashboard**: The Admin Dashboard requires highly analytical, complex reports (e.g., joining users with their incident history and assigned responders). Exposing a single `/graphql` endpoint allows admins to fetch complex nested data in a single request without causing over-fetching.

**How it works ("One Backend, Two Doors")**:
Both the REST `/api` routes and the `/graphql` endpoint live on the exact same backend server. They both talk to the exact same underlying database services and core logic. The only difference is the "door" the client uses to request the data. This provides the best of both worlds without forcing us to write duplicate database code.

---

## Part 2: Detailed API Contract & Event Topics

Below is the technical specification for the hybrid design, providing concrete payloads and schemas to guide backend implementation.

### A. Synchronous REST API (Edge Clients)

#### Authentication & User Management

**1. Register User**
- **Endpoint**: `POST /api/auth/register`
- **Request Body**:
  ```json
  {
    "phone": "+1234567890",
    "password": "hashed_password",
    "name": "Jane Doe"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "token": "jwt_string_here",
    "user": { "id": "u_123", "name": "Jane Doe" }
  }
  ```

**2. Update Profile / Settings**
- **Endpoint**: `PUT /api/users/me`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "emergencyContacts": ["+1987654321"],
    "mlSensitivity": "high"
  }
  ```
- **Response** (`200 OK`): `{ "success": true }`

#### Community & Volunteer Network

**1. Toggle Volunteer Mode**
- **Endpoint**: `POST /api/volunteers/opt-in`
- **Headers**: `Authorization: Bearer <token>`
- **Response** (`200 OK`): `{ "status": "active_sentinel" }`

---

### B. GraphQL API (Admin Dashboard)

Instead of multiple REST endpoints, the Admin Dashboard uses a single `/graphql` endpoint to fetch highly nested data in one request.

**Example Schema Definition**:
```graphql
type User {
  id: ID!
  name: String!
  isVolunteer: Boolean!
  incidents: [Incident!]!
}

type Incident {
  id: ID!
  timestamp: String!
  triggerType: String!
  resolvedBy: String
}

type Query {
  getAllUsers(limit: Int): [User!]!
  getIncidentReport(timeframe: String!): [Incident!]!
}
```

---

### C. Asynchronous Event Bus (Emergency Operations)

Unlike REST/GraphQL, these are real-time topics/streams handled via WebSockets or message brokers.

**1. Distress Triggered**
- **Topic:** `events.distress.triggered`
- **Publisher:** User Edge Client (via SOS button or local ML trigger).
- **Subscribers:** Emergency Responder Dashboard, Admin DB Logger.
- **Payload Schema:**
  ```json
  {
    "userId": "u_123",
    "timestamp": "2026-06-13T10:00:00Z",
    "triggerType": "audio_scream",
    "coordinates": { "lat": 40.7128, "lng": -74.0060 }
  }
  ```

**2. Live Location Update**
- **Topic:** `events.distress.location_update`
- **Publisher:** User Edge Client (fires every 3-5 seconds during active distress).
- **Subscribers:** Emergency Responder Dashboard, Nearby Volunteers.
- **Payload Schema:**
  ```json
  {
    "incidentId": "inc_999",
    "coordinates": { "lat": 40.7129, "lng": -74.0061 },
    "batteryLevel": 45,
    "speed": 1.2
  }
  ```

**3. Nearby Broadcast (Community Mesh)**
- **Topic:** `events.distress.broadcast_nearby`
- **Publisher:** Core Backend (calculates geofence and routes the alert).
- **Subscribers:** Users with "Volunteer Mode" active within 500m.
- **Payload Schema:**
  ```json
  {
    "incidentId": "inc_999",
    "distanceMeters": 320,
    "coordinates": { "lat": 40.7128, "lng": -74.0060 }
  }
  ```

**4. Responder Status Change**
- **Topic:** `events.responder.status_change`
- **Publisher:** Emergency Responder Dashboard.
- **Subscribers:** User Edge Client (victim).
- **Payload Schema:**
  ```json
  {
    "incidentId": "inc_999",
    "status": "unit_dispatched",
    "estimatedArrivalMins": 4
  }
  ```

**5. System Configuration Update**
- **Topic:** `events.system.configuration_update`
- **Publisher:** Admin Dashboard.
- **Subscribers:** All Edge Clients.
- **Payload Schema:**
  ```json
  {
    "type": "ml_threshold_update",
    "newWeights": { "scream_confidence": 0.85 }
  }
  ```
