# Project Guardian: Frontend & Client Architecture

This document provides a comprehensive specification of the Frontend applications in Project Guardian. It contains all component structures, real-time socket interfaces, client-side dynamic throttling rules, state management, native audio pipeline modules, and step-by-step instructions to recreate and run the frontend clients.

---

## 1. Overview of Frontend Architecture

Project Guardian consists of three specialized frontend interfaces:

1. **Mobile Edge Client (`/mobile`)**: React Native app built with Expo (SDK 57) and React 19, targeting Android, iOS, and Web. Incorporates a dedicated Citizen-focused mobile UI (`ShieldTab`, `SafeCircleTab`, `DiagnosticsTab`), a native Android Kotlin foreground service sentinel (`guardian-audio`) with `PARTIAL_WAKE_LOCK` for non-stop background acoustic monitoring, autonomous native HTTP beaconing, dynamic Wi-Fi/LAN IP configuration, C++/JNI native audio buffering, acoustic scream detection, hardware snatch accelerometry, live GPS location streaming with dynamic battery throttling, emergency SMS fallback, and stealth decoy calculator transitions.
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
│   └── guardian-audio/              # Custom native Android TurboModule for background audio & metering
│       ├── android/src/main/java/expo/modules/guardianaudio/
│       │   ├── AudioHardwareCoordinator.kt   # 16kHz PCM AudioRecord worker loop & native scream detector
│       │   ├── GuardianAudioRecordService.kt # Android Foreground Service with PARTIAL_WAKE_LOCK & HTTP beacon
│       │   └── GuardianAudioModule.kt        # Expo Module bridge & event dispatcher
│       ├── index.ts                 # TypeScript coordinator & permission checks
│       └── package.json
├── src/
│   ├── components/                  # User-Facing Citizen UI Components
│   │   ├── CitizenAuth.tsx          # Login & registration modal with demo shortcuts
│   │   ├── ShieldTab.tsx            # Main distress dashboard (Scrollable SOS cockpit & safe-words)
│   │   ├── SafeCircleTab.tsx        # Emergency contacts & proximity sentinel mesh controls
│   │   ├── DiagnosticsTab.tsx       # Live hardware telemetry, audio metering & biometric calibration
│   │   └── ServerConfigModal.tsx    # Dynamic LAN/Wi-Fi backend IP configuration modal
│   ├── services/                    # Decoupled singleton services
│   │   ├── audioRingBuffer.ts       # In-memory circular buffer for audio chunks
│   │   ├── authService.ts           # JWT authentication, session caching, user profile & backend URL storage
│   │   ├── emergencySmsService.ts   # Smart SMS fallback generator for offline scenarios
│   │   ├── hardwareAudioVaultService.ts # Encrypted audio chunk storage & AES-256 vault
│   │   ├── hardwareBatteryService.ts    # Battery level & charging state listener
│   │   ├── hardwareLocationService.ts   # GPS tracking & dynamic throttling coordinator
│   │   ├── hardwareSnatchService.ts     # Accelerometer device snatch anomaly detection
│   │   ├── nativeAudioCoordinator.ts    # Bridge to guardian-audio native module (config & sensitivity sync)
│   │   ├── nativeShutdownService.ts     # Native shutdown prevention / anti-tamper triggers
│   │   ├── openWakeWordService.ts       # On-device keyword spotting listener
│   │   ├── screamDetectionService.ts    # YAMNet acoustic scream & distress classifier
│   │   ├── speakerBiometricsService.ts  # Voice print comparison & verification
│   │   ├── twoTierDistressPipeline.ts   # Event-driven Two-Tier acoustic distress pipeline
│   │   └── webAudioMlEngine.ts          # Web Audio fallback for browser execution
│   └── utils/                       # Logging & helper utilities
├── __tests__/                       # Comprehensive Jest Test Suites (15 suites / 97 tests)
│   ├── components/                  # CitizenAuth, ShieldTab, SafeCircleTab, DiagnosticsTab, ServerConfigModal
│   ├── integration/                 # Socket.IO & REST API integration tests
│   └── unit/                        # Services, RingBuffer, Location, Biometrics, Battery, Snatch, Pipeline
├── App.tsx                          # Root application container & realistic stealth calculator decoy
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

### E. Native Android Kotlin Background Sentinel (`guardian-audio`)
When the app is minimized, sent to the background, or when the screen is locked, mobile OS kernels (specifically Android with Hermes) suspend JavaScript `setInterval` timers. To ensure that distress detection never freezes or seizes, acoustic analysis is executed directly inside native Kotlin:
* **Continuous 16kHz PCM Audio Stream**: `AudioHardwareCoordinator.kt` runs an asynchronous coroutine worker polling `AudioRecord` at 16,000Hz (100ms / 1,600-sample chunks).
* **Android Foreground Service (`GuardianAudioRecordService.kt`)**: Runs with a `PARTIAL_WAKE_LOCK` and persistent notification, ensuring the CPU and audio hardware never sleep.
* **Autonomous Native Alarm**: When a sustained acoustic scream is detected in the background:
  1. Activates native device vibration patterns via Android `Vibrator`.
  2. Upgrades notification into a high-priority heads-up emergency alert banner.
  3. Dispatches an autonomous native HTTP POST beacon directly to `${targetBackendUrl}/api/incidents` using `HttpURLConnection` (bypassing JavaScript completely).
  4. Brings `MainActivity` to the foreground with `FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_REORDER_TO_FRONT`.
  5. Emits `onNativeDistressTriggered` to React Native for full UI escalation.

