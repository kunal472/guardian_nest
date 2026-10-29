# Project Guardian: Emergency Response & Sentinel Mesh Platform

A dual-API & real-time event bus emergency response system built with **NestJS 11 (Fastify Adapter)**, **PostgreSQL 15 (Prisma ORM 7)**, **Redis 7 (Geospatial Indexing & In-Memory Caching)**, **React 19 (Vite 8)** web dashboards with **Leaflet Maps**, and a **React Native (Expo SDK 57)** mobile edge client with custom native C++/JNI audio modules.

---

## 🏗️ Architecture Overview

```
                          ┌──────────────────────────────────────────────┐
                          │               Clients Layer                  │
                          └──────┬──────────────────────┬──────────────┬─┘
                                 │                      │              │
                   React Native (Expo SDK 57)    React 19 Responder React 19 Admin
                                 │                      │              │
                   REST & Sockets│         Socket.io    │              │ GraphQL
                                 ▼                      ▼              ▼
                          ┌──────────────────────────────────────────────┐
                          │       NestJS Backend (Fastify Adapter)       │
                          │ ├── Fastify REST Gateway (/api/auth, etc.)   │
                          │ ├── Apollo GraphQL Server (/graphql)         │
                          │ └── Socket.IO Gateway (distress:triggered)   │
                          └──────────────┬───────────────────────────────┘
                                         │
                        ┌────────────────┴────────────────┐
                        ▼                                 ▼
         ┌─────────────────────────────┐   ┌─────────────────────────────┐
         │ PostgreSQL Database (Prisma)│   │ Redis (Geo Index & Pub/Sub) │
         └─────────────────────────────┘   └─────────────────────────────┘
```

---

## 📁 Repository Structure

```
guardian_nest/
├── backend/                              # NestJS 11 Backend (Fastify Adapter)
│   ├── src/
│   │   ├── auth/                        # JWT Auth (Register, Login, Passport Strategy)
│   │   ├── users/                       # User Profiles & Emergency Contacts
│   │   ├── volunteers/                  # Sentinel Mesh & Redis GEO Opt-In
│   │   ├── incidents/                   # Incidents, Location Logs & Audio Evidence Uploads
│   │   ├── graphql/                     # Apollo GraphQL Resolvers, Models & Schema
│   │   ├── gateway/                     # Socket.IO Real-Time Gateway & Proximity Broadcast
│   │   ├── notifications/               # Automated Emergency SMS & Alert Dispatcher
│   │   ├── prisma/                      # Prisma ORM Database Service
│   │   ├── redis/                       # Redis GEO & Session Cache Service
│   │   ├── app.module.ts                # Root Application Module
│   │   └── main.ts                      # Fastify Adapter Entrypoint
│   ├── prisma/
│   │   └── schema.prisma                # PostgreSQL Schema & Enums
│   ├── uploads/evidence/                # Stored Audio Vault Payloads
│   ├── .env                             # Environment Variables
│   └── package.json
│
├── dashboards/
│   ├── responder_dashboard/             # Tactical Emergency Dispatch Console (React 19 + Vite 8)
│   │   ├── src/
│   │   │   ├── components/              # Live Alert Banner, Leaflet Tactical Radar, Breadcrumbs
│   │   │   ├── services/                # REST & Socket.io Event Bus Client
│   │   │   └── App.tsx
│   │   └── package.json
│   │
│   └── admin_dashboard/                 # Executive Admin & Intelligence Console (React 19 + Vite 8)
│       ├── src/
│       │   ├── components/              # Analytics KPI Cards, User Directory, Incident Ledger
│       │   ├── services/                # GraphQL Apollo Client
│       │   └── App.tsx
│       └── package.json
│
├── mobile/                              # Mobile Edge Client (React Native / Expo SDK 57)
│   ├── modules/guardian-audio/          # Custom C++/JNI Native Audio Vault & Metering TurboModule
│   ├── src/
│   │   ├── services/                    # Two-Tier ML Distress Pipeline, Snatch, Battery & Location
│   │   ├── components/                  # Decoy Calculator, SOS Cockpit & Live Telemetry
│   │   └── utils/
│   ├── App.tsx                          # Root App Component & Stealth Mode Switcher
│   ├── app.json
│   └── package.json
│
├── docker-compose.yml                   # PostgreSQL 15 & Redis 7 Container Orchestration
├── architecture.md                      # Technical Architecture Specification
├── BACKEND_ARCHITECTURE.md              # Backend Architecture & Controller/Socket Contracts
├── FRONTEND_ARCHITECTURE.md             # Frontend, Mobile & Dashboard Specifications
├── api_design.md                        # API & WebSocket Event Contracts
├── database_schema.md                   # Database Models & Redis Key Schemas
├── DATABASE_AND_INFRASTRUCTURE.md       # Database, Redis & Deployment Documentation
└── features.md                          # Implemented Features & Technical Roadmap
```

