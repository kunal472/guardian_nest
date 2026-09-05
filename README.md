# Project Guardian: Emergency Response & Sentinel Mesh Platform

A dual-API & real-time event bus emergency response system built with **NestJS (Fastify Adapter)**, **PostgreSQL (Prisma)**, **Redis (Geospatial Indexing & Caching)**, **React.js (Vite)** web dashboards, and a **React Native (Expo)** mobile edge client.

---

## 🏗️ Architecture Overview

```
                          ┌──────────────────────────────────────────────┐
                          │               Clients Layer                  │
                          └──────┬──────────────────────┬──────────────┬─┘
                                 │                      │              │
                    React Native (Expo Mobile)   React Responder  React Admin
                                 │                      │              │
                   REST & Sockets│         Socket.io    │              │ GraphQL
                                 ▼                      ▼              ▼
                          ┌──────────────────────────────────────────────┐
                          │    NestJS Backend (Fastify Adapter)          │
                          │ ├── Fastify REST Gateway (/api/auth, users)  │
                          │ ├── Apollo / Mercurius GraphQL (/graphql)    │
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
├── backend/                              # NestJS Backend (Fastify Adapter)
│   ├── src/
│   │   ├── auth/                        # JWT Auth (Register, Login, Strategy)
│   │   ├── users/                       # User Profiles & Emergency Contacts
│   │   ├── volunteers/                  # Sentinel Mesh & Redis GEO Opt-In
│   │   ├── incidents/                   # Incidents & Throttled DB Location Logger
│   │   ├── graphql/                     # Apollo GraphQL Resolvers & Schema
│   │   ├── gateway/                     # Socket.io Real-Time Gateway & Proximity Broadcast
│   │   ├── prisma/                      # Prisma ORM Database Service
│   │   ├── redis/                       # Redis GEO & Session Cache Service
│   │   ├── app.module.ts                # Root Application Module
│   │   └── main.ts                      # Fastify Adapter Entrypoint
│   ├── prisma/
│   │   └── schema.prisma                # PostgreSQL Schema & Enums
│   ├── db/
│   │   └── init.sql                     # PostgreSQL Bootstrap Script
│   ├── .env                             # Environment Variables
│   └── package.json
│
├── dashboards/
│   ├── responder_dashboard/             # Tactical Emergency Dispatch Console (React + Vite)
│   │   ├── src/
│   │   │   ├── components/              # Live Alert Banner, Radar Canvas, Breadcrumbs
│   │   │   ├── services/                # REST & Socket.io Event Bus Client
│   │   │   └── App.tsx
│   │   └── package.json
│   │
│   └── admin_dashboard/                 # Executive Admin & Intelligence Console (React + Vite)
│       ├── src/
│       │   ├── components/              # Analytics KPI Cards, User Directory, Incident Ledger
│       │   ├── services/                # GraphQL Apollo Client
│       │   └── App.tsx
│       └── package.json
│
├── mobile/                              # Mobile Edge Client (React Native / Expo)
│   ├── App.tsx                          # SOS Button, Dynamic GPS Throttling, Decoy Calculator
│   ├── app.json
│   └── package.json
│
├── docker-compose.yml                   # PostgreSQL 15 & Redis 7 Orchestration
└── README.md
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
- Press `w` to run on Web or scan the QR code using Expo Go on iOS/Android.

---

## ⚡ Key Technical Features

1. **NestJS Fastify Adapter**: High-throughput asynchronous REST routes (`/api/auth`, `/api/users`, `/api/volunteers`, `/api/incidents`).
2. **Dual-API Design**: Clean REST API for Edge mobile devices + GraphQL endpoint (`/graphql`) for analytical queries.
3. **Dynamic Location Throttling**:
   - **Active SOS**: 1 ping / second over Socket.io.
   - **Database Insertion Throttle**: 1 write every 2 seconds to PostgreSQL per incident to prevent connection exhaustion.
   - **Standby Mode**: 1 ping / 10 seconds.
4. **Redis Geospatial Indexing**: Uses `GEOADD` and `GEOSEARCH` on `volunteers:active_locations` to alert community sentinels within 500m in `< 1ms`.
5. **Decoy Calculator UI**: Stealth Mode disguises the app as a standard calculator until the user enters PIN `9999` or `1234`.
