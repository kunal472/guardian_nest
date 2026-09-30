import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  Linking,
  AppState,
  AppStateStatus,
  PermissionsAndroid,
  Modal,
  Vibration,
} from "react-native";
import { requestRecordingPermissionsAsync } from "expo-audio";
import io, { Socket } from "socket.io-client";
import {
  screamDetector,
  ModelPrediction,
} from "./src/services/screamDetectionService";
import { CitizenAuth } from "./src/components/CitizenAuth";
import { ShieldTab } from "./src/components/ShieldTab";
import { SafeCircleTab } from "./src/components/SafeCircleTab";
import { DiagnosticsTab } from "./src/components/DiagnosticsTab";
import {
  getStoredCitizenAuth,
  clearStoredCitizenAuth,
  CitizenUser,
} from "./src/services/authService";
import {
  hardwareLocationService,
  computeHaversineMeters,
  LocationFix,
} from "./src/services/hardwareLocationService";
import {
  hardwareBatteryService,
  BatteryInfo,
  BatteryStateEnum,
} from "./src/services/hardwareBatteryService";
import {
  hardwareSnatchService,
  MotionTelemetry,
  SnatchSensitivity,
} from "./src/services/hardwareSnatchService";
import {
  hardwareAudioVaultService,
  AudioVaultState,
} from "./src/services/hardwareAudioVaultService";
import {
  twoTierDistressPipeline,
  PipelineTelemetry,
} from "./src/services/twoTierDistressPipeline";
import { speakerBiometricsService } from "./src/services/speakerBiometricsService";
import { nativeShutdownService } from "./src/services/nativeShutdownService";
import { emergencySmsService } from "./src/services/emergencySmsService";
import { logger } from "./src/utils/logger";

const DEFAULT_BACKEND_URL = "http://10.102.152.72:3000";

type TriggerType =
  | "MANUAL_SOS"
  | "AUDIO_SCREAM"
  | "DEVICE_SNATCH"
  | "DEAD_MAN_SWITCH"
  | "SILENT_STEALTH_CALCULATOR";

interface QueuedLocation {
  lat: number;
  lng: number;
  batteryLevel: number;
  timestamp: string;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<CitizenUser | null>(() => {
    const auth = getStoredCitizenAuth();
    return auth ? auth.user : null;
  });
  const [authToken, setAuthToken] = useState<string | null>(() => {
    const auth = getStoredCitizenAuth();
    return auth ? auth.token : null;
  });
  const [backendUrl, setBackendUrl] = useState<string>(DEFAULT_BACKEND_URL);
  const [isGuestBypass, setIsGuestBypass] = useState<boolean>(false);

