# Project Guardian: Technical Architecture

This document specifies the Event-Driven Architecture (EDA), infrastructure layers, backend frameworks, protocol choices, and client subsystems so developers can understand and maintain the platform accurately.

---

## 1. Core Infrastructure & Stack Choices

To guarantee extreme resilience, low latency, and zero-touch responsiveness during emergencies, Project Guardian utilizes the following technology stack:

- **Backend Framework**: **NestJS (v11)** using the high-performance **Fastify Adapter** (`@nestjs/platform-fastify`). NestJS provides modular dependency injection, structured controllers, and robust lifecycle hooks, while Fastify delivers ultra-fast request processing.
- **Dual API Architecture**:
  - **REST API (Fastify Controllers)**: Stateless, synchronous endpoints for auth, profile management, volunteer controls, incident lifecycle management, and evidence uploads.
  - **GraphQL Server (Apollo Server on Fastify)**: Single `/graphql` endpoint serving complex nested analytical queries and mutations for the Admin Dashboard.
- **Real-time Event Gateway**: **Socket.IO** (`@nestjs/platform-socket.io` / `socket.io-client`). Provides bidirectional event streams with automatic reconnection and fallback for unstable mobile networks.
- **Message Broker & Geospatial Cache**: **Redis 7** (using `ioredis`). Handles in-memory session mapping, active incident states, and sub-millisecond geospatial radius queries (`GEOADD` and `GEOSEARCH`).
- **Primary Database**: **PostgreSQL 15** with **Prisma ORM 7** (`@prisma/client` & `@prisma/adapter-pg`). Houses relational data including users, emergency contacts, incidents, and throttled location logs.
- **Evidence Storage & Audio Vault**: Local file streams (`/uploads/evidence`) and encrypted AWS S3 object storage with pre-signed URL generation.
- **Containerization**: Docker & Docker Compose (`docker-compose.yml`) orchestrating PostgreSQL and Redis instances.

---

## 2. Hybrid Approach: Event Bus vs. Synchronous APIs

We maintain a strict separation of concerns across communication protocols:

```
                               ┌──────────────────────────────────────────────┐
                               │                Clients Layer                 │
                               │  - Mobile Edge (React Native / Expo SDK 57)  │
                               │  - Responder Dashboard (React 19 + Leaflet)  │
                               │  - Admin Dashboard (React 19 + GraphQL)      │
                               └──────┬──────────────────────┬──────────────┬─┘
                                      │                      │              │
                                 REST │             Socket.io│              │ GraphQL
                                      ▼                      ▼              ▼
                               ┌──────────────────────────────────────────────┐
                               │       NestJS Backend (Fastify Adapter)       │
                               │ ├── REST Controllers (/api/auth, incidents)  │
                               │ ├── Apollo GraphQL Module (/graphql)         │
                               │ └── SosGateway (distress, location updates)  │
                               └──────────────┬───────────────────────────────┘
                                              │
                             ┌────────────────┴────────────────┐
                             ▼                                 ▼
              ┌─────────────────────────────┐   ┌─────────────────────────────┐
              │ PostgreSQL Database (Prisma)│   │ Redis (Geo Index & Session) │
              └─────────────────────────────┘   └─────────────────────────────┘
```

- **REST API (`/api/*`)**: Used for synchronous operations where the client requires deterministic database records (user registration, login, profile updates, volunteer toggle, and multipart/base64 encrypted audio evidence uploads).
- **GraphQL (`/graphql`)**: Used exclusively by the Admin Intelligence Dashboard to query multi-relational graphs (incidents joined with users, responders, and location breadcrumbs) in a single round-trip.
- **Event Bus (`SosGateway` on Socket.io)**: Dedicated to mission-critical, high-velocity emergency telemetry (distress triggers, dynamic live GPS location updates, sentinel proximity broadcasts, and responder status transitions).

---

## 3. The Event-Driven Data Flow (By Client)

### A. Mobile Edge Client (`/mobile`)
Built with **React Native (v0.86.3)** and **Expo (SDK ~57)** with custom native modules:

- **Local Edge Intelligence**:
  - **Two-Tier Distress Pipeline**: Combines continuous lightweight DBFS noise floor metering, keyword spotting (`openWakeWord`), acoustic classification (`YAMNet` / Whisper.cpp), and speaker biometrics.
  - **Acoustic Vault & Native Module (`guardian-audio`)**: C++/JNI native audio coordinator buffering raw PCM audio into an encrypted hardware vault. Audio analysis happens on-device; raw audio never leaves unless an active SOS is triggered.
  - **Hardware Snatch Detection**: Uses accelerometer sensors (`expo-sensors` / hardware snatch service) to detect abrupt physical removal signatures.
- **Publishing Events**:
  - Emits `distress:triggered` with GPS coordinates, trigger type, and battery telemetry when SOS conditions are met.
  - Emits `location:update` continuously, applying dynamic battery throttling (1 ping/sec in SOS mode, 1 ping/10sec in standby).
- **Subscribing to Events**:
  - Subscribes to `nearby:broadcast` to alert the user if they are an active volunteer sentinel within 500m of an emergency.
  - Subscribes to `events.responder.status_change` to receive live dispatch notifications and estimated arrival times.

### B. Emergency Responder Tactical Dashboard (`/dashboards/responder_dashboard`)
Built with **React 19**, **Vite 8**, and **Leaflet Maps**:

- **Real-Time Map & Breadcrumbs**:
  - Maintains persistent WebSocket connection and joins `room:responders`.
  - Automatically receives `nearby:broadcast` and `incident:new` events, rendering interactive radar pins and live GPS breadcrumb trails.
- **Status Dispatch Actions**:
  - Responders update incident progress by emitting `responder:status_change` (`DISPATCHED`, `ARRIVED`, `RESOLVED`), which updates the backend database and notifies the victim in real-time.
- **Audio Evidence Review**:
  - Fetches and plays back uploaded audio evidence and encrypted vaults associated with incidents.

### C. Admin Intelligence Dashboard (`/dashboards/admin_dashboard`)
Built with **React 19**, **Vite 8**, and **Apollo GraphQL**:

- **Analytical Queries**:
  - Queries `/graphql` to fetch aggregate incident reports, volunteer density metrics, and user management tables without over-fetching.
- **System Tuning**:
  - Emits `system:config_update` over WebSockets to dynamically adjust ML detection sensitivity thresholds across active mobile clients.
