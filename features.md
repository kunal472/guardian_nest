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

### 1. Dual-Tier Acoustic Edge Intelligence
- **Tier 1 (Lightweight Energy-Efficient Spotting)**: Continuous DBFS amplitude monitoring and rolling average noise floor calibration. Uses `openWakeWord` for local wake-phrase activation without heavy power drain.
- **Tier 2 (Deep Classification & Biometrics)**: On trigger, activates `YAMNet` (`yamnet.tflite`) acoustic classifier and Whisper.cpp (`ggml-tiny.en.bin`) to distinguish genuine screaming/distress from ambient noise.
- **Speaker Biometrics**: Enrolls and validates voice characteristics to prevent false alarms from third-party sounds.
- **Hardware Audio Vault (`guardian-audio`)**: Custom C++/JNI native module recording into an encrypted circular ring buffer. Raw audio stays on-device unless an active distress incident is confirmed.

### 2. Behavioral Biometrics & Sensor Anomaly Detection
- **Device Snatch Detection (`hardwareSnatchService`)**: Monitors high-frequency accelerometer vector magnitude spikes (`expo-sensors`) to detect physical phone snatching.
- **Battery & Telemetry Monitoring (`hardwareBatteryService`)**: Monitors power drain and charging status, injecting battery telemetry into live location pings.

### 3. Dynamic Location Streaming & Rate-Throttling
- **Dynamic GPS Throttling**:
  - *Active SOS*: Streams 1 location ping per second to the WebSocket gateway.
  - *Standby*: Streams 1 location ping every 10 seconds.
- **Server-Side Database Throttling**: The NestJS backend buffers high-frequency coordinate pings and limits database writes to PostgreSQL to 1 write every 2 seconds per incident, maintaining high-resolution real-time tracking in Redis while protecting the database.

### 4. Tactical Responder Dispatch & Proximity Sentinel Mesh
- **Geospatial Sentinel Proximity (`Redis GEO`)**: Automatically queries `volunteers:active_locations` within 500m of an SOS trigger in `< 1ms` and broadcasts alerts (`nearby:broadcast`).
- **Leaflet Radar & Breadcrumbs**: Live rendering of active incident locations, moving breadcrumb paths, and volunteer positions.
- **Audio Evidence Stream**: Uploads multipart/base64 encrypted audio vaults to the backend, enabling dispatchers to listen to 30-second context recordings.

### 5. Stealth & Anti-Tamper Security
- **Decoy Calculator UI**: Stealth mode masks the application as a fully functional calculator. Entering specific duress PINs seamlessly switches to the safety cockpit or silently triggers emergency alerts in the background.
- **Smart Offline SMS Fallback (`emergencySmsService`)**: Compresses GPS coordinates and auto-generates SMS intents to pre-configured emergency contacts if network connectivity is unavailable.

---

## Future Feature Roadmap

- **Ad-Hoc BLE Mesh Relay**: Web Bluetooth / native BLE scanning to hop emergency packets across nearby Guardian devices in cellular dead zones.
- **Wearable Hardware Triggers**: BLE Smart Ring and smartwatch GATT characteristic integration for discrete physical SOS activation.
- **Automated Dead Man's Switch**: Configurable countdown timer backed by Redis key expiry that automatically triggers emergency alerts if not checked in.