---

## 🚀 Quick Start Guide (Using Bun)

### 1. Start Infrastructure (PostgreSQL + Redis)

```bash
docker compose up -d
```

### 2. Setup & Run NestJS Backend (Fastify)

```bash
cd backend
bun install
bunx prisma generate
bunx prisma db push
bun run dev
```
- **REST API**: `http://localhost:3000/api`
- **GraphQL Playground**: `http://localhost:3000/graphql`
- **WebSocket Gateway**: `ws://localhost:3000`

### 3. Launch Emergency Responder Dashboard

```bash
cd dashboards/responder_dashboard
bun install
bun run dev
```
- Opens at: `http://localhost:5173`

### 4. Launch Admin Intelligence Dashboard

```bash
cd dashboards/admin_dashboard
bun install
bun run dev
```
- Opens at: `http://localhost:5174`

### 5. Launch Mobile Edge Client (React Native Expo)

```bash
cd mobile
bun install
bun run start
```
- Press `a` to launch on Android Device / Emulator, `w` for Web fallback, or scan the QR code via Expo Go / Custom Dev Client.
- Connect to your local dev machine via the in-app **Server Config Modal** (`10.0.2.2:4000` for Android emulator, or your Wi-Fi LAN IP for physical phones).

### 6. Run Automated Test Suites

```bash
cd mobile
bun run test   # or: npx jest --maxWorkers=2
```
- Executes **15 test suites** and **97 automated unit & integration tests** across services, components, biometrics, audio, and network fallbacks.

---

## ⚡ Key Technical Features

1. **NestJS Fastify Adapter**: Ultra-high throughput REST API (`/api/auth`, `/api/users`, `/api/volunteers`, `/api/incidents`) with multipart audio upload handling.
2. **Dual-API Design**: Clean REST API for Edge mobile devices + GraphQL endpoint (`/graphql`) for administrative reporting.
3. **Native Android Background Acoustic Sentinel**: Android Foreground Service with a `PARTIAL_WAKE_LOCK` (`GuardianAudioRecordService.kt`) maintaining a 16kHz PCM audio thread (`AudioHardwareCoordinator.kt`) even when the screen is locked, preventing OS suspension of JavaScript timers.
4. **Autonomous Emergency HTTP Beacon**: On scream detection while in the background, native Kotlin directly dispatches an asynchronous HTTP POST beacon to `/api/incidents`, triggers native haptics (`Vibrator`), raises a priority heads-up alert, and brings `MainActivity` to the foreground.
5. **Real-Time Control Plane <-> Native Sentinel Bridge**: Dynamic synchronization between React Native and Kotlin for sensitivity presets (`LOUD_ONLY`, `MEDIUM`, `SENSITIVE`), numeric ML weights (`0.70` - `0.90`), and backend server URLs in real-time (<1ms).
6. **Two-Tier Acoustic ML Pipeline**: Energy-efficient noise floor calibration, keyword spotting (`openWakeWord`), deep acoustic classification (`YAMNet` / Whisper.cpp), and 3-step live speaker biometrics.
7. **Citizen UI & Scrollable Viewports**: Polished non-developer interface (`ShieldTab`, `SafeCircleTab`, `DiagnosticsTab`, `ServerConfigModal`) with `<ScrollView>` integration to prevent UI clipping on small devices.
8. **Dynamic LAN / Wi-Fi Server IP Config**: In-app modal with quick presets (`10.0.2.2:4000`, `192.168.1.X:4000`, `localhost:4000`) for seamless cross-device mobile testing without rebuilding APKs.
9. **Hardware Snatch & Battery Telemetry**: Real-time accelerometer anomaly detection (`hardwareSnatchService`) and pre-shutdown emergency dispatch.
10. **Dynamic Location Throttling**:
    - **Active SOS**: 1 ping / second over Socket.io.
    - **Database Insertion Throttle**: 1 write every 2 seconds to PostgreSQL per incident to protect database performance.
    - **Standby Mode**: 1 ping / 10 seconds.
11. **Redis Geospatial Indexing**: Uses `GEOADD` and `GEOSEARCH` on `volunteers:active_locations` to alert community sentinels within 500m in `< 1ms`.
12. **Realistic Decoy Calculator UI**: Stealth Mode disguises the app as a standard system calculator with decimal arithmetic operations (`+`, `-`, `×`, `÷`, `%`, `±`) and duress PIN switching.
13. **Automated Dead Man's Switch**: Configurable countdown timer with automatic distress escalation upon timeout.
14. **Emergency Contact Location Alerts & SMS Fallback**: Dispatches incident location to emergency contacts with client-side SMS intent fallback for offline environments.
