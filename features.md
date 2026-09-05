# Project Guardian: Technical Feature Roadmap

This document outlines the feature roadmap for Project Guardian, organized into phased development milestones. It is annotated with specific technical implementation details to guide developers during the build process.

## Core Platform Architecture & Clients
- **Admin Dashboard**: React.js SPA (Vite). Consumes GraphQL API. Hosted on Vercel/Netlify. Uses TailwindCSS and shadcn/ui for complex data tables.
- **Emergency Responder Dashboard**: React.js SPA (Vite). Heavy WebSocket (Socket.io-client) integration for real-time map rendering (Mapbox GL JS or Leaflet).
- **User Interface (Edge Client)**: React Native (Expo) for mobile applications (iOS/Android), and a React.js PWA for web fallback. Runs local TensorFlow.js models for audio/biometric detection.

---

## Phase 0: Infrastructure & Foundation
- **Progressive Web App (PWA)**: 
  - *Implementation*: Use `vite-plugin-pwa` with Workbox. Configure `manifest.json` for installability.
  - *Storage*: Use `idb` (IndexedDB wrapper) for caching user settings and offline queueing.
- **Service Worker Core**: 
  - *Implementation*: Custom Service Worker for precaching critical UI assets and utilizing the Background Sync API (`SyncManager`) to queue failed network requests.
- **Standardized API Connectivity**: 
  - *Implementation*: Axios instance with interceptors for attaching JWTs and handling 401 token refreshes. Use `import.meta.env` for environment variables across clusters.

## Phase 1: Connectivity & Core Alerting
- **Live Location Streaming**: 
  - *Implementation*: `navigator.geolocation.watchPosition` (Web) or `expo-location` (React Native). Pushed via Socket.io to the Event Bus. Implement dynamic throttling (1 ping/sec during active SOS, 1 ping/10sec otherwise) to save battery.
- **Manual Alert Pipeline**: 
  - *Implementation*: Redux/Zustand state trigger that hits `POST /api/distress` and immediately initiates the WebSocket stream. Fallback to Background Sync if offline.
- **Multi-Channel Alerts**: 
  - *Implementation*: Node.js backend integration with the **Twilio API** to auto-dispatch SMS and Voice calls containing a generated map deep-link (e.g., `guardian.app/track/inc_123`).

## Phase 2: Local Edge Intelligence & Biometrics
- **Local Dual-Thread Processing**: 
  - *Implementation*: Use the `AudioWorklet` API to capture raw microphone PCM data off the main UI thread. Pass buffers to a Web Worker running `TensorFlow.js` (or native React Native MLKit bridge).
- **Zero-Touch Edge Triggers**: 
  - *Implementation*: Local keyword spotting model (e.g., trained on "Guardian Activate") and acoustic event detection (YAMNet) for screams/glass breaks.
- **Dynamic Calibration**: 
  - *Implementation*: Local rolling average calculation of DBFS (Decibels relative to full scale) to establish a baseline noise floor. Triggers fire on standard deviation spikes.
- **Behavioral Biometrics**: 
  - *Implementation*: `DeviceMotionEvent` API (Web) or `expo-sensors` (React Native). Calculate velocity vectors to detect sudden acceleration signatures matching a phone snatch.

## Phase 3: Advanced Stealth & Anti-Tamper
- **Stealth Mode UI**: 
  - *Implementation*: Context-driven CSS theme switching (Dark Mode, high contrast). Disable all haptic feedback and notification sounds via native APIs.
- **Mirror UI Decoy**: 
  - *Implementation*: A fully functional React component (e.g., a Calculator) that intercepts specific PIN inputs to unmount the decoy and reveal the actual app state.
- **Duress PIN Exit**: 
  - *Implementation*: Backend logic that accepts a "fake" PIN. It returns a `200 OK` and updates the UI to look safe, but silently keeps the WebSocket distress stream alive in the background.
- **Hidden Visual & Audio Capture**: 
  - *Implementation*: `MediaRecorder` API buffering 30-second audio chunks in memory. On chunk completion, encrypt via Web Crypto API and upload to AWS S3 using pre-signed URLs.

## Phase 4: Community & Geospatial Mesh
- **Active Sentinel Mesh**: 
  - *Implementation*: Redis `GEOADD` and `GEORADIUS` backend logic to maintain the real-time index of active volunteers. Mapbox GL for frontend rendering.
- **Volunteer Dashboard**: 
  - *Implementation*: Role-based access control (RBAC). Only users with `role: VOLUNTEER` receive the UI components that subscribe to `events.distress.broadcast_nearby`.
- **Dynamic Mesh Broadcast**: 
  - *Implementation*: Reciprocal Socket.io rooms. When a volunteer accepts an alert, they join a specific incident room (`room:inc_123`). Both the victim and the responder emit and listen to coordinates within this room.

## Phase 5: Resilient Connectivity & Hardware
- **Ad-Hoc WebRTC & Bluetooth Mesh**: 
  - *Implementation*: `RTCPeerConnection` for local Wi-Fi direct hops. Web Bluetooth API to scan for nearby Guardian devices acting as relay nodes in zero-bar cellular environments.
- **Smart SMS Fallback Generator**: 
  - *Implementation*: Base64 compression of GPS coordinates. Trigger native `sms:` URI intents or background SMS sending (via Android native modules) if HTTP requests consistently fail.
- **Dead Man's Switch**: 
  - *Implementation*: A secure backend cron job (Node.js `node-cron` or Redis expired key events). The user sets a timer; if the mobile app doesn't send a cancellation ping before the Redis key expires, the backend automatically triggers the distress event.
- **Hardware Integration**: 
  - *Implementation*: `navigator.bluetooth` to pair with BLE smart rings. Listen for specific GATT characteristic value changes (e.g., a physical button press). Use the Screen Wake Lock API (`navigator.wakeLock.request('screen')`) to prevent the OS from killing the process.