### F. Control Plane (React Native) <-> Execution Plane (Kotlin) Synchronization
The architecture maintains a strict separation:
* **React Native (Control Plane)**: The single source of truth for user settings, backend IPs, and Admin Panel WebSocket configuration broadcasts.
* **Kotlin (Execution Plane)**: Maintains reactive companion variables updated in under 1ms without service restarts:
  * **Scream Sensitivity**: Updates via `setScreamSensitivity()`. Kotlin dynamically evaluates both label presets (`LOUD_ONLY`, `MEDIUM`, `SENSITIVE`) and raw numeric confidence floats (`0.70` - `0.90`) on every 100ms audio frame.
  * **Admin Panel ML Weights**: Real-time broadcasts (`events.system.configuration_update`) received over Socket.IO immediately update native thresholds.
  * **Backend Server IP & Auth Token**: Synced via `setBackendConfig(url, token)`. If the user or developer updates the Wi-Fi IP in `ServerConfigModal.tsx`, the native HTTP beacon immediately targets the new address.
  * **AppState Lifecycle Hooks**: Re-syncs the active backend configuration on every foreground/background transition.

### G. Responsive Citizen UI & Scrollable Viewports
The mobile client is optimized for citizens and non-developers:
* **Zero Clipping with ScrollView**: `ShieldTab.tsx` and `ServerConfigModal.tsx` are wrapped in `<ScrollView>` containers with `keyboardShouldPersistTaps="handled"` and `showsVerticalScrollIndicator={false}`, ensuring full accessibility on compact mobile viewports and when soft keyboards open.
* **Tabs Breakdown**:
  * **ShieldTab**: Emergency SOS button, stealth mode toggle, safe-word guidance, status cards, and sensitivity selectors.
  * **SafeCircleTab**: Emergency contacts manager and Sentinel Mesh volunteer toggle.
  * **DiagnosticsTab**: Real-time hardware sensor status (Mic, GPS, Battery, Snatch) and interactive 3-step voice biometric calibration.
  * **ServerConfigModal**: Quick network presets (`10.0.2.2:4000`, `192.168.1.X:4000`, `localhost:4000`) and custom IP/port configuration for cross-device LAN testing.

### H. Realistic Stealth Calculator Decoy
* Disguises the application as a realistic, standard system calculator.
* Implements full decimal arithmetic (`+`, `-`, `×`, `÷`, `%`, `±`), dynamic state buffering, and error handling.
* Secret duress PIN triggers silent SOS or restores the Guardian Cockpit without alerting potential aggressors.

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

---

## 6. Testing & Quality Assurance

The mobile edge client includes a comprehensive test suite across unit, integration, and UI component layers:

```bash
cd mobile
bun run test   # or: npx jest --maxWorkers=2
```

### Test Coverage Summary:
* **15 Test Suites, 97 Passing Tests**:
  * `ServerConfigModal.test.tsx`: Validates IP address inputs, quick presets, error states, and modal visibility.
  * `CitizenAuth.test.tsx`: Validates login, registration, validation errors, and guest access.
  * `ShieldTab.test.tsx`: Validates SOS trigger activation, safe-word guidance, status cards, and sensitivity changes.
  * `SafeCircleTab.test.tsx`: Tests contact list rendering, add/delete contact flows, and volunteer mesh toggles.
  * `DiagnosticsTab.test.tsx`: Verifies live sensor readings, battery status, and 3-step voice calibration prompts.
  * `twoTierDistressPipeline.test.ts`: Verifies threshold tuning, preemption pausing, acoustic event processing, and native spotter listeners.
  * `hardwareLocationService.test.ts`: Tests GPS permission requests, mock position stream, and haversine calculations.
  * `hardwareBatteryService.test.ts`: Tests battery telemetry, low-power mode, and critical battery event dispatch.
  * `hardwareSnatchService.test.ts`: Tests accelerometer thresholds and snatch anomaly triggering.
  * `speakerBiometricsService.test.ts`: Verifies 16-D voice embedding comparison, Euclidean distance, and cosine similarity scoring.
  * `authService.test.ts`: Tests token storage, session caching, and IP normalization.
  * `emergencySmsService.test.ts`: Tests SMS text compression, coordinates formatting, and fallback logic.
  * `audioRingBuffer.test.ts`: Validates circular PCM buffer, contiguous window retrieval, and memory safety.
  * `socketIntegration.test.ts` & `restApiIntegration.test.ts`: Validates event bus payloads, authentication headers, and REST fallbacks.
