# Project Guardian: Technical Architecture

This document breaks down the Event-Driven Architecture (EDA) into concrete infrastructure, backend languages, and protocol choices so developers can build the platform accurately.

---

## 1. Core Infrastructure & Stack Choices

To guarantee extreme resilience and low latency, we are utilizing the following technology stack:

- **Backend Framework**: Node.js with Express (REST) and Apollo Server (GraphQL). Node.js is chosen for its superior handling of asynchronous I/O and persistent WebSocket connections.
- **Real-time Gateway**: Socket.io. It provides automatic fallback to long-polling if WebSockets fail, which is critical for unstable mobile connections.
- **Message Broker / Event Bus**: Redis (Pub/Sub & Redis Streams). Chosen over Kafka for its simplicity and blazing-fast in-memory geospatial (`GEO`) querying capabilities.
- **Primary Database**: PostgreSQL. Handles all structured relational data (Users, incident logs).
- **Object Storage**: AWS S3. For storing encrypted audio evidence and media.
- **Hosting / Deployment**: Dockerized containers deployed on AWS ECS or Google Cloud Run to allow rapid horizontal scaling during mass emergencies.

---

## 2. Hybrid Approach: Event Bus vs. REST API

We do not use WebSockets for everything. Developers must adhere to this split:

- **REST API (Express.js)**: Used exclusively for stateless, synchronous operations where the client needs an immediate database response. 
  - *Examples*: `/api/auth/login`, `/api/users/me`.
  - *Tech*: Handled via standard HTTPS GET/POST requests.
- **GraphQL (Apollo Server)**: Used exclusively by the Admin Dashboard SPA to query complex, nested PostgreSQL data without over-fetching.
- **Event Bus (Redis + Socket.io)**: Used for high-velocity, mission-critical emergency data.
  - *Examples*: SOS triggers, live location streaming.
  - *Tech*: Handled over long-lived WSS (WebSocket Secure) connections.

---

## 3. The Event-Driven Data Flow (By Client)

### A. User Interface (Mobile & Web Edge Client)
Built using **React Native (Expo)** and **React.js**.

- **Edge Intelligence**: The app uses TensorFlow.js (or native MLKit) to process microphone buffers locally. Audio NEVER leaves the device for ML analysis.
- **Publishing Events**: 
  - If a scream is detected, the app emits a `distress:triggered` socket event to the Node.js server. 
  - It then runs a `setInterval` to emit `location:update` events every 3 seconds.
- **Subscribing to Events**: 
  - If in Volunteer Mode, the app listens to the Socket.io namespace for `nearby:broadcast` events to render victims on their Mapbox UI.

### B. Emergency Responder Dashboard (Web Portal)
Built using **React.js (Vite)**.

- **Subscribing to Events**:
  - Maintains a persistent WebSocket connection. It joins a Socket.io "room" based on its geographic jurisdiction (e.g., `room:jurisdiction_nyc`).
  - Receives `distress:triggered` events and plots them instantly on the Leaflet/Mapbox canvas.
- **Publishing Events**:
  - Dispatchers click "Dispatch Unit," which emits a `responder:status_change` event. The Node.js server routes this through Redis back to the specific victim's mobile device.

### C. Admin Dashboard (Web Interface)
Built using **React.js**.

- **Asynchronous DB Logging**:
  - A dedicated background Node.js worker (the "Admin Logger Service") subscribes to ALL Redis event streams. 
  - Instead of blocking the live Socket.io gateway, this background worker safely batches location updates and writes them into the PostgreSQL `incident_location_logs` table every 10 seconds.
- **Data Consumption**:
  - Admins view these logs not through sockets, but by executing GraphQL queries against the PostgreSQL database.
- **Publishing Configuration**:
  - Admins can emit `system:config_update` events (like tuning the ML sensitivity weight) which the Node.js server broadcasts globally to all connected Edge Clients.
