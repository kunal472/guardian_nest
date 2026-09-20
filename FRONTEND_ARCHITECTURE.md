# Project Guardian: Frontend & Client Architecture

This document provides a comprehensive specification of the Frontend applications in Project Guardian. It contains all component structures, real-time socket interfaces, client-side dynamic throttling rules, state management, native audio pipeline modules, and step-by-step instructions to recreate and run the frontend clients.

---

## 1. Overview of Frontend Architecture

Project Guardian consists of three specialized frontend interfaces:

1. **Mobile Edge Client (`/mobile`)**: React Native app built with Expo (SDK 57) and React 19, targeting Android, iOS, and Web. Handles zero-touch trigger processing, C++/JNI native audio buffering (`guardian-audio`), acoustic scream detection, hardware snatch accelerometry, live GPS location streaming with dynamic battery throttling, emergency SMS fallback, and emergency state transitions.
2. **Emergency Responder Dashboard (`/dashboards/responder_dashboard`)**: React 19 + Vite 8 SPA for dispatchers and field responders. Subscribes to real-time distress alerts via Socket.io, renders live Leaflet interactive maps with GPS breadcrumbs, and manages incident dispatch statuses.
3. **Admin Dashboard (`/dashboards/admin_dashboard`)**: React 19 + Vite 8 SPA for system administrators. Interfaces with the GraphQL API (`/graphql`) to run analytical queries on users, volunteers, and historical incidents, and broadcasts dynamic system config updates.

---

## 2. Mobile Edge Client (`/mobile`)

### A. Tech Stack & Dependencies
* **Framework**: React Native (`0.86.3`) with Expo (`SDK ~57.0.21`) & React (`19.2.3`)
* **Core Libraries**: `expo-audio`, `expo-location`, `expo-sensors`, `expo-battery`, `expo-status-bar`, `socket.io-client`, `lucide-react-native`, `react-native-svg`
* **Custom Native Turbo Module**: `guardian-audio` (located in `/mobile/modules/guardian-audio`) — C++/JNI audio coordinator with background recording capabilities, high-speed PCM ring buffering, and DBFS amplitude metering.
* **On-Device Edge ML**: Two-tier acoustic distress pipeline supporting `openWakeWord`, `whisper.cpp` (`ggml-tiny.en.bin`), and `YAMNet` (`yamnet.tflite`) for localized scream detection without cloud audio streaming.

### B. File Structure
```
mobile/
├── assets/
│   └── models/                      # Downloaded lightweight ML models (YAMNet, Whisper)
├── modules/
│   └── guardian-audio/              # Custom native C++/Android TurboModule for audio vault & metering
│       ├── android/                 # Native Kotlin/C++ JNI implementations
│       ├── index.ts                 # TypeScript coordinator & permission checks
│       └── package.json
├── src/
│   ├── components/                  # UI widgets (SOS button, decoy calculator, telemetry badges)
│   ├── services/                    # Decoupled singleton services
│   │   ├── audioRingBuffer.ts       # In-memory circular buffer for audio chunks
│   │   ├── authService.ts           # JWT authentication, session caching & user profile
│   │   ├── emergencySmsService.ts   # Smart SMS fallback generator for offline scenarios
│   │   ├── hardwareAudioVaultService.ts # Encrypted audio chunk storage & AES-256 vault
│   │   ├── hardwareBatteryService.ts    # Battery level & charging state listener
│   │   ├── hardwareLocationService.ts   # GPS tracking & dynamic throttling coordinator
│   │   ├── hardwareSnatchService.ts     # Accelerometer device snatch anomaly detection
│   │   ├── nativeAudioCoordinator.ts    # Bridge to guardian-audio native module
│   │   ├── nativeShutdownService.ts     # Native shutdown prevention / anti-tamper triggers
│   │   ├── openWakeWordService.ts       # On-device keyword spotting listener
│   │   ├── screamDetectionService.ts    # YAMNet acoustic scream & distress classifier
│   │   ├── speakerBiometricsService.ts  # Voice print comparison & verification
│   │   ├── twoTierDistressPipeline.ts   # Orchestrates noise floor -> keyword -> acoustic pipeline
│   │   └── webAudioMlEngine.ts          # Web Audio fallback for browser execution
│   └── utils/
├── App.tsx                          # Root application container & stealth decoy toggle
├── app.json                         # Expo configuration, plugins & Android permissions
├── package.json                     # Project scripts & dependencies
└── tsconfig.json
```

