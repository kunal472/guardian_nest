# Project Guardian: Frontend & Client Architecture

This document provides a comprehensive specification of the Frontend applications in Project Guardian. It contains all component structures, real-time socket interfaces, client-side dynamic throttling rules, state management, and step-by-step instructions to recreate the frontend clients as they exist in this workspace.

---

## 1. Overview of Frontend Architecture

Project Guardian consists of three specialized frontend interfaces:
1. **Mobile Edge Client (`/mobile`)**: React Native app built with Expo, targeting iOS, Android, and Web PWA. Handles zero-touch trigger processing, live GPS location streaming with dynamic throttling, and emergency state transitions.
2. **Emergency Responder Dashboard (`/dashboards/responder_dashboard`)**: React + Vite SPA for dispatchers and field responders. Subscribes to real-time distress alerts via Socket.io, renders location breadcrumb logs, and manages incident statuses.
3. **Admin Dashboard (`/dashboards/admin_dashboard`)**: React + Vite SPA for system administrators. Interfaces with the GraphQL API to run analytical queries on users, volunteers, and historical incidents.

---

## 2. Mobile Edge Client (`/mobile`)

### A. Tech Stack & Dependencies
* **Framework**: React Native (Expo SDK)
* **Core Libraries**: `react`, `react-native`, `expo`, `expo-status-bar`, `socket.io-client`
* **Local ML & Biometrics**: AudioWorklet / Web Worker + TensorFlow.js / MLKit (for acoustic scream detection and device snatch accelerometry)

### B. File Structure
```
mobile/
├── App.tsx
├── app.json
├── package.json
├── index.ts
├── tsconfig.json
└── bun.lock
```

### C. Package Configuration (`package.json`)
```json
{
  "name": "mobile",
  "version": "1.0.0",
  "main": "index.ts",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-status-bar": "~2.0.0",
    "react": "18.3.1",
    "react-native": "0.76.7",
    "socket.io-client": "^4.8.3"
  },
  "devDependencies": {
    "@babel/core": "^7.25.2",
    "@types/react": "~18.3.12",
    "typescript": "^5.3.3"
  },
  "private": true
}
```

### D. Live GPS Location Streaming & Dynamic Throttling
The mobile client streams coordinates to the backend Socket.io server using dynamic throttling to optimize battery usage:
* **Active SOS State**: 1 ping / second (high frequency during ongoing distress).
* **Standby / Normal State**: 1 ping / 10 seconds (low battery overhead).

```typescript
// Mobile Location Streaming Logic Example
import io from 'socket.io-client';

const socket = io('http://<BACKEND_HOST>:3000', {
  auth: { token: userJwtToken }
});

let locationInterval: NodeJS.Timeout | null = null;

function startLocationStreaming(incidentId: string, isSosActive: boolean) {
  const throttleIntervalMs = isSosActive ? 1000 : 10000;

  if (locationInterval) clearInterval(locationInterval);

  locationInterval = setInterval(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      socket.emit('location:update', {
        incidentId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        batteryLevel: Math.round((pos as any).batteryLevel || 100)
      });
    });
  }, throttleIntervalMs);
}
```

---

## 3. Emergency Responder Dashboard (`/dashboards/responder_dashboard`)

### A. Tech Stack & Dependencies
* **Framework**: React.js 19 + Vite 6
* **Icons**: `lucide-react`
* **Real-time Engine**: `socket.io-client`
* **Styling**: Vanilla CSS (`index.css` & `App.css`) with sleek dark mode themes

### B. Key Components
* **`ResponderDashboard.tsx`**: Main emergency operating console.
  * **Alert Stream Banner**: Real-time ticker of incoming distress alerts (`nearby:broadcast`).
  * **Active Incident Details**: Displays victim details, trigger type, and status badges (`ACTIVE`, `DISPATCHED`, `ARRIVED`, `RESOLVED`).
  * **GPS Breadcrumb Trail (Throttled Streams)**: Visual log list plotting incoming coordinates as they arrive over the socket.
  * **Status Action Controls**: Buttons emitting status change updates (`responder:status_change`) to update dispatch states.

### C. Package Configuration (`package.json`)
```json
{
  "name": "responder_dashboard",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "lucide-react": "^0.475.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "socket.io-client": "^4.8.3"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "~5.7.2",
    "vite": "^6.1.0",
    "vitest": "^3.0.5"
  }
}
```

---

## 4. Admin Dashboard (`/dashboards/admin_dashboard`)

### A. Tech Stack & Dependencies
* **Framework**: React.js 19 + Vite 6
* **API Client**: Apollo Client / Fetch for GraphQL endpoint (`/graphql`)
* **Icons**: `lucide-react`

### B. Package Configuration (`package.json`)
```json
{
  "name": "admin_dashboard",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "lucide-react": "^0.475.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "~5.7.2",
    "vite": "^6.1.0"
  }
}
```

---

## 5. Step-by-Step Frontend Recreation Commands

To recreate all three frontend applications from scratch:

```bash
# 1. Recreate Mobile Client (Expo)
mkdir mobile && cd mobile
bun init -y
bun add react react-native expo expo-status-bar socket.io-client
bun add -d @babel/core @types/react typescript

# 2. Recreate Responder Dashboard (Vite + React)
cd ../dashboards
npm create vite@latest responder_dashboard -- --template react-ts
cd responder_dashboard
bun add lucide-react socket.io-client
bun add -d vitest

# 3. Recreate Admin Dashboard (Vite + React)
cd ..
npm create vite@latest admin_dashboard -- --template react-ts
cd admin_dashboard
bun add lucide-react
```