  const [isSosActive, setIsSosActive] = useState<boolean>(false);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState<TriggerType>("MANUAL_SOS");
  const [activeTab, setActiveTab] = useState<"SHIELD" | "CONTACTS" | "DIAGNOSTICS">("SHIELD");
  const [responderStatus, setResponderStatus] = useState<string | null>(null);
  const [isVolunteer, setIsVolunteer] = useState<boolean>(
    currentUser?.isVolunteer ?? false,
  );
  const [nearbyAlert, setNearbyAlert] = useState<any | null>(null);
  const [isStealthMode, setIsStealthMode] = useState<boolean>(false);
  const [calculatorInput, setCalculatorInput] = useState<string>("0");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationSpeed, setLocationSpeed] = useState<number | null>(null);
  const [isHardwareGps, setIsHardwareGps] = useState<boolean>(true);
  const [isSnatchDetectorActive, setIsSnatchDetectorActive] =
    useState<boolean>(true);
  const [motionTelemetry, setMotionTelemetry] =
    useState<MotionTelemetry | null>(null);
  const [snatchSensitivity, setSnatchSensitivity] =
    useState<SnatchSensitivity>("MEDIUM");
  const [pingCount, setPingCount] = useState<number>(0);
  const [deadmanSeconds, setDeadmanSeconds] = useState<number | null>(null);

  // Network & Battery Resilience States
  const [batteryLevel, setBatteryLevel] = useState<number>(85);
  const [batteryState, setBatteryState] =
    useState<BatteryStateEnum>("UNPLUGGED");
  const [isLowPowerMode, setIsLowPowerMode] = useState<boolean>(false);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [offlineQueue, setOfflineQueue] = useState<QueuedLocation[]>([]);
  const [lastGaspSent, setLastGaspSent] = useState<boolean>(false);
  const [lastTransmissionMethod, setLastTransmissionMethod] =
    useState<string>("Standby");
  const [isDevicePoweredOff, setIsDevicePoweredOff] = useState<boolean>(false);
  const [shutdownLastGaspNotice, setShutdownLastGaspNotice] = useState<
    string | null
  >(null);
  const [dynamicConfigNotice, setDynamicConfigNotice] = useState<string | null>(
    null,
  );

  // Two-Tier On-Device ML Distress Pipeline Telemetry
  const [pipelineTelemetry, setPipelineTelemetry] = useState<PipelineTelemetry>(
    {
      isPipelineActive: true,
      tier1Status: "spotting",
      tier2Status: "idle",
      yamnetConfidence: 0,
      targetClass: null,
      wakeWordDetected: null,
      transcript: null,
      distressIntent: null,
      verificationLatencyMs: 0,
      speakerBiometrics: null,
      ringBufferFill: 0,
      ringBufferSeconds: 0,
      liveAudioEnergyPercent: 8,
      liveDbfs: -55.0,
      lastEventTimestamp: null,
    },
  );

  // Speaker Biometrics Owner Profile State
  const [speakerProfile, setSpeakerProfile] = useState(() =>
    speakerBiometricsService.getProfile(),
  );
  const [enrollmentNotice, setEnrollmentNotice] = useState<string | null>(null);

  // Interactive 3-Step Live Voice Calibration State
  const [isCalibratingVoice, setIsCalibratingVoice] = useState<boolean>(false);
  const [calibrationStep, setCalibrationStep] = useState<number>(1);
  const [isRecordingVoiceSample, setIsRecordingVoiceSample] =
    useState<boolean>(false);
  const [recordedSamplesCount, setRecordedSamplesCount] = useState<number>(0);

  // Acoustic Scream ML States
  const [isMlListening, setIsMlListening] = useState<boolean>(false);
  const [latestMlPrediction, setLatestMlPrediction] =
    useState<ModelPrediction | null>(null);
  const [mlSensitivityThreshold, setMlSensitivityThreshold] =
    useState<number>(0.8);
  const [isModelReady, setIsModelReady] = useState<boolean>(true);

  // 30-Second Audio Evidence Vault State
  const [audioVault, setAudioVault] = useState<AudioVaultState>({
    status: "idle",
    elapsedSeconds: 0,
    remainingSeconds: 30,
    audioMetering: 0,
    recordingUri: null,
    uploadedUrl: null,
    errorMessage: null,
  });

  const [resolutionNotice, setResolutionNotice] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [calculatorTriggerNotice, setCalculatorTriggerNotice] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(coords);
  const lastEmittedLocationRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const batteryRef = useRef(batteryLevel);
  const isSosActiveRef = useRef(isSosActive);
  const incidentIdRef = useRef(incidentId);
  const isVolunteerRef = useRef(isVolunteer);
  const isSimulatedOfflineRef = useRef(isSimulatedOffline);
  const currentUserRef = useRef(currentUser);

  // Calibration Prompts Guide
  const CALIBRATION_PROMPTS = [
    {
      step: 1,
      phrase: "Help Me Guardian",
      desc: "Speak naturally into the phone",
    },
    { step: 2, phrase: "Emergency SOS", desc: "Speak with clear authority" },
    { step: 3, phrase: "Stop It Now", desc: "Speak with loud commanding tone" },
  ];

  // Request all hardware permissions (Microphone, Location, Notifications) & verify GPS provider
  useEffect(() => {
    const requestHardwareCapabilities = async () => {
      if (Platform.OS === "android") {
        try {
          const permissionsToRequest = [
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          ];
          if (typeof Platform.Version === "number" && Platform.Version >= 33) {
            permissionsToRequest.push(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            );
          }
          const results =
            await PermissionsAndroid.requestMultiple(permissionsToRequest);
          logger.info("[Guardian Startup] Android Permissions Granted:", results);

          // 1. Check if GPS / Location Provider is enabled on device
          const isLocationEnabled = await hardwareLocationService.ensureLocationServicesEnabled();
          if (!isLocationEnabled) {
            Alert.alert(
              "🛰️ Enable Device GPS",
              "Guardian Edge requires Location services to track your emergency SOS in real-time. Please turn on Location in quick settings.",
              [
                { text: "Dismiss", style: "cancel" },
                {
                  text: "Turn On GPS",
                  onPress: () => hardwareLocationService.ensureLocationServicesEnabled(),
                },
              ],
            );
          }

          // 2. Check if Mic permission is granted
          const micGranted =
            results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
            PermissionsAndroid.RESULTS.GRANTED;
          if (!micGranted) {
            Alert.alert(
              "🎙️ Microphone Required",
              "Always-on acoustic distress detection requires microphone permission. Please allow microphone access.",
              [
                { text: "Dismiss", style: "cancel" },
                { text: "Open Settings", onPress: () => Linking.openSettings() },
              ],
            );
          }
        } catch (e) {
          logger.warn("[Guardian Startup] Android permission request error:", e);
        }
      } else if (Platform.OS === "ios") {
        try {
          await requestRecordingPermissionsAsync();
          await hardwareLocationService.requestPermissions();
        } catch (e) {
          logger.warn("[Guardian Startup] iOS permission request error:", e);
        }
      }
    };

    requestHardwareCapabilities();

    // Maintain continuous background tracking & re-verify hardware on foreground
    const sub = AppState.addEventListener(
      "change",
      async (nextState: AppStateStatus) => {
        if (nextState === "active") {
          logger.info(
            "[Guardian] App returned to active foreground. Re-validating hardware...",
          );
          await hardwareLocationService.ensureLocationServicesEnabled();
          const freshFix = await hardwareLocationService.forceRefreshLocation();
          if (freshFix && freshFix.lat !== 0) {
            setCoords({ lat: freshFix.lat, lng: freshFix.lng });
            if (freshFix.accuracy) setLocationAccuracy(freshFix.accuracy);
          }
          twoTierDistressPipeline.startPipeline();
        } else if (nextState === "background" || nextState === "inactive") {
          logger.info(
            "[Guardian] 📱 App running in background / home screen. Ensuring continuous audio spotter & location telemetry remain active.",
          );
          // Keep audio spotter alive in background
          twoTierDistressPipeline.startPipeline();
        }
      },
    );

    return () => {
      sub.remove();
    };
  }, []);

  // Subscribe to Speaker Biometrics Profile Changes
  useEffect(() => {
    const unsub = speakerBiometricsService.subscribeProfile((profile) => {
      setSpeakerProfile(profile);
    });
    return unsub;
  }, []);

  // Subscribe to Two-Tier On-Device ML Pipeline
  useEffect(() => {
    twoTierDistressPipeline.setEmergencyCallback((type, metadata) => {
      console.warn(
        `[TWO-TIER ML PIPELINE] Emergency escalated via ${metadata.origin}:`,
        metadata,
      );
      triggerDistress(type);
    });

    const unsub = twoTierDistressPipeline.subscribe((telemetry) => {
      setPipelineTelemetry(telemetry);
    });

    twoTierDistressPipeline.startPipeline();

    return () => {
      unsub();
    };
  }, []);

  // Subscribe to 30s Hardware Audio Vault Service
  useEffect(() => {
    const unsub = hardwareAudioVaultService.subscribe((state) => {
      setAudioVault(state);
    });
    return unsub;
  }, []);

  // Synchronize ref states
  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);
  useEffect(() => {
    batteryRef.current = batteryLevel;
  }, [batteryLevel]);
  useEffect(() => {
    isSosActiveRef.current = isSosActive;
    twoTierDistressPipeline.setSosActive(isSosActive);
  }, [isSosActive]);
  useEffect(() => {
    incidentIdRef.current = incidentId;
  }, [incidentId]);
  useEffect(() => {
    isVolunteerRef.current = isVolunteer;
  }, [isVolunteer]);
  useEffect(() => {
    isSimulatedOfflineRef.current = isSimulatedOffline;
  }, [isSimulatedOffline]);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const cancelDistress = async () => {
    // 1. If 30s audio recording is currently active, stop recording and send whatever partial audio was captured
    if (hardwareAudioVaultService.isRecording()) {
      try {
        await hardwareAudioVaultService.finalizePartialEvidence(
          backendUrl,
          authToken || undefined,
        );
      } catch (err: any) {
        console.warn("[Guardian SOS Cancel] Error finalizing partial evidence:", err?.message);
      }
    }

    // 2. Reset distress state & audio vault
    setIsSosActive(false);
    twoTierDistressPipeline.setSosActive(false);
    setIncidentId(null);
    setResponderStatus(null);
    setDeadmanSeconds(null);
    setLastGaspSent(false);
    setShutdownLastGaspNotice(null);
    setShowCancelModal(false);
    hardwareAudioVaultService.reset();

    // 3. Re-engage the microphone for the always-on ML model spotter
    await twoTierDistressPipeline.resumeNativeSpotter(150);
  };

  const handlePromptCancelSos = () => {
    setShowCancelModal(true);
  };

  const handleResolveSos = async (status: "RESOLVED" | "FALSE_ALARM") => {
    setShowCancelModal(false);
    const targetIncId = incidentIdRef.current || incidentId;

    // 1. If audio recording is currently in progress, finalize and send partial audio before disarming
    if (hardwareAudioVaultService.isRecording()) {
      try {
        await hardwareAudioVaultService.finalizePartialEvidence(
          backendUrl,
          authToken || undefined,
        );
      } catch (err: any) {
        console.warn("[Guardian SOS Resolve] Error finalizing partial evidence:", err?.message);
      }
    }

    if (targetIncId) {
      // 2. Emit status change over Socket.IO
      if (socketRef.current?.connected) {
        socketRef.current.emit("responder:status_change", {
          incidentId: targetIncId,
          status,
        });
        socketRef.current.emit("incident:status_change", {
          incidentId: targetIncId,
          status,
        });
      }

      // 3. Transmit PATCH update to REST backend
      try {
        await fetch(`${backendUrl}/api/incidents/${targetIncId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({ status }),
        });
      } catch (err: any) {
        console.warn("[Guardian SOS Cancel] REST status sync error:", err?.message);
      }
    }

    // 4. Reset local mobile state & re-engage model
    await cancelDistress();
    try {
      Vibration.vibrate([0, 80, 80, 80]);
    } catch {}
    const noticeText =
      status === "RESOLVED"
        ? `🛡️ Emergency SOS #${targetIncId || "Active"} safely marked RESOLVED.`
        : `⚠️ Emergency SOS #${targetIncId || "Active"} marked as FALSE ALARM.`;
    setResolutionNotice(noticeText);
    setTimeout(() => setResolutionNotice(null), 8000);
  };

  // Handle Interactive Voice Calibration Recorder
  const handleStartVoiceCalibration = async () => {
    await twoTierDistressPipeline.pauseNativeSpotter('CALIBRATING', 200);
    setIsCalibratingVoice(true);
    setCalibrationStep(1);
    setRecordedSamplesCount(0);
    setEnrollmentNotice("Calibration Mode: Ready to capture 3 voice samples.");
  };

  const handleCancelVoiceCalibration = async () => {
    setIsCalibratingVoice(false);
    setCalibrationStep(1);
    setRecordedSamplesCount(0);
    setEnrollmentNotice(null);
    await twoTierDistressPipeline.resumeNativeSpotter(150);
  };

  const handleRecordCalibrationSample = async () => {
    if (isRecordingVoiceSample) return;
    setIsRecordingVoiceSample(true);
    try {
      const result =
        await speakerBiometricsService.recordLiveVoiceSample(calibrationStep);
      setRecordedSamplesCount(result.totalCompleted);

      if (calibrationStep < 3) {
        setCalibrationStep((prev) => prev + 1);
        setEnrollmentNotice(
          `Sample ${result.sampleIndex}/3 recorded! Next: Prompt ${calibrationStep + 1}.`,
        );
      } else {
        const finalProfile = speakerBiometricsService.finalizeCalibration(
          currentUser?.id || "owner_custom",
          currentUser?.name || "Primary Device Owner",
        );
        setSpeakerProfile(finalProfile);
        setIsCalibratingVoice(false);
        setCalibrationStep(1);
        setEnrollmentNotice(
          "🎉 Voice Profile Successfully Enrolled (3/3 Verified Samples)!",
        );
        setTimeout(() => setEnrollmentNotice(null), 5000);
        await twoTierDistressPipeline.resumeNativeSpotter(150);
      }
    } catch (err: any) {
      Alert.alert(
        "Microphone Calibration",
        "Could not capture voice: " + (err?.message || "Check permissions"),
      );
    } finally {
      setIsRecordingVoiceSample(false);
    }
  };

  // Synchronize telemetry with NativeShutdownService
  useEffect(() => {
    const contactPhones = currentUser?.emergencyContacts?.map(
      (c) => c.phoneNumber,
    );
    nativeShutdownService.updateTelemetry(
      coords?.lat ?? 0,
      coords?.lng ?? 0,
      batteryLevel,
      incidentId,
      contactPhones,
      currentUser?.name,
    );
  }, [coords, batteryLevel, incidentId, currentUser]);

  // Synchronous Pre-Shutdown Last Gasp Dispatcher
  const dispatchPreShutdownLastGasp = (reason: string = "OS_SHUTDOWN") => {
    const beacon = nativeShutdownService.dispatchPreShutdownBeacon(
      reason,
      backendUrl,
    );
    setShutdownLastGaspNotice(
      `Final GPS (${beacon.lat.toFixed(5)}, ${beacon.lng.toFixed(5)}) dispatched via Pre-Shutdown Beacon (${beacon.reason}).`,
    );
  };

  // OS AppState & Web beforeunload / pagehide Hooks
  useEffect(() => {
    nativeShutdownService.startListening((beacon) => {
      setShutdownLastGaspNotice(
        `Final GPS (${beacon.lat.toFixed(5)}, ${beacon.lng.toFixed(5)}) dispatched via Pre-Shutdown Beacon (${beacon.reason}).`,
      );
    });

    return () => {
      nativeShutdownService.stopListening();
    };
  }, []);

  // Synchronize Hardware Audio Vault target backend URL and auth
  useEffect(() => {
    hardwareAudioVaultService.setBackendUrl(backendUrl, authToken);
  }, [backendUrl, authToken]);

  // Initialize Socket.IO connection
  useEffect(() => {
    hardwareAudioVaultService.setBackendUrl(backendUrl, authToken);
    const socket = io(backendUrl, {
      auth: { token: authToken || "demo_mobile_token" },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      logger.info(
        `Mobile Edge Client connected to Guardian Event Bus at ${backendUrl}`,
      );
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      logger.warn("Mobile disconnected from Event Bus");
    });

    socket.on("distress:acknowledged", (data: any) => {
      logger.info("Distress acknowledged by server:", data);
      setIncidentId(data.incidentId);
      hardwareAudioVaultService.setIncidentId(data.incidentId);
      hardwareAudioVaultService.startEvidenceCapture(
        data.incidentId,
        30,
        backendUrl,
        authToken || undefined,
      );
    });

    // Cross-Platform Incident Status Synchronization & SOS Auto-Disarm
    const handleStatusUpdate = (data: any) => {
      const status = data?.status || data?.incident?.status;
      if (!status) return;

      setResponderStatus(status);

      if (status === "RESOLVED" || status === "FALSE_ALARM") {
        logger.info(`[EventBus] 🛡️ Incident marked ${status}. Disarming mobile SOS.`);
        cancelDistress();
        setResolutionNotice(
          `🛡️ Incident #${data.incidentId || incidentId || "SOS"} marked ${status} by Dispatcher/Responder.`,
        );
        setTimeout(() => setResolutionNotice(null), 8000);
      }
    };

    socket.on("events.responder.status_change", handleStatusUpdate);
    socket.on("incident:status_changed", handleStatusUpdate);
    socket.on("incident:updated", handleStatusUpdate);

    socket.on("nearby:broadcast", (alertData: any) => {
      setNearbyAlert(alertData);
    });

    // Dynamic Edge ML & Hardware Config Synchronization over Event Bus
    const handleConfigBroadcast = (data: any) => {
      console.log("📡 [EventBus] Dynamic System Config Update Received:", data);

      const scream =
        data.yamnetScreamThreshold ?? data.newWeights?.scream_confidence;
      const wakeWord = data.openWakeWordThreshold;
      const snatchG =
        data.snatchThresholdG ??
        (data.newWeights?.snatch_sensitivity
          ? data.newWeights.snatch_sensitivity * 4.0
          : undefined);
      const batteryCrit = data.batteryCriticalThreshold;

      if (scream !== undefined) {
        setMlSensitivityThreshold(scream);
        screamDetector.setSensitivityThreshold(scream);
        twoTierDistressPipeline.setDynamicThresholds(scream, wakeWord);
      } else if (wakeWord !== undefined) {
        twoTierDistressPipeline.setDynamicThresholds(undefined, wakeWord);
      }

      if (snatchG !== undefined) {
        hardwareSnatchService.setCustomThresholdG(snatchG);
      }

      const summaryParts: string[] = [];
      if (scream !== undefined)
        summaryParts.push(`Scream: ${(scream * 100).toFixed(0)}%`);
      if (wakeWord !== undefined)
        summaryParts.push(`WakeWord: ${(wakeWord * 100).toFixed(0)}%`);
      if (snatchG !== undefined)
        summaryParts.push(`Snatch: ${snatchG.toFixed(1)}G`);
      if (batteryCrit !== undefined)
        summaryParts.push(`LastGasp: ${(batteryCrit * 100).toFixed(0)}%`);

      const notice = `🌐 Config Synced: ${summaryParts.join(" • ")}`;
      setDynamicConfigNotice(notice);
      setTimeout(() => setDynamicConfigNotice(null), 6000);
    };

    socket.on("events.system.configuration_update", handleConfigBroadcast);
    socket.on("system:config_update", handleConfigBroadcast);

    return () => {
      socket.disconnect();
    };
  }, [authToken, backendUrl]);

  // Flush Offline Queue when connectivity is restored
  useEffect(() => {
    if (
      isConnected &&
      !isSimulatedOffline &&
      offlineQueue.length > 0 &&
      incidentId
    ) {
      console.log(
        `[Store-and-Forward] Flushing ${offlineQueue.length} queued breadcrumbs...`,
      );
      offlineQueue.forEach((queued) => {
        if (socketRef.current?.connected) {
          socketRef.current.emit("location:update", {
            incidentId,
            lat: queued.lat,
            lng: queued.lng,
            batteryLevel: queued.batteryLevel,
            isBacklogFlush: true,
          });
        }
      });
      setOfflineQueue([]);
      setLastTransmissionMethod(`Flushed ${offlineQueue.length} Backlog Pings`);
    }
  }, [isConnected, isSimulatedOffline, offlineQueue, incidentId]);

  // Transmit coordinate with 3-Tier Network Failover
  const transmitLocation = async (
    lat: number,
    lng: number,
    currentBattery: number,
    isLastGasp: boolean = false,
  ) => {
    const payload = {
      incidentId: incidentId || "inc_pending",
      lat,
      lng,
      batteryLevel: currentBattery,
      isLastGasp,
      timestamp: new Date().toISOString(),
    };

    if (isSimulatedOffline || !isConnected) {
      setOfflineQueue((prev) => [
        ...prev,
        {
          lat,
          lng,
          batteryLevel: currentBattery,
          timestamp: new Date().toISOString(),
        },
      ]);
      setLastTransmissionMethod(
        "Buffered in Offline Queue (Store-and-Forward)",
      );

      if (currentBattery <= 5 && !lastGaspSent) {
        triggerSmsFallback(lat, lng, currentBattery);
        setLastGaspSent(true);
      }
      return;
    }

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("location:update", payload);
      setPingCount((c) => c + 1);
      setLastTransmissionMethod(
        isLastGasp ? "⚡ LAST GASP via WebSocket" : "Live WebSocket Stream",
      );
      return;
    }

    try {
      if (incidentId) {
        await fetch(`${backendUrl}/api/incidents/${incidentId}/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng, batteryLevel: currentBattery }),
        });
        setPingCount((c) => c + 1);
        setLastTransmissionMethod("HTTP REST Fallback Gateway");
        return;
      }
    } catch {
      setOfflineQueue((prev) => [
        ...prev,
        {
          lat,
          lng,
          batteryLevel: currentBattery,
          timestamp: new Date().toISOString(),
        },
      ]);
      setLastTransmissionMethod("HTTP Failed -> Buffered to Queue");
    }
  };

  // Smart Emergency SMS Intent Fallback
  const triggerSmsFallback = (lat: number, lng: number, batt: number) => {
    emergencySmsService.dispatchEmergencySms({
      lat,
      lng,
      batteryLevel: batt,
      incidentId: incidentId || undefined,
      userName: currentUser?.name || "Citizen User",
      recipients: currentUser?.emergencyContacts?.map((c) => c.phoneNumber),
    });
  };

  // Live GPS Location Streaming via Hardware Location Service
  useEffect(() => {
    if (isDevicePoweredOff) {
      hardwareLocationService.stopTracking();
      return;
    }

    const handleLocationUpdate = (loc: LocationFix) => {
      setCoords({ lat: loc.lat, lng: loc.lng });
      setLocationAccuracy(loc.accuracy ?? null);
      setLocationSpeed(loc.speed ?? null);

      const now = Date.now();
      const lastEmitted = lastEmittedLocationRef.current;
      const distanceMoved = lastEmitted
        ? computeHaversineMeters(lastEmitted.lat, lastEmitted.lng, loc.lat, loc.lng)
        : 999999;

      if (isSosActiveRef.current) {
        lastEmittedLocationRef.current = { lat: loc.lat, lng: loc.lng, time: now };
        transmitLocation(
          loc.lat,
          loc.lng,
          batteryRef.current,
          batteryRef.current <= 5,
        );
      } else if (
        isVolunteerRef.current &&
        socketRef.current?.connected &&
        !isSimulatedOfflineRef.current
      ) {
        // Stationary Throttling: Only emit over network if moved >= 5m or 30s has passed (heartbeat)
        if (distanceMoved >= 5 || !lastEmitted || now - lastEmitted.time >= 30000) {
          lastEmittedLocationRef.current = { lat: loc.lat, lng: loc.lng, time: now };
          socketRef.current.emit("volunteer:location_update", {
            volunteerId: currentUserRef.current?.id || "u_mobile_volunteer",
            lat: loc.lat,
            lng: loc.lng,
          });
        }
      }
    };

    hardwareLocationService.startTracking(
      handleLocationUpdate,
      isSosActiveRef.current,
    );

    return () => {
      hardwareLocationService.stopTracking();
    };
  }, [isDevicePoweredOff]);

  // Live Battery Monitoring via Hardware Battery Service
  useEffect(() => {
    hardwareBatteryService.startListening((info: BatteryInfo) => {
      setBatteryLevel(info.level);
      setBatteryState(info.state);
      setIsLowPowerMode(info.isLowPowerMode);

      if (info.isCritical && !lastGaspSent && coordsRef.current) {
        setLastGaspSent(true);
        dispatchPreShutdownLastGasp("CRITICAL_BATTERY_EVENT");
        transmitLocation(
          coordsRef.current.lat,
          coordsRef.current.lng,
          info.level,
          true,
        );
        triggerSmsFallback(
          coordsRef.current.lat,
          coordsRef.current.lng,
          info.level,
        );
      }
    });

    return () => {
      hardwareBatteryService.stopListening();
    };
  }, [lastGaspSent]);

  // Accelerometer Snatch Detector Listener
  useEffect(() => {
    hardwareSnatchService.setSensitivity(snatchSensitivity);
    if (!isSnatchDetectorActive || isDevicePoweredOff) {
      hardwareSnatchService.stopListening();
      return;
    }

    hardwareSnatchService.startListening(
      () => {
        triggerDistress("DEVICE_SNATCH");
      },
      (data) => {
        setMotionTelemetry(data);
      },
    );

    return () => {
      hardwareSnatchService.stopListening();
    };
  }, [snatchSensitivity, isSnatchDetectorActive, isDevicePoweredOff]);

  // Dead Man's Switch Countdown Timer
  useEffect(() => {
    if (deadmanSeconds === null || deadmanSeconds <= 0) return;

    const timer = setInterval(() => {
      setDeadmanSeconds((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          triggerDistress("DEAD_MAN_SWITCH");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [deadmanSeconds]);

  // Trigger SOS Event
  const triggerDistress = async (type: TriggerType = triggerType) => {
    if (isSosActiveRef.current) {
      logger.warn(`[Guardian SOS] Ignored duplicate trigger '${type}' - SOS is already active.`);
      return;
    }

    setIsSosActive(true);
    twoTierDistressPipeline.setSosActive(true);
    setTriggerType(type);
    setResponderStatus("ALERTING_DISPATCH");
    setLastGaspSent(false);

    try {
      if (type === "SILENT_STEALTH_CALCULATOR") {
        Vibration.vibrate(60); // Subtle, silent haptic tick
      } else {
        Vibration.vibrate([0, 400, 200, 400]); // Noticeable distress pattern
      }
    } catch {}

    // If coordinates are null or 0, force refresh GPS fix before sending payload
    let targetCoords = coordsRef.current;
    if (!targetCoords || (targetCoords.lat === 0 && targetCoords.lng === 0)) {
      const freshFix = await hardwareLocationService.forceRefreshLocation();
      if (freshFix && freshFix.lat !== 0) {
        targetCoords = { lat: freshFix.lat, lng: freshFix.lng };
        setCoords(targetCoords);
      }
    }

    const currentLat = targetCoords?.lat ?? 0;
    const currentLng = targetCoords?.lng ?? 0;

    // Automatically initialize 30s emergency audio evidence capture (hands over exclusive mic)
    hardwareAudioVaultService.startEvidenceCapture(
      incidentId || undefined,
      30,
      backendUrl,
      authToken || undefined,
    );

    if (
      socketRef.current &&
      socketRef.current.connected &&
      !isSimulatedOffline
    ) {
      socketRef.current.emit("distress:triggered", {
        userId: currentUser?.id || "u_victim_mobile_01",
        userName: currentUser?.name || "Citizen User",
        phone: currentUser?.phone || "+1555019888",
        emergencyContacts: currentUser?.emergencyContacts,
        lat: currentLat,
        lng: currentLng,
        triggerType: type,
        batteryLevel: Math.round(batteryLevel),
      });
    } else {
      setIncidentId(`inc_offline_${Date.now()}`);
      setLastTransmissionMethod("Triggered in Offline Queue");

      // Also attempt background HTTP REST trigger to ensure backend gets alerted
      fetch(`${backendUrl}/api/incidents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          lat: currentLat,
          lng: currentLng,
          triggerType: type,
          batteryLevel: Math.round(batteryLevel),
        }),
      }).catch((e) => console.log("[Distress REST Fallback]:", e?.message));

      if (batteryLevel <= 5 && targetCoords) {
        triggerSmsFallback(currentLat, currentLng, Math.round(batteryLevel));
      }
    }
  };


  const handleLogout = () => {
    clearStoredCitizenAuth();
    setCurrentUser(null);
    setAuthToken(null);
    setIsGuestBypass(false);
    cancelDistress();
  };

  // Simulate Sudden Device Shutdown / Battery Depletion Kill
  const handleSimulatedDeviceShutdown = () => {
    dispatchPreShutdownLastGasp("MANUAL_POWER_OFF_SIMULATION");
    setIsDevicePoweredOff(true);
  };

  const handleDevicePowerOn = () => {
    setIsDevicePoweredOff(false);
    setBatteryLevel(80);
    setShutdownLastGaspNotice(null);
  };

  // Stealth Calculator Decoy Logic
  const handleCalcPress = (btn: string) => {
    if (btn === "C") {
      setCalculatorInput("0");
      return;
    }
    if (btn === "±") {
      if (calculatorInput === "0" || calculatorInput === "Error") return;
      setCalculatorInput((prev) =>
        prev.startsWith("-") ? prev.slice(1) : "-" + prev
      );
      return;
    }
    if (btn === "%") {
      try {
        const val = Number(calculatorInput);
        if (!isNaN(val)) {
          setCalculatorInput(String(val / 100));
        }
      } catch {
        setCalculatorInput("Error");
      }
      return;
    }
    if (btn === "=") {
      if (calculatorInput === "1122") {
        // Silent SOS Trigger from Stealth Calculator
        Vibration.vibrate(200);
        triggerDistress("SILENT_STEALTH_CALCULATOR");
        setCalculatorInput("0");
        setCalculatorTriggerNotice("🛡️ Silent SOS Transmitted");
        setTimeout(() => setCalculatorTriggerNotice(null), 3500);
      } else if (calculatorInput === "9999") {
        // Exit Stealth Decoy Mode
        setIsStealthMode(false);
        setCalculatorInput("0");
      } else {
        try {
          const sanitized = calculatorInput
            .replace(/×/g, "*")
            .replace(/÷/g, "/")
            .replace(/−/g, "-");
          const evalResult = String(
            Function(`'use strict'; return (${sanitized})`)()
          );
          setCalculatorInput(
            evalResult.length > 11
              ? Number(evalResult).toPrecision(6)
              : evalResult
          );
        } catch {
          setCalculatorInput("Error");
        }
      }
      return;
    }

    setCalculatorInput((prev) => {
      if (prev === "0" || prev === "Error") {
        return btn === "." ? "0." : btn;
      }
      return prev + btn;
    });
  };

  // Render Citizen Auth if not authenticated and not in guest test mode
  if (!currentUser && !isGuestBypass) {
    return (
      <CitizenAuth
        backendUrl={backendUrl}
        onUpdateBackendUrl={(url) => setBackendUrl(url)}
        onAuthSuccess={(user, token) => {
          setCurrentUser(user);
          setAuthToken(token);
          if (user.isVolunteer !== undefined) setIsVolunteer(user.isVolunteer);
        }}
        onBypassGuestMode={() => setIsGuestBypass(true)}
      />
    );
  }

  // Render Black Screen when simulated power off is active
  if (isDevicePoweredOff) {
    return (
      <SafeAreaView style={styles.poweredOffContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.poweredOffContent}>
          <Text style={styles.poweredOffEmoji}>📴</Text>
          <Text style={styles.poweredOffTitle}>DEVICE POWERED OFF</Text>
          <Text style={styles.poweredOffSub}>
            Operating system shut down. Beacon & location hardware halted.
          </Text>

          {shutdownLastGaspNotice && (
            <View style={styles.shutdownNoticeBox}>
              <Text style={styles.shutdownNoticeTitle}>
                ✅ PRE-SHUTDOWN LAST GASP FIRED
              </Text>
              <Text style={styles.shutdownNoticeText}>
                {shutdownLastGaspNotice}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.powerOnBtn}
            onPress={handleDevicePowerOn}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.powerOnBtnText}>🔌 Power Device Back On</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Render Stealth Decoy Calculator Screen
  if (isStealthMode) {
    const calcRows = [
      [
        { label: "C", type: "func", val: "C" },
        { label: "±", type: "func", val: "±" },
        { label: "%", type: "func", val: "%" },
        { label: "÷", type: "op", val: "÷" },
      ],
      [
        { label: "7", type: "num", val: "7" },
        { label: "8", type: "num", val: "8" },
        { label: "9", type: "num", val: "9" },
        { label: "×", type: "op", val: "×" },
      ],
      [
        { label: "4", type: "num", val: "4" },
        { label: "5", type: "num", val: "5" },
        { label: "6", type: "num", val: "6" },
        { label: "−", type: "op", val: "−" },
      ],
      [
        { label: "1", type: "num", val: "1" },
        { label: "2", type: "num", val: "2" },
        { label: "3", type: "num", val: "3" },
        { label: "+", type: "op", val: "+" },
      ],
      [
        { label: "0", type: "zero", val: "0" },
        { label: ".", type: "num", val: "." },
        { label: "=", type: "op", val: "=" },
      ],
    ];

    return (
      <SafeAreaView style={styles.calcContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        {/* Dynamic Full Width Number Display */}
        <View style={styles.calcDisplay}>
          <Text
            style={[
              styles.calcDisplayText,
              calculatorInput.length > 7 && { fontSize: 44 },
              calculatorInput.length > 10 && { fontSize: 34 },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {calculatorInput}
          </Text>
        </View>

        {/* 4x5 Authentic Button Grid */}
        <View style={styles.calcGrid}>
          {calcRows.map((row, rIdx) => (
            <View key={rIdx} style={styles.calcRow}>
              {row.map((btn) => (
                <TouchableOpacity
                  key={btn.label}
                  style={[
                    styles.calcBtn,
                    btn.type === "func" && styles.calcBtnFunc,
                    btn.type === "op" && styles.calcBtnOp,
                    btn.type === "zero" && styles.calcBtnZero,
                  ]}
                  onPress={() => handleCalcPress(btn.val)}
                  activeOpacity={0.65}
                >
                  <Text
                    style={[
                      styles.calcBtnText,
                      btn.type === "func" && styles.calcBtnFuncText,
                      btn.type === "op" && styles.calcBtnOpText,
                    ]}
                  >
                    {btn.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>

        {calculatorTriggerNotice && (
          <View style={styles.calcNoticeBox}>
            <Text style={styles.calcNoticeText}>
              {calculatorTriggerNotice}
            </Text>
          </View>
        )}

        <Text style={styles.calcHint}>
          Decoy Mode • Enter 1122= for Silent SOS • 9999= to return
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0d14" />

      {/* Top Header & Stealth Decoy Action */}
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.headerTitle}>GUARDIAN EDGE</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {isSosActive
              ? "🚨 DISTRESS STREAM ACTIVE (1/s)"
              : "STANDBY MODE (1/10s)"}
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            style={styles.stealthBtn}
            onPress={() => setIsStealthMode(true)}
            activeOpacity={0.8}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.stealthBtnText}>🕵️ Decoy</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Tab Content */}
      <View style={{ flex: 1 }}>
        {activeTab === "SHIELD" && (
          <ShieldTab
            batteryLevel={batteryLevel}
            isSosActive={isSosActive}
            dynamicConfigNotice={dynamicConfigNotice}
            shutdownLastGaspNotice={shutdownLastGaspNotice}
            resolutionNotice={resolutionNotice}
            responderStatus={responderStatus}
            nearbyAlert={nearbyAlert}
            isVolunteer={isVolunteer}
            handlePromptCancelSos={handlePromptCancelSos}
            triggerDistress={triggerDistress}
            coords={coords}
            triggerSmsFallback={triggerSmsFallback}
            pipelineTelemetry={pipelineTelemetry}
            onToggleVoicePipeline={() => {
              if (pipelineTelemetry.isPipelineActive) {
                twoTierDistressPipeline.stopPipeline();
              } else {
                twoTierDistressPipeline.startPipeline();
              }
            }}
            isSnatchDetectorActive={isSnatchDetectorActive}
            onToggleSnatchDetector={() =>
              setIsSnatchDetectorActive(!isSnatchDetectorActive)
            }
            snatchSensitivity={snatchSensitivity}
            onSetSnatchSensitivity={(lvl) => setSnatchSensitivity(lvl)}
            audioVault={audioVault}
            onStartAudioRecording={() => {
              hardwareAudioVaultService.startEvidenceCapture(
                incidentId || undefined,
                30
              );
            }}
            onStopAudioRecording={() => {
              hardwareAudioVaultService.stopAndSecure(
                backendUrl,
                authToken || undefined
              );
            }}
            deadmanSeconds={deadmanSeconds}
            onSetDeadmanSeconds={(sec) => setDeadmanSeconds(sec)}
          />
        )}

        {activeTab === "CONTACTS" && (
          <SafeCircleTab
            currentUser={currentUser}
            isVolunteer={isVolunteer}
            onToggleVolunteer={() => setIsVolunteer(!isVolunteer)}
            coords={coords}
            batteryLevel={batteryLevel}
            batteryState={batteryState}
            isLowPowerMode={isLowPowerMode}
            isConnected={isConnected}
            backendUrl={backendUrl}
            pingCount={pingCount}
            onRefreshBattery={() => {
              hardwareBatteryService.getBatterySnapshot().then((i) => {
                setBatteryLevel(i.level);
                setBatteryState(i.state);
                setIsLowPowerMode(i.isLowPowerMode);
              });
            }}
            onLogout={handleLogout}
            onTriggerSmsFallback={triggerSmsFallback}
          />
        )}

        {activeTab === "DIAGNOSTICS" && (
          <DiagnosticsTab
            isConnected={isConnected}
            backendUrl={backendUrl}
            pingCount={pingCount}
            pipelineTelemetry={pipelineTelemetry}
            speakerProfile={speakerProfile}
            currentUser={currentUser}
            isCalibratingVoice={isCalibratingVoice}
            calibrationStep={calibrationStep}
            isRecordingVoiceSample={isRecordingVoiceSample}
            recordedSamplesCount={recordedSamplesCount}
            enrollmentNotice={enrollmentNotice}
            calibrationPrompts={CALIBRATION_PROMPTS}
            onStartVoiceCalibration={handleStartVoiceCalibration}
            onRecordCalibrationSample={handleRecordCalibrationSample}
            onCancelVoiceCalibration={handleCancelVoiceCalibration}
            onChangeBiometricThreshold={() => {
              const currentThresh = speakerBiometricsService.getMatchThreshold();
              const nextThresh =
                currentThresh >= 0.8
                  ? 0.65
                  : currentThresh >= 0.72
                    ? 0.8
                    : 0.72;
              speakerBiometricsService.setMatchThreshold(nextThresh);
              setEnrollmentNotice(
                `Threshold: ${(nextThresh * 100).toFixed(0)}%`
              );
              setTimeout(() => setEnrollmentNotice(null), 3000);
            }}
            onSetScreamSensitivity={(lvl) =>
              twoTierDistressPipeline.setScreamSensitivity(lvl)
            }
            onSetWakeWordSensitivity={(lvl) =>
              twoTierDistressPipeline.setWakeWordSensitivity(lvl)
            }
            onSimulateScream={() =>
              twoTierDistressPipeline.handleScreamSpotterEvent(0.89, "Scream")
            }
            onSimulateWakeWordOwner={() =>
              twoTierDistressPipeline.handleWakeWordSpotterEvent("Help Me", true)
            }
            onSimulateWakeWordBystander={() =>
              twoTierDistressPipeline.handleWakeWordSpotterEvent("Help Me", false)
            }
            motionTelemetry={motionTelemetry}
            isSnatchDetectorActive={isSnatchDetectorActive}
            onToggleSnatchDetector={() =>
              setIsSnatchDetectorActive(!isSnatchDetectorActive)
            }
            snatchSensitivity={snatchSensitivity}
            onSetSnatchSensitivity={(lvl) => setSnatchSensitivity(lvl)}
            onSimulateSnatchJerk={() => hardwareSnatchService.simulateSnatchJerk()}
            isHardwareGps={isHardwareGps}
            onToggleGpsMode={() => setIsHardwareGps(!isHardwareGps)}
            coords={coords}
            locationAccuracy={locationAccuracy}
            locationSpeed={locationSpeed}
            onForceGpsPoll={async () => {
              const fix = await hardwareLocationService.forceRefreshLocation();
              if (fix && fix.lat !== 0) {
                setCoords({ lat: fix.lat, lng: fix.lng });
                if (fix.accuracy) setLocationAccuracy(fix.accuracy);
                if (fix.speed) setLocationSpeed(fix.speed);
              }
            }}
            isSimulatedOffline={isSimulatedOffline}
            onToggleDropNetwork={() =>
              setIsSimulatedOffline(!isSimulatedOffline)
            }
            offlineQueueLength={offlineQueue.length}
            lastTransmissionMethod={lastTransmissionMethod}
            onSimulateShutdown={handleSimulatedDeviceShutdown}
          />
        )}
      </View>

      {/* Docked Citizen Bottom Tab Navigation Bar */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "SHIELD" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("SHIELD")}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>🛡️</Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === "SHIELD" && styles.tabLabelActive,
            ]}
          >
            Shield
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "CONTACTS" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("CONTACTS")}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>👥</Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === "CONTACTS" && styles.tabLabelActive,
            ]}
          >
            Safe Circle
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "DIAGNOSTICS" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("DIAGNOSTICS")}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>⚡</Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === "DIAGNOSTICS" && styles.tabLabelActive,
            ]}
          >
            Diagnostics
          </Text>
        </TouchableOpacity>
      </View>

      {/* Disarm / Cancel SOS Confirmation Modal */}
      <Modal
        visible={showCancelModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🛡️ Disarm Emergency SOS</Text>
            <Text style={styles.modalDescription}>
              Please select the resolution status to transmit to emergency responders and dispatch:
            </Text>

            <TouchableOpacity
              style={[styles.modalActionBtn, styles.modalBtnResolve]}
              onPress={() => handleResolveSos("RESOLVED")}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnResolveText}>✅ Resolve Emergency (RESOLVED)</Text>
              <Text style={styles.modalBtnSubtext}>I am safe now • Emergency is resolved</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalActionBtn, styles.modalBtnFalseAlarm]}
              onPress={() => handleResolveSos("FALSE_ALARM")}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnFalseAlarmText}>⚠️ Mark as False Alarm (FALSE ALARM)</Text>
              <Text style={styles.modalBtnSubtext}>Accidental trigger or testing</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowCancelModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelBtnText}>Keep Emergency SOS Active</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0d14",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#f8fafc",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
    marginTop: 2,
  },
  stealthBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  stealthBtnText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
  },
  logoutBtn: {
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.3)",
  },
  logoutBtnText: {
    color: "#fda4af",
    fontSize: 12,
    fontWeight: "700",
  },
  sosContainer: {
    alignItems: "center",
    marginVertical: 18,
  },
  sosButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 4,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  sosButtonActive: {
    backgroundColor: "#10b981",
    shadowColor: "#10b981",
  },
  sosText: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 2,
  },
  sosSubtext: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  card: {
    backgroundColor: "rgba(24, 34, 52, 0.85)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  cardDesc: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  subCard: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  subCardPurple: {
    backgroundColor: "rgba(168, 85, 247, 0.08)",
    borderColor: "rgba(168, 85, 247, 0.25)",
  },
  subCardRed: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.22)",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  metaStack: {
    marginVertical: 3,
  },
  metaLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "500",
  },
  metaValue: {
    color: "#06b6d4",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 10,
  },
  modelStatusBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modelStatusBadgeReady: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderWidth: 1,
    borderColor: "#10b981",
  },
  modelStatusBadgeRed: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  modelStatusBadgeText: {
    color: "#34d399",
    fontSize: 10,
    fontWeight: "800",
  },
  badgeSmall: {
    backgroundColor: "rgba(168, 85, 247, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeSmallText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#d8b4fe",
  },
  badgeSmallOrange: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeSmallOrangeText: {
    fontSize: 10,
    color: "#fbbf24",
    fontWeight: "800",
  },
  meterTrack: {
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 4,
    marginBottom: 6,
  },
  meterFill: {
    height: "100%",
    backgroundColor: "#06b6d4",
    borderRadius: 3,
  },
  meterFillAlert: {
    backgroundColor: "#ef4444",
  },
  buttonRowResponsive: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  buttonWrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  actionBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    minHeight: 38,
  },
  actionBtnText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
  },
  actionBtnPurple: {
    backgroundColor: "rgba(168, 85, 247, 0.2)",
    borderColor: "#c084fc",
  },
  actionBtnBlue: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderColor: "#3b82f6",
  },
  actionBtnRed: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "#ef4444",
  },
  mlPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
  },
  mlPillActive: {
    backgroundColor: "rgba(168, 85, 247, 0.25)",
    borderColor: "#a855f7",
  },
  mlPillActiveRed: {
    backgroundColor: "rgba(239, 68, 68, 0.25)",
    borderColor: "#ef4444",
  },
  mlPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
  },
  mlPillTextActive: {
    color: "#d8b4fe",
  },
  mlPillTextActiveRed: {
    color: "#fca5a5",
  },
  simPill: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  simPillRed: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "#ef4444",
  },
  simPillPurple: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderColor: "#a855f7",
  },
  simPillGray: {
    backgroundColor: "rgba(100, 116, 139, 0.2)",
    borderColor: "#64748b",
  },
  simPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  battBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  battBtnText: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "700",
  },
  battBtnCritical: {
    backgroundColor: "rgba(239, 68, 68, 0.25)",
    borderColor: "#ef4444",
  },
  battBtnCriticalText: {
    color: "#f87171",
    fontSize: 11,
    fontWeight: "800",
  },
  shutdownSimBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    borderWidth: 1,
    borderColor: "#ef4444",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  shutdownSimBtnText: {
    color: "#fca5a5",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  mlToggleBtn: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 8,
  },
  mlToggleBtnActive: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "#ef4444",
  },
  mlToggleBtnText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
  },
  gpsToggleBtn: {
    marginTop: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
  },
  gpsToggleBtnText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  presetBtn: {
    flex: 1,
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    borderWidth: 1,
    borderColor: "#6366f1",
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
  },
  presetBtnText: {
    color: "#818cf8",
    fontWeight: "700",
    fontSize: 12,
  },
  timerActiveRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  timerCountdown: {
    color: "#f87171",
    fontWeight: "800",
    fontSize: 13,
  },
  timerCancelBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  timerCancelText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  volunteerToggle: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  volunteerToggleActive: {
    backgroundColor: "#10b981",
  },
  volunteerToggleText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },
  telemetryMiniBox: {
    marginTop: 6,
    padding: 6,
    borderRadius: 6,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  noticeMiniBox: {
    marginTop: 6,
    padding: 6,
    borderRadius: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10b981",
  },
  noticeMiniText: {
    fontSize: 11,
    color: "#6ee7b7",
    fontWeight: "600",
  },
  transcriptBox: {
    marginTop: 6,
    padding: 8,
    borderRadius: 6,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  transcriptText: {
    fontSize: 12,
    color: "#f8fafc",
    fontStyle: "italic",
  },
  intentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  intentTag: {
    fontSize: 10,
    fontWeight: "800",
    color: "#ef4444",
  },
  intentLatency: {
    fontSize: 10,
    color: "#94a3b8",
  },
  vaultRefBox: {
    marginTop: 6,
    padding: 8,
    borderRadius: 6,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
  },
  vaultRefText: {
    fontSize: 11,
    color: "#38bdf8",
    fontWeight: "600",
  },
  lastGaspBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.3)",
    borderWidth: 1.5,
    borderColor: "#ef4444",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  lastGaspTitle: {
    color: "#fca5a5",
    fontWeight: "900",
    fontSize: 12,
  },
  lastGaspSub: {
    color: "#fff",
    fontSize: 11,
    marginTop: 2,
  },
  resolutionBanner: {
    backgroundColor: "rgba(16, 185, 129, 0.25)",
    borderWidth: 1,
    borderColor: "#10b981",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  resolutionBannerTitle: {
    color: "#34d399",
    fontWeight: "900",
    fontSize: 13,
  },
  resolutionBannerSub: {
    color: "#ecfdf5",
    fontSize: 11,
    marginTop: 3,
  },
  shutdownNoticeBanner: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderWidth: 1,
    borderColor: "#10b981",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  shutdownNoticeBannerTitle: {
    color: "#34d399",
    fontWeight: "800",
    fontSize: 12,
  },
  shutdownNoticeBannerSub: {
    color: "#cbd5e1",
    fontSize: 11,
    marginTop: 2,
  },
  dynamicConfigBanner: {
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    borderWidth: 1,
    borderColor: "#818cf8",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  dynamicConfigBannerTitle: {
    color: "#a5b4fc",
    fontWeight: "800",
    fontSize: 12,
  },
  dynamicConfigBannerSub: {
    color: "#e0e7ff",
    fontSize: 11,
    marginTop: 2,
  },
  responderBanner: {
    backgroundColor: "rgba(249, 115, 22, 0.2)",
    borderWidth: 1,
    borderColor: "#f97316",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  responderBannerTitle: {
    color: "#fb923c",
    fontWeight: "800",
    fontSize: 12,
  },
  responderBannerSub: {
    color: "#cbd5e1",
    fontSize: 11,
    marginTop: 2,
  },
  nearbyBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  nearbyBannerTitle: {
    color: "#f87171",
    fontWeight: "800",
    fontSize: 12,
  },
  nearbyBannerSub: {
    color: "#cbd5e1",
    fontSize: 11,
    marginTop: 2,
  },
  poweredOffContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  poweredOffContent: {
    alignItems: "center",
    maxWidth: 400,
  },
  poweredOffEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  poweredOffTitle: {
    color: "#ef4444",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  poweredOffSub: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
  },
  shutdownNoticeBox: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10b981",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    width: "100%",
  },
  shutdownNoticeTitle: {
    color: "#34d399",
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 4,
  },
  shutdownNoticeText: {
    color: "#f8fafc",
    fontSize: 12,
  },
  powerOnBtn: {
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  powerOnBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  calcContainer: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: 16,
    paddingBottom: 24,
    justifyContent: "flex-end",
  },
  calcDisplay: {
    paddingHorizontal: 12,
    marginBottom: 20,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    minHeight: 90,
  },
  calcDisplayText: {
    color: "#ffffff",
    fontSize: 64,
    fontWeight: "300",
    textAlign: "right",
  },
  calcGrid: {
    width: "100%",
  },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  calcBtn: {
    width: "22%",
    aspectRatio: 1,
    borderRadius: 45,
    backgroundColor: "#333333",
    alignItems: "center",
    justifyContent: "center",
  },
  calcBtnZero: {
    width: "47%",
    aspectRatio: 2.15,
    borderRadius: 45,
    paddingLeft: 28,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  calcBtnFunc: {
    backgroundColor: "#a5a5a5",
  },
  calcBtnOp: {
    backgroundColor: "#ff9f0a",
  },
  calcBtnText: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "400",
  },
  calcBtnFuncText: {
    color: "#000000",
    fontWeight: "500",
    fontSize: 26,
  },
  calcBtnOpText: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "500",
  },
  calcNoticeBox: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderRadius: 6,
    alignSelf: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  calcNoticeText: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  calcHint: {
    color: "#334155",
    fontSize: 11,
    textAlign: "center",
    marginTop: 12,
  },
  citizenProfileCard: {
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  citizenAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  citizenAvatarText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  citizenName: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
  },
  citizenPhone: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 1,
  },
  emergencyContactPill: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  emergencyContactPillText: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1.5,
    borderColor: "rgba(239, 68, 68, 0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 20,
  },
  modalTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  modalDescription: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  modalActionBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    alignItems: "center",
  },
  modalBtnResolve: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderWidth: 1.5,
    borderColor: "#10b981",
  },
  modalBtnResolveText: {
    color: "#34d399",
    fontSize: 14,
    fontWeight: "800",
  },
  modalBtnFalseAlarm: {
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    borderWidth: 1.5,
    borderColor: "#f59e0b",
  },
  modalBtnFalseAlarmText: {
    color: "#fbbf24",
    fontSize: 14,
    fontWeight: "800",
  },
  modalBtnSubtext: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  modalCancelBtn: {
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  modalCancelBtnText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },
  bottomTabBar: {
    flexDirection: "row",
    backgroundColor: "#0b101b",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: "space-around",
    alignItems: "center",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginHorizontal: 4,
  },
  tabButtonActive: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  tabLabelActive: {
    color: "#38bdf8",
    fontWeight: "800",
  },
});
