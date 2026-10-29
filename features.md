# Project Guardian: Technical Feature Roadmap & Capabilities

This document outlines the feature capabilities and architectural roadmap for Project Guardian, annotated with exact implementation details.

---

## Core Platform Architecture & Clients

- **Mobile Edge Client (`/mobile`)**: React Native (`v0.86.3`) + Expo (`SDK ~57`) app for Android, iOS, and Web. Incorporates native C++/JNI audio modules (`guardian-audio`), on-device two-tier ML distress pipeline, device snatch accelerometry, and dynamic GPS throttling.
- **Emergency Responder Dashboard (`/dashboards/responder_dashboard`)**: React 19 + Vite 8 SPA. Real-time tactical Leaflet map with radar pins, live GPS breadcrumb trails, audio vault playback, and dispatch status controls over Socket.IO.
- **Admin Intelligence Dashboard (`/dashboards/admin_dashboard`)**: React 19 + Vite 8 SPA. Consumes `/graphql` endpoint for analytical KPI cards, user/responder ledgers, and broadcasts system ML configuration updates.
- **Core Backend (`/backend`)**: NestJS 11 with Fastify Adapter, PostgreSQL 15 (Prisma ORM 7), Redis 7 Geospatial Indexing, and Socket.IO Event Bus.

---

## Implemented Platform Capabilities

### 1. Dual-Tier Acoustic Edge Intelligence & Native Background Sentinel
- **Tier 1 (Lightweight Energy-Efficient Spotting)**: Continuous DBFS amplitude monitoring and rolling average noise floor calibration. Uses `openWakeWord` for local wake-phrase activation without heavy power drain.
- **Native Android Background Execution (`guardian-audio`)**: Runs an Android Foreground Service with a `PARTIAL_WAKE_LOCK` (`GuardianAudioRecordService.kt`), keeping a continuous 16kHz PCM audio thread (`AudioHardwareCoordinator.kt`) active even when the phone is locked or minimized (preventing Hermes JS timer freezing).
- **Autonomous Background Emergency Dispatch**: Detects screams natively and instantly triggers native device vibration (`Vibrator`), updates notifications to a critical alert banner, brings `MainActivity` to the foreground (`FLAG_ACTIVITY_REORDER_TO_FRONT`), and dispatches a direct background HTTP POST beacon to `/api/incidents` without requiring React Native to be awake.
- **Dynamic Control Plane <-> Native Sentinel Bridge**: React Native dynamically synchronizes sensitivity presets (`LOUD_ONLY`, `MEDIUM`, `SENSITIVE`), numeric ML weights (`0.70` - `0.90`), and backend server URLs to the running Kotlin service in real time (<1ms) without restarting the audio service.
- **Tier 2 (Deep Classification & Biometrics)**: On trigger, activates `YAMNet` (`yamnet.tflite`) acoustic classifier and Whisper.cpp (`ggml-tiny.en.bin`) to distinguish genuine screaming/distress from ambient noise.
- **Speaker Biometrics**: Enrolls and validates 16-D voice embeddings across a 3-step live calibration prompt to prevent false alarms from bystanders or television audio.
- **Hardware Audio Vault**: Encrypted circular ring buffer keeping raw audio on-device unless an active distress incident is confirmed, then captures a 30-second evidence window.

### 2. Behavioral Biometrics & Sensor Anomaly Detection
- **Device Snatch Detection (`hardwareSnatchService`)**: Monitors high-frequency accelerometer vector magnitude spikes (`expo-sensors`) to detect physical phone snatching.
- **Battery & Telemetry Monitoring (`hardwareBatteryService`)**: Monitors power drain and charging status, injecting battery telemetry into live location pings and triggering pre-shutdown emergency alerts when battery falls below critical levels.

### 3. Dynamic Location Streaming & Rate-Throttling
- **Dynamic GPS Throttling**:
  - *Active SOS*: Streams 1 location ping per second to the WebSocket gateway.
  - *Standby*: Streams 1 location ping every 10 seconds.
- **Server-Side Database Throttling**: The NestJS backend buffers high-frequency coordinate pings and limits database writes to PostgreSQL to 1 write every 2 seconds per incident, maintaining high-resolution real-time tracking in Redis while protecting the database.
- **Emergency Contact Alerts**: Dispatches location coordinates and battery status directly to registered emergency contacts via backend notifications and automated SMS intents.

### 4. Tactical Responder Dispatch & Proximity Sentinel Mesh
- **Geospatial Sentinel Proximity (`Redis GEO`)**: Automatically queries `volunteers:active_locations` within 500m of an SOS trigger in `< 1ms` and broadcasts alerts (`nearby:broadcast`).
- **Leaflet Radar & Breadcrumbs**: Live rendering of active incident locations, moving breadcrumb paths, and volunteer positions.
- **Audio Evidence Stream**: Uploads multipart/base64 encrypted audio vaults to the backend, enabling dispatchers to listen to 30-second context recordings.

### 5. Citizen-Centric UI & Anti-Tamper Security
- **Citizen UI Cockpit**: Tailored for everyday citizens rather than developers. Features `ShieldTab` (SOS triggers, safe-words, status badges), `SafeCircleTab` (emergency contacts, volunteer toggle), and `DiagnosticsTab` (sensor health, voice calibration).
- **Zero-Clipping Responsive ScrollViews**: All main sections and modals are wrapped in responsive `<ScrollView>` containers with `keyboardShouldPersistTaps="handled"`, preventing UI clipping on smaller physical mobile screens.
- **Dynamic LAN / Wi-Fi Server IP Config (`ServerConfigModal`)**: In-app modal with quick presets (`10.0.2.2:4000`, `192.168.1.X:4000`, `localhost:4000`) and custom port input, enabling instant connection to local servers during development and physical device testing without rebuilds.
- **Realistic Decoy Calculator UI**: Stealth mode masks the application as a fully functional standard calculator with decimal operations (`+`, `-`, `×`, `÷`, `%`, `±`), dynamic state buffering, and secret duress PIN switching.
- **Automated Dead Man's Switch**: Configurable countdown timer that automatically escalates into an active emergency distress dispatch if the user does not check in.
- **Smart Offline SMS Fallback (`emergencySmsService`)**: Compresses GPS coordinates and auto-generates SMS intents to pre-configured emergency contacts if network connectivity is unavailable.

### 6. Automated Testing & Verification
- **15 Test Suites & 97 Passing Tests**: Full Jest test coverage across unit tests (services, ring buffer, biometrics, location, battery, snatch, audio coordinator), integration tests (Socket.IO, REST API), and component tests (`CitizenAuth`, `ShieldTab`, `SafeCircleTab`, `DiagnosticsTab`, `ServerConfigModal`).

---

## Future Feature Roadmap

- **Ad-Hoc BLE Mesh Relay**: Web Bluetooth / native BLE scanning to hop emergency packets across nearby Guardian devices in cellular dead zones.
- **Wearable Hardware Triggers**: BLE Smart Ring and smartwatch GATT characteristic integration for discrete physical SOS activation.