### C. Package Configuration (`package.json`)
```json
{
  "name": "guardian-mobile",
  "version": "1.0.0",
  "main": "index.ts",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "download:models": "curl -L -o ./assets/models/ggml-tiny.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin && curl -L -o ./assets/models/yamnet.tflite https://storage.googleapis.com/tfhub-modules/google/lite-model/yamnet/tflite/1.tflite",
    "build:android": "cd android && ./gradlew.bat assembleRelease",
    "build:android:debug": "cd android && gradlew.bat assembleDebug"
  },
  "dependencies": {
    "guardian-audio": "file:./modules/guardian-audio",
    "@expo/metro-runtime": "~57.0.15",
    "expo": "~57.0.21",
    "expo-audio": "^57.0.5",
    "expo-battery": "^57.0.3",
    "expo-location": "^57.0.17",
    "expo-sensors": "^57.0.3",
    "expo-status-bar": "^57.0.1",
    "lucide-react-native": "^1.32.0",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-native": "0.86.3",
    "react-native-svg": "15.15.4",
    "react-native-web": "^0.21.2",
    "socket.io-client": "^4.8.3"
  },
  "devDependencies": {
    "@babel/core": "^7.29.0",
    "@types/react": "^19.2.18",
    "typescript": "~6.0.3"
  },
  "private": true
}
```

### D. Live GPS Location Streaming & Dynamic Throttling
The mobile client streams coordinates to the backend Socket.IO gateway using dynamic throttling to balance battery conservation with tactical precision:
* **Active SOS State**: 1 ping / second (high frequency during ongoing distress).
* **Standby / Normal State**: 1 ping / 10 seconds (low battery overhead).

---

## 3. Emergency Responder Dashboard (`/dashboards/responder_dashboard`)

### A. Tech Stack & Dependencies
* **Framework**: React.js 19 (`^19.2.8`) + Vite 8 (`^8.2.1`)
* **Mapping Engine**: **Leaflet** (`leaflet` & `@types/leaflet`) for real-time tactical radar, incident markers, and breadcrumbs.
* **Icons**: `lucide-react`
* **Real-time Engine**: `socket.io-client` (`^4.8.3`)
* **Styling**: Vanilla CSS (`index.css` & `App.css`) with tactical dark mode themes

### B. Key Features & Components
* **Live Alert Banner**: Real-time ticker of incoming distress alerts (`nearby:broadcast`, `incident:new`).
* **Tactical Leaflet Map**: Interactive radar plotting live victim coordinates, volunteer sentinels, and moving breadcrumb routes.
* **Incident Detail Drawer**: Displays victim profile, battery telemetry, trigger type (`AUDIO_SCREAM`, `DEVICE_SNATCH`, `MANUAL_SOS`), and audio evidence player.
* **Status Dispatch Actions**: Quick controls emitting `responder:status_change` (`DISPATCHED`, `ARRIVED`, `RESOLVED`).

### C. Package Configuration (`package.json`)
```json
{
  "name": "responder_dashboard",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@types/leaflet": "^1.9.22",
    "leaflet": "^1.9.4",
    "lucide-react": "^1.32.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "socket.io-client": "^4.8.3"
  },
  "devDependencies": {
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4",
    "@vitejs/plugin-react": "^6.0.5",
    "typescript": "~7.0.2",
    "vite": "^8.2.1"
  }
}
```

---

## 4. Admin Intelligence Dashboard (`/dashboards/admin_dashboard`)

### A. Tech Stack & Dependencies
* **Framework**: React.js 19 (`^19.2.8`) + Vite 8 (`^8.2.1`)
* **API Client**: Apollo Client / Fetch for GraphQL endpoint (`/graphql`)
* **Real-time Engine**: `socket.io-client` for global system configuration broadcasts
* **Icons**: `lucide-react`

### B. Key Features & Components
* **KPI Intelligence Cards**: Active distress incidents, registered volunteers, total resolved cases, and average response times.
* **User & Volunteer Ledger**: Manage user roles (`USER`, `RESPONDER`, `ADMIN`) and sentinel statuses.
* **Incident History Table**: Deep-dive into historical incidents, evidence audio URLs, and timestamps.
* **ML Sensitivity Tuning**: Broadcast `system:config_update` events across the platform.

### C. Package Configuration (`package.json`)
```json
{
  "name": "admin_dashboard",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "lucide-react": "^1.32.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "socket.io-client": "^4.8.3"
  },
  "devDependencies": {
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4",
    "@vitejs/plugin-react": "^6.0.5",
    "typescript": "~7.0.2",
    "vite": "^8.2.1"
  }
}
```

---

## 5. Development Launch Commands

```bash
# 1. Launch Responder Dashboard
cd dashboards/responder_dashboard
bun install
bun dev

# 2. Launch Admin Dashboard
cd ../admin_dashboard
bun install
bun dev

# 3. Launch Mobile Client
cd ../../mobile
bun install
bun run start
```
