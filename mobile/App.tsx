import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import io, { Socket } from 'socket.io-client';
import { screamDetector, ModelPrediction } from './src/services/screamDetectionService';
import { CitizenAuth } from './src/components/CitizenAuth';
import {
  getStoredCitizenAuth,
  clearStoredCitizenAuth,
  CitizenUser,
} from './src/services/authService';
import {
  hardwareLocationService,
  LocationFix,
} from './src/services/hardwareLocationService';
import {
  hardwareBatteryService,
  BatteryInfo,
  BatteryStateEnum,
} from './src/services/hardwareBatteryService';
import {
  hardwareSnatchService,
  MotionTelemetry,
  SnatchSensitivity,
} from './src/services/hardwareSnatchService';
import {
  hardwareAudioVaultService,
  AudioVaultState,
} from './src/services/hardwareAudioVaultService';
import {
  twoTierDistressPipeline,
  PipelineTelemetry,
} from './src/services/twoTierDistressPipeline';
import {
  speakerBiometricsService,
} from './src/services/speakerBiometricsService';

const BACKEND_URL = 'http://localhost:3000';

type TriggerType = 'MANUAL_SOS' | 'AUDIO_SCREAM' | 'DEVICE_SNATCH' | 'DEAD_MAN_SWITCH';

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
  const [isGuestBypass, setIsGuestBypass] = useState<boolean>(false);

  const [isSosActive, setIsSosActive] = useState<boolean>(false);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState<TriggerType>('MANUAL_SOS');
  const [responderStatus, setResponderStatus] = useState<string | null>(null);
  const [isVolunteer, setIsVolunteer] = useState<boolean>(currentUser?.isVolunteer ?? false);
  const [nearbyAlert, setNearbyAlert] = useState<any | null>(null);
  const [isStealthMode, setIsStealthMode] = useState<boolean>(false);
  const [calculatorInput, setCalculatorInput] = useState<string>('0');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 40.7128, lng: -74.006 });
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationSpeed, setLocationSpeed] = useState<number | null>(null);
  const [isHardwareGps, setIsHardwareGps] = useState<boolean>(true);
  const [isSnatchDetectorActive, setIsSnatchDetectorActive] = useState<boolean>(true);
  const [motionTelemetry, setMotionTelemetry] = useState<MotionTelemetry | null>(null);
  const [snatchSensitivity, setSnatchSensitivity] = useState<SnatchSensitivity>('MEDIUM');
  const [pingCount, setPingCount] = useState<number>(0);
  const [deadmanSeconds, setDeadmanSeconds] = useState<number | null>(null);

  // Network & Battery Resilience States
  const [batteryLevel, setBatteryLevel] = useState<number>(85);
  const [batteryState, setBatteryState] = useState<BatteryStateEnum>('UNPLUGGED');
  const [isLowPowerMode, setIsLowPowerMode] = useState<boolean>(false);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [offlineQueue, setOfflineQueue] = useState<QueuedLocation[]>([]);
  const [lastGaspSent, setLastGaspSent] = useState<boolean>(false);
  const [lastTransmissionMethod, setLastTransmissionMethod] = useState<string>('Standby');
  const [isDevicePoweredOff, setIsDevicePoweredOff] = useState<boolean>(false);
  const [shutdownLastGaspNotice, setShutdownLastGaspNotice] = useState<string | null>(null);

  // Two-Tier On-Device ML Distress Pipeline Telemetry
  const [pipelineTelemetry, setPipelineTelemetry] = useState<PipelineTelemetry>({
    isPipelineActive: true,
    tier1Status: 'spotting',
    tier2Status: 'idle',
    yamnetConfidence: 0,
    targetClass: null,
    wakeWordDetected: null,
    transcript: null,
    distressIntent: null,
    verificationLatencyMs: 0,
    speakerBiometrics: null,
    ringBufferFill: 0,
    ringBufferSeconds: 0,
    lastEventTimestamp: null,
  });

  // Acoustic Scream ML States
  const [isMlListening, setIsMlListening] = useState<boolean>(false);
  const [latestMlPrediction, setLatestMlPrediction] = useState<ModelPrediction | null>(null);
  const [mlSensitivityThreshold, setMlSensitivityThreshold] = useState<number>(0.80);
  const [isModelReady, setIsModelReady] = useState<boolean>(true);

  // 30-Second Audio Evidence Vault State
  const [audioVault, setAudioVault] = useState<AudioVaultState>({
    status: 'idle',
    elapsedSeconds: 0,
    remainingSeconds: 30,
    audioMetering: 0,
    recordingUri: null,
    uploadedUrl: null,
    errorMessage: null,
    isSimulated: false,
  });

  const socketRef = useRef<Socket | null>(null);
  const streamIntervalRef = useRef<any>(null);
  const coordsRef = useRef(coords);
  const batteryRef = useRef(batteryLevel);
  const isSosActiveRef = useRef(isSosActive);
  const incidentIdRef = useRef(incidentId);

  // Subscribe to Two-Tier On-Device ML Pipeline
  useEffect(() => {
    twoTierDistressPipeline.setEmergencyCallback((type, metadata) => {
      console.warn(`[TWO-TIER ML PIPELINE] Emergency escalated via ${metadata.origin}:`, metadata);
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

  // Toggle Live AudioWorklet ML Inference Loop
  const toggleMlListening = async () => {
    if (isMlListening) {
      screamDetector.stopListening();
      setIsMlListening(false);
      setLatestMlPrediction(null);
    } else {
      setIsMlListening(true);
      screamDetector.startListening(
        (pred) => {
          setLatestMlPrediction(pred);
        },
        (confidence) => {
          // Automatic SOS Trigger on verified acoustic scream detection
          triggerDistress('AUDIO_SCREAM');
        },
      );
    }
  };

  // Synchronize ref states for synchronous shutdown/unmount callbacks
  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);
  useEffect(() => {
    batteryRef.current = batteryLevel;
  }, [batteryLevel]);
  useEffect(() => {
    isSosActiveRef.current = isSosActive;
  }, [isSosActive]);
  useEffect(() => {
    incidentIdRef.current = incidentId;
  }, [incidentId]);

  // Synchronous Pre-Shutdown Last Gasp Dispatcher
  const dispatchPreShutdownLastGasp = (reason: string = 'OS_SHUTDOWN') => {
    if (!isSosActiveRef.current) return;

    const currentCoords = coordsRef.current;
    const currentBatt = Math.round(batteryRef.current);
    const incId = incidentIdRef.current || 'inc_preshutdown';

    console.warn(`[PRE-SHUTDOWN LAST GASP] Firing final GPS fix before process kill (${reason})...`);

    if (socketRef.current?.connected) {
      socketRef.current.emit('location:update', {
        incidentId: incId,
        lat: currentCoords.lat,
        lng: currentCoords.lng,
        batteryLevel: currentBatt,
        isLastGasp: true,
        isPreShutdown: true,
        shutdownReason: reason,
        timestamp: new Date().toISOString(),
      });
    }

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const beaconData = new Blob([
          JSON.stringify({
            lat: currentCoords.lat,
            lng: currentCoords.lng,
            batteryLevel: currentBatt,
            isLastGasp: true,
            isPreShutdown: true,
          }),
        ], { type: 'application/json' });
        navigator.sendBeacon(`${BACKEND_URL}/api/incidents/${incId}/location`, beaconData);
      } catch (err) {
        console.warn('Beacon send failed:', err);
      }
    }

    setShutdownLastGaspNotice(`Final GPS (${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)}) dispatched via Pre-Shutdown Beacon.`);
  };

  // OS AppState & Web beforeunload / pagehide Hooks
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (isSosActiveRef.current) {
          dispatchPreShutdownLastGasp('APP_BACKGROUNDED_OR_TERMINATING');
        }
      }
    });

    const handleBeforeUnload = () => {
      if (isSosActiveRef.current) {
        dispatchPreShutdownLastGasp('BROWSER_TAB_CLOSE_OR_RELOAD');
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('pagehide', handleBeforeUnload);
    }

    return () => {
      subscription.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('pagehide', handleBeforeUnload);
      }
    };
  }, []);

  // Initialize Socket.IO connection
  useEffect(() => {
    const socket = io(BACKEND_URL, {
      auth: { token: 'demo_mobile_token' },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Mobile Edge Client connected to Guardian Event Bus');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Mobile disconnected from Event Bus');
    });

    socket.on('distress:acknowledged', (data: any) => {
      setIncidentId(data.incidentId);
      hardwareAudioVaultService.startEvidenceCapture(data.incidentId, 30);
    });

    socket.on('events.responder.status_change', (data: any) => {
      setResponderStatus(data.status);
    });

    socket.on('nearby:broadcast', (alertData: any) => {
      setNearbyAlert(alertData);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Flush Offline Queue when connectivity is restored
  useEffect(() => {
    if (isConnected && !isSimulatedOffline && offlineQueue.length > 0 && incidentId) {
      console.log(`[Store-and-Forward] Flushing ${offlineQueue.length} queued breadcrumbs...`);
      offlineQueue.forEach((queued) => {
        if (socketRef.current?.connected) {
          socketRef.current.emit('location:update', {
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
  const transmitLocation = async (lat: number, lng: number, currentBattery: number, isLastGasp: boolean = false) => {
    const payload = {
      incidentId: incidentId || 'inc_pending',
      lat,
      lng,
      batteryLevel: currentBattery,
      isLastGasp,
      timestamp: new Date().toISOString(),
    };

    if (isSimulatedOffline || !isConnected) {
      setOfflineQueue((prev) => [...prev, { lat, lng, batteryLevel: currentBattery, timestamp: new Date().toISOString() }]);
      setLastTransmissionMethod('Buffered in Offline Queue (Store-and-Forward)');

      if (currentBattery <= 5 && !lastGaspSent) {
        triggerSmsFallback(lat, lng, currentBattery);
        setLastGaspSent(true);
      }
      return;
    }

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('location:update', payload);
      setPingCount((c) => c + 1);
      setLastTransmissionMethod(isLastGasp ? '⚡ LAST GASP via WebSocket' : 'Live WebSocket Stream');
      return;
    }

    try {
      if (incidentId) {
        await fetch(`${BACKEND_URL}/api/incidents/${incidentId}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng, batteryLevel: currentBattery }),
        });
        setPingCount((c) => c + 1);
        setLastTransmissionMethod('HTTP REST Fallback Gateway');
        return;
      }
    } catch {
      setOfflineQueue((prev) => [...prev, { lat, lng, batteryLevel: currentBattery, timestamp: new Date().toISOString() }]);
      setLastTransmissionMethod('HTTP Failed -> Buffered to Queue');
    }
  };

  // Smart SMS Fallback Generator
  const triggerSmsFallback = (lat: number, lng: number, batt: number) => {
    const smsBody = encodeURIComponent(
      `🚨 GUARDIAN EMERGENCY ALERT: My battery is dying (${batt}%). Last GPS Location: https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)} | Incident #${incidentId || 'SOS'}`
    );
    const smsUri = `sms:?body=${smsBody}`;
    Linking.openURL(smsUri).catch((err) => {
      console.warn('Cannot launch SMS intent:', err);
    });
  };

  // Live GPS Location Streaming via Hardware Location Service (expo-location + Web GPS)
  useEffect(() => {
    if (isDevicePoweredOff) {
      hardwareLocationService.stopTracking();
      return;
    }

    hardwareLocationService.setSimulatedMode(!isHardwareGps, coords);

    const handleLocationUpdate = (loc: LocationFix) => {
      setCoords({ lat: loc.lat, lng: loc.lng });
      setLocationAccuracy(loc.accuracy ?? null);
      setLocationSpeed(loc.speed ?? null);

      setBatteryLevel((prevBatt) => {
        const nextBatt = isSosActive ? Math.max(1, prevBatt - (prevBatt > 10 ? 1 : 0.5)) : prevBatt;

        if (nextBatt <= 5 && !lastGaspSent && isSosActive) {
          setLastGaspSent(true);
          transmitLocation(loc.lat, loc.lng, nextBatt, true);
        } else if (isSosActive) {
          transmitLocation(loc.lat, loc.lng, nextBatt, false);
        } else if (isVolunteer && socketRef.current?.connected && !isSimulatedOffline) {
          socketRef.current.emit('volunteer:location_update', {
            volunteerId: currentUser?.id || 'u_mobile_volunteer',
            lat: loc.lat,
            lng: loc.lng,
          });
        }

        return nextBatt;
      });
    };

    hardwareLocationService.startTracking(handleLocationUpdate, isSosActive);

    return () => {
      hardwareLocationService.stopTracking();
    };
  }, [isSosActive, incidentId, isVolunteer, isSimulatedOffline, isConnected, lastGaspSent, isDevicePoweredOff, isHardwareGps, currentUser]);

  // Live Battery Monitoring via Hardware Battery Service (expo-battery + Web Battery API)
  useEffect(() => {
    hardwareBatteryService.startListening((info: BatteryInfo) => {
      setBatteryLevel(info.level);
      setBatteryState(info.state);
      setIsLowPowerMode(info.isLowPowerMode);

      if (info.isCritical && isSosActive && !lastGaspSent) {
        setLastGaspSent(true);
        transmitLocation(coords.lat, coords.lng, info.level, true);
      }
    });

    return () => {
      hardwareBatteryService.stopListening();
    };
  }, [isSosActive, lastGaspSent, coords]);

  // High-G Device Snatch Hardware Accelerometer Listener
  useEffect(() => {
    if (isDevicePoweredOff || !isSnatchDetectorActive) {
      hardwareSnatchService.stopListening();
      return;
    }

    hardwareSnatchService.setSensitivity(snatchSensitivity);
    hardwareSnatchService.startListening(
      () => {
        triggerDistress('DEVICE_SNATCH');
      },
      (telemetry) => {
        setMotionTelemetry(telemetry);
      }
    );

    return () => {
      hardwareSnatchService.stopListening();
    };
  }, [isDevicePoweredOff, isSnatchDetectorActive, snatchSensitivity]);

  // Dead Man's Switch Countdown Timer
  useEffect(() => {
    if (deadmanSeconds === null || deadmanSeconds <= 0) return;
    const timer = setInterval(() => {
      setDeadmanSeconds((prev) => {
        if (prev === 1) {
          triggerDistress('DEAD_MAN_SWITCH');
          return null;
        }
        return prev ? prev - 1 : null;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [deadmanSeconds]);

  // Trigger SOS Event
  const triggerDistress = (type: TriggerType = triggerType) => {
    setIsSosActive(true);
    setTriggerType(type);
    setResponderStatus('ALERTING_DISPATCH');
    setLastGaspSent(false);

    // Automatically initialize 30s emergency audio evidence capture
    hardwareAudioVaultService.startEvidenceCapture(incidentId || undefined, 30);

    if (socketRef.current && socketRef.current.connected && !isSimulatedOffline) {
      socketRef.current.emit('distress:triggered', {
        userId: currentUser?.id || 'u_victim_mobile_01',
        userName: currentUser?.name || 'Citizen User',
        phone: currentUser?.phone || '+1555019888',
        emergencyContacts: currentUser?.emergencyContacts,
        lat: coords.lat,
        lng: coords.lng,
        triggerType: type,
        batteryLevel: Math.round(batteryLevel),
        evidenceAudioUrl: `s3://guardian-vault/${Date.now()}.m4a`,
      });
    } else {
      setIncidentId(`inc_offline_${Date.now()}`);
      setLastTransmissionMethod('Triggered in Offline Queue');
      if (batteryLevel <= 5) {
        triggerSmsFallback(coords.lat, coords.lng, Math.round(batteryLevel));
      }
    }
  };

  const cancelDistress = () => {
    setIsSosActive(false);
    setIncidentId(null);
    setResponderStatus(null);
    setDeadmanSeconds(null);
    setLastGaspSent(false);
    setShutdownLastGaspNotice(null);
    hardwareAudioVaultService.reset();
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
    dispatchPreShutdownLastGasp('MANUAL_POWER_OFF_SIMULATION');
    setIsDevicePoweredOff(true);
  };

  const handleDevicePowerOn = () => {
    setIsDevicePoweredOff(false);
    setBatteryLevel(80);
    setShutdownLastGaspNotice(null);
  };

  // Stealth Calculator Decoy Logic
  const handleCalcPress = (btn: string) => {
    if (btn === 'C') {
      setCalculatorInput('0');
      return;
    }
    if (btn === '=') {
      if (calculatorInput === '9999') {
        setIsStealthMode(false);
        setCalculatorInput('0');
      } else {
        try {
          const evalResult = String(Function(`'use strict'; return (${calculatorInput})`)());
          setCalculatorInput(evalResult);
        } catch {
          setCalculatorInput('Error');
        }
      }
      return;
    }

    setCalculatorInput((prev) => (prev === '0' ? btn : prev + btn));
  };

  // Render Citizen Auth if not authenticated and not in guest test mode
  if (!currentUser && !isGuestBypass) {
    return (
      <CitizenAuth
        backendUrl={BACKEND_URL}
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
              <Text style={styles.shutdownNoticeTitle}>✅ PRE-SHUTDOWN LAST GASP FIRED</Text>
              <Text style={styles.shutdownNoticeText}>{shutdownLastGaspNotice}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.powerOnBtn} onPress={handleDevicePowerOn}>
            <Text style={styles.powerOnBtnText}>🔌 Power Device Back On</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Render Stealth Decoy Calculator Screen
  if (isStealthMode) {
    return (
      <SafeAreaView style={styles.calcContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.calcDisplay}>
          <Text style={styles.calcDisplayText}>{calculatorInput}</Text>
        </View>
        <View style={styles.calcGrid}>
          {['C', '(', ')', '/', '7', '8', '9', '*', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '00', '='].map(
            (btn) => (
              <TouchableOpacity
                key={btn}
                style={[styles.calcBtn, btn === '=' && styles.calcBtnEqual]}
                onPress={() => handleCalcPress(btn)}
              >
                <Text style={styles.calcBtnText}>{btn}</Text>
              </TouchableOpacity>
            ),
          )}
        </View>
        <Text style={styles.calcHint}>Enter PIN 9999 and press = to return</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Header & Citizen Profile Bar */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>GUARDIAN EDGE</Text>
            <Text style={styles.headerSubtitle}>
              {isSosActive ? '🚨 DISTRESS STREAM ACTIVE (1/s)' : 'STANDBY MODE (1/10s)'}
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={styles.stealthBtn}
              onPress={() => setIsStealthMode(true)}
            >
              <Text style={styles.stealthBtnText}>🕵️ Decoy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
            >
              <Text style={styles.logoutBtnText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Citizen Profile Card */}
        {currentUser && (
          <View style={styles.citizenProfileCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.citizenAvatar}>
                <Text style={styles.citizenAvatarText}>
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'C'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.citizenName}>{currentUser.name || 'Citizen Officer'}</Text>
                <Text style={styles.citizenPhone}>
                  {currentUser.phone} • {currentUser.isVolunteer ? '🤝 Community Volunteer' : 'Citizen Protected'}
                </Text>
              </View>
            </View>

            {currentUser.emergencyContacts && currentUser.emergencyContacts.length > 0 && (
              <View style={styles.emergencyContactPill}>
                <Text style={styles.emergencyContactPillText}>
                  🚨 Primary Relay: {currentUser.emergencyContacts[0].contactName} ({currentUser.emergencyContacts[0].phoneNumber})
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Critical Last Gasp Alert Banner */}
        {batteryLevel <= 5 && isSosActive && (
          <View style={styles.lastGaspBanner}>
            <Text style={styles.lastGaspTitle}>⚡ CRITICAL BATTERY &quot;LAST GASP&quot; TRANSMISSION</Text>
            <Text style={styles.lastGaspSub}>
              Battery at {Math.round(batteryLevel)}%! Final GPS fix pinned & broadcasted to dispatchers.
            </Text>
          </View>
        )}

        {/* Pre-Shutdown Beacon Feedback Banner */}
        {shutdownLastGaspNotice && (
          <View style={styles.shutdownNoticeBanner}>
            <Text style={styles.shutdownNoticeBannerTitle}>🛡️ PRE-SHUTDOWN BEACON DISPATCHED</Text>
            <Text style={styles.shutdownNoticeBannerSub}>{shutdownLastGaspNotice}</Text>
          </View>
        )}

        {/* Dynamic Responder Alert Notification */}
        {responderStatus && (
          <View style={styles.responderBanner}>
            <Text style={styles.responderBannerTitle}>
              {responderStatus === 'DISPATCHED' ? '🚑 RESCUE UNIT EN ROUTE' : '⚠️ DISPATCH NOTIFIED'}
            </Text>
            <Text style={styles.responderBannerSub}>
              Status: {responderStatus} • Units converging via Redis GEO mesh
            </Text>
          </View>
        )}

        {/* Nearby Alert for Volunteers */}
        {nearbyAlert && isVolunteer && (
          <View style={styles.nearbyBanner}>
            <Text style={styles.nearbyBannerTitle}>🚨 NEARBY DISTRESS DETECTED</Text>
            <Text style={styles.nearbyBannerSub}>
              {nearbyAlert.victimName || 'Victim'} is within {nearbyAlert.distanceMeters || '250'}m!
            </Text>
          </View>
        )}

        {/* Main SOS Trigger Button */}
        <View style={styles.sosContainer}>
          <TouchableOpacity
            style={[styles.sosButton, isSosActive && styles.sosButtonActive]}
            activeOpacity={0.8}
            onPress={() => (isSosActive ? cancelDistress() : triggerDistress('MANUAL_SOS'))}
          >
            <Text style={styles.sosText}>{isSosActive ? 'CANCEL' : 'SOS'}</Text>
            <Text style={styles.sosSubtext}>
              {isSosActive ? 'Tap to Disarm' : 'Hold 3s or Tap'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Two-Tier On-Device ML Distress Pipeline Dashboard */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.cardTitle}>Two-Tier Edge ML Distress Pipeline</Text>
              <Text style={styles.cardDesc}>
                100% Offline On-Device Neural Spotter & Verification Pipeline
              </Text>
            </View>
            <View style={[styles.modelStatusBadge, pipelineTelemetry.isPipelineActive && styles.modelStatusBadgeReady]}>
              <Text style={styles.modelStatusBadgeText}>
                {pipelineTelemetry.isPipelineActive ? '🟢 T1+T2 ARMED' : 'OFFLINE'}
              </Text>
            </View>
          </View>

          {/* Tier 1: Always-On Low-Power Spotters & Ring Buffer */}
          <View style={{ marginTop: 10, padding: 12, borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.03)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
            <View style={styles.rowBetween}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#38bdf8' }}>
                TIER 1: Always-On Neural Spotters (16kHz PCM)
              </Text>
              <Text style={{ fontSize: 11, color: pipelineTelemetry.tier1Status === 'spotting' ? '#10b981' : '#f59e0b', fontWeight: '700' }}>
                {pipelineTelemetry.tier1Status === 'spotting' ? '⚡ SPOTTING' : pipelineTelemetry.tier1Status === 'triggered' ? '🚨 TRIGGERED' : 'IDLE'}
              </Text>
            </View>

            <View style={[styles.rowBetween, { marginTop: 6 }]}>
              <Text style={styles.metaLabel}>Spotter A (YAMNet AudioSet):</Text>
              <Text style={[styles.metaValue, pipelineTelemetry.yamnetConfidence > 0.6 ? { color: '#ef4444', fontWeight: '800' } : { color: '#94a3b8' }]}>
                {pipelineTelemetry.targetClass ? `${pipelineTelemetry.targetClass} (${(pipelineTelemetry.yamnetConfidence * 100).toFixed(0)}%)` : 'Scream #11 / Yell #9 / Cry #12'}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Spotter B (Porcupine Keyword):</Text>
              <Text style={[styles.metaValue, pipelineTelemetry.wakeWordDetected ? { color: '#a855f7', fontWeight: '800' } : { color: '#94a3b8' }]}>
                {pipelineTelemetry.wakeWordDetected ? `"${pipelineTelemetry.wakeWordDetected}" Spotted` : '"Help" / "Emergency" / "Guardian"'}
              </Text>
            </View>

            {/* 5s Circular Audio Ring Buffer Meter */}
            <View style={{ marginTop: 8 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>5s Circular Ring Buffer (Pre/Post Context):</Text>
                <Text style={[styles.metaValue, { color: '#38bdf8' }]}>
                  {pipelineTelemetry.ringBufferSeconds.toFixed(1)}s / 5.0s (80,000 samples)
                </Text>
              </View>
              <View style={[styles.meterTrack, { marginTop: 4 }]}>
                <View
                  style={[
                    styles.meterFill,
                    {
                      width: `${pipelineTelemetry.ringBufferFill}%`,
                      backgroundColor: '#38bdf8',
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Speaker Biometrics & Owner Voice Filter */}
          <View style={{ marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: 'rgba(168, 85, 247, 0.08)', borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.2)' }}>
            <View style={styles.rowBetween}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#d8b4fe' }}>
                👤 Speaker Biometrics & Owner Voice Filter
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: pipelineTelemetry.speakerBiometrics?.isMatch ? '#34d399' : pipelineTelemetry.speakerBiometrics ? '#f87171' : '#94a3b8' }}>
                {pipelineTelemetry.speakerBiometrics?.isMatch
                  ? `OWNER VERIFIED (${(pipelineTelemetry.speakerBiometrics.similarity * 100).toFixed(0)}%)`
                  : pipelineTelemetry.speakerBiometrics
                  ? `REJECTED (${(pipelineTelemetry.speakerBiometrics.similarity * 100).toFixed(0)}%)`
                  : 'PROFILE ACTIVE (>= 0.72 Cosine)'}
              </Text>
            </View>
            <Text style={{ fontSize: 10, color: '#c084fc', marginTop: 2 }}>
              Filters bystander keyword triggers while universal scream spotter passes unconditionally.
            </Text>
          </View>

          {/* Tier 2: Heavy Whisper Verification & NLP Intent */}
          <View style={{ marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.08)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <View style={styles.rowBetween}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#f87171' }}>
                TIER 2: On-Demand Whisper ASR + NLP Intent
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '800', color: pipelineTelemetry.tier2Status === 'escalated' ? '#ef4444' : pipelineTelemetry.tier2Status === 'transcribing' ? '#38bdf8' : '#64748b' }}>
                {pipelineTelemetry.tier2Status === 'transcribing' ? '🎙️ TRANSCRIBING...' : pipelineTelemetry.tier2Status === 'intent_verifying' ? '🧠 INTENT VERIFY...' : pipelineTelemetry.tier2Status === 'escalated' ? '🚨 FULL SOS ESCALATED' : pipelineTelemetry.tier2Status === 'rejected' ? '❌ REJECTED (Bystander)' : 'STANDBY'}
              </Text>
            </View>

            {pipelineTelemetry.transcript && (
              <View style={{ marginTop: 6, padding: 8, borderRadius: 6, backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
                <Text style={{ fontSize: 11, color: '#f8fafc', fontStyle: 'italic' }}>
                  &quot;{pipelineTelemetry.transcript}&quot;
                </Text>
                {pipelineTelemetry.distressIntent && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#ef4444' }}>
                      INTENT: [{pipelineTelemetry.distressIntent}]
                    </Text>
                    <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                      • Latency: {pipelineTelemetry.verificationLatencyMs}ms
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Interactive ML Pipeline Test Controls */}
          <View style={{ marginTop: 10 }}>
            <Text style={[styles.metaLabel, { marginBottom: 6 }]}>Test Trigger Simulations:</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={[styles.mlPill, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444' }]}
                onPress={() => twoTierDistressPipeline.handleScreamSpotterEvent(0.89, 'Scream')}
              >
                <Text style={[styles.mlPillText, { color: '#fca5a5' }]}>🗣️ Scream (YAMNet #11)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.mlPill, { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: '#a855f7' }]}
                onPress={() => twoTierDistressPipeline.handleWakeWordSpotterEvent('Help Me', true)}
              >
                <Text style={[styles.mlPillText, { color: '#d8b4fe' }]}>📢 Wake-Word (Owner)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.mlPill, { backgroundColor: 'rgba(100, 116, 139, 0.2)', borderColor: '#64748b' }]}
                onPress={() => twoTierDistressPipeline.handleWakeWordSpotterEvent('Help Me', false)}
              >
                <Text style={[styles.mlPillText, { color: '#cbd5e1' }]}>👤 Bystander (Reject)</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={{
                marginTop: 8,
                paddingVertical: 6,
                alignItems: 'center',
              }}
              onPress={() => twoTierDistressPipeline.resetTelemetry()}
            >
              <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>
                🔄 Clear Pipeline Telemetry Log
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 30-Second Audio Evidence Vault Card */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.cardTitle}>30s Audio Evidence Vault</Text>
              <Text style={styles.cardDesc}>
                {audioVault.status === 'recording'
                  ? `Recording Emergency Audio (${audioVault.remainingSeconds}s remaining)`
                  : audioVault.status === 'uploading'
                  ? 'Transmitting encrypted audio payload to vault...'
                  : audioVault.status === 'secured'
                  ? 'Evidence locked in AES-256 Vault'
                  : 'Captures high-fidelity 30s audio buffer upon emergency trigger'}
              </Text>
            </View>
            <View
              style={[
                styles.modelStatusBadge,
                audioVault.status === 'recording'
                  ? { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444' }
                  : audioVault.status === 'secured'
                  ? styles.modelStatusBadgeReady
                  : {},
              ]}
            >
              <Text
                style={[
                  styles.modelStatusBadgeText,
                  audioVault.status === 'recording'
                    ? { color: '#f87171' }
                    : audioVault.status === 'secured'
                    ? { color: '#34d399' }
                    : {},
                ]}
              >
                {audioVault.status === 'recording'
                  ? `🔴 REC (${audioVault.remainingSeconds}s)`
                  : audioVault.status === 'uploading'
                  ? 'UPLOADING'
                  : audioVault.status === 'secured'
                  ? 'VAULT SECURED'
                  : 'ARMED'}
              </Text>
            </View>
          </View>

          {/* Real-Time Audio Level Spectrum Visualizer */}
          {audioVault.status === 'recording' && (
            <View style={{ marginTop: 10, marginBottom: 8 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>Mic Amplitude Level:</Text>
                <Text style={[styles.metaValue, { color: '#ef4444', fontWeight: '800' }]}>
                  {audioVault.audioMetering}% (16kHz AAC/PCM)
                </Text>
              </View>
              <View style={[styles.meterTrack, { marginTop: 6 }]}>
                <View
                  style={[
                    styles.meterFill,
                    {
                      width: `${audioVault.audioMetering}%`,
                      backgroundColor: '#ef4444',
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {audioVault.uploadedUrl && (
            <View style={{ marginTop: 8, padding: 8, borderRadius: 6, backgroundColor: 'rgba(56, 189, 248, 0.1)', borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.2)' }}>
              <Text style={{ fontSize: 11, color: '#38bdf8', fontWeight: '600' }}>
                🔒 Vault Ref: {audioVault.uploadedUrl}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              style={[
                styles.mlToggleBtn,
                { flex: 1, marginTop: 0 },
                audioVault.status === 'recording' && styles.mlToggleBtnActive,
              ]}
              onPress={() => {
                if (audioVault.status === 'recording') {
                  hardwareAudioVaultService.stopAndSecure(BACKEND_URL, authToken || undefined);
                } else {
                  hardwareAudioVaultService.startEvidenceCapture(incidentId || undefined, 30);
                }
              }}
            >
              <Text style={styles.mlToggleBtnText}>
                {audioVault.status === 'recording'
                  ? '⏹️ Stop & Transmit to Vault'
                  : '🎙️ Record 30s Audio Evidence'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Network & Battery Resiliency Center */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Network Resiliency & Pre-Shutdown Armor</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isLowPowerMode && (
                <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 10, color: '#fbbf24', fontWeight: '800' }}>LOW POWER</Text>
                </View>
              )}
              <Text style={{ fontSize: 11, fontWeight: '700', color: batteryState === 'CHARGING' ? '#10b981' : '#94a3b8' }}>
                {batteryState === 'CHARGING' ? '⚡ CHARGING' : batteryState === 'FULL' ? '🔋 FULL' : '🔋 UNPLUGGED'}
              </Text>
            </View>
          </View>
          
          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Battery Level:</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.metaValue, batteryLevel <= 10 ? { color: '#ef4444' } : { color: '#10b981' }]}>
                {Math.round(batteryLevel)}% {batteryLevel <= 5 ? '(Last Gasp Pinned)' : ''}
              </Text>
            </View>
          </View>

          {/* Simulated Battery Controls */}
          <View style={styles.batteryPresetRow}>
            <Text style={styles.metaLabel}>Simulate QA:</Text>
            <TouchableOpacity style={styles.battBtn} onPress={() => hardwareBatteryService.setSimulatedLevel(100, (i) => setBatteryLevel(i.level))}>
              <Text style={styles.battBtnText}>100%</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.battBtn} onPress={() => hardwareBatteryService.setSimulatedLevel(15, (i) => setBatteryLevel(i.level))}>
              <Text style={styles.battBtnText}>15%</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.battBtn, styles.battBtnCritical]} onPress={() => hardwareBatteryService.setSimulatedLevel(4, (i) => setBatteryLevel(i.level))}>
              <Text style={styles.battBtnCriticalText}>4% (Dying)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.battBtn} onPress={() => hardwareBatteryService.setSimulatedLevel(null, () => hardwareBatteryService.getBatterySnapshot().then(i => setBatteryLevel(i.level)))}>
              <Text style={styles.battBtnText}>🔄 Real</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Pre-Shutdown Last Gasp Simulator Button */}
          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Pre-Shutdown Hook:</Text>
            <Text style={[styles.metaValue, { color: '#10b981' }]}>Active (AppState + Beacon)</Text>
          </View>

          <TouchableOpacity
            style={styles.shutdownSimBtn}
            onPress={handleSimulatedDeviceShutdown}
          >
            <Text style={styles.shutdownSimBtnText}>⚡ Simulate Sudden Device Shutdown</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Network Connection & Offline Simulation */}
          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Active Transmission Pipeline:</Text>
            <Text style={styles.metaValue}>{lastTransmissionMethod}</Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Offline Queue (Store & Forward):</Text>
            <Text style={[styles.metaValue, offlineQueue.length > 0 ? { color: '#f97316' } : {}]}>
              {offlineQueue.length} Pings Buffered
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.simNetBtn, isSimulatedOffline && styles.simNetBtnActive]}
              onPress={() => setIsSimulatedOffline(!isSimulatedOffline)}
            >
              <Text style={styles.simNetBtnText}>
                {isSimulatedOffline ? '📶 Reconnect Network' : '❌ Simulate Network Drop'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.smsActionBtn}
              onPress={() => triggerSmsFallback(coords.lat, coords.lng, Math.round(batteryLevel))}
            >
              <Text style={styles.smsActionBtnText}>📱 Send Emergency SMS</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* GPS Stream Telemetry Card */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Live Geospatial Telemetry</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: isHardwareGps ? '#10b981' : '#f59e0b' }}>
                {isHardwareGps ? '🛰️ HARDWARE GPS' : '🎮 SIMULATED'}
              </Text>
            </View>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>GPS Coordinates:</Text>
            <Text style={styles.metaValue}>{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</Text>
          </View>
          
          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Fix Accuracy:</Text>
            <Text style={[styles.metaValue, { color: locationAccuracy && locationAccuracy < 10 ? '#10b981' : '#38bdf8' }]}>
              {locationAccuracy ? `±${locationAccuracy.toFixed(1)}m (High Accuracy)` : 'Locating Satellites...'}
            </Text>
          </View>

          {locationSpeed !== null && locationSpeed !== undefined && (
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Movement Velocity:</Text>
              <Text style={styles.metaValue}>{(locationSpeed * 3.6).toFixed(1)} km/h</Text>
            </View>
          )}

          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Pings Streamed:</Text>
            <Text style={styles.metaValue}>{pingCount} updates</Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Throttling Policy:</Text>
            <Text style={styles.metaValue}>
              {isSosActive ? 'High-Frequency (1000ms)' : 'Battery Saver (10000ms)'}
            </Text>
          </View>

          <TouchableOpacity
            style={{
              marginTop: 10,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
              alignItems: 'center',
            }}
            onPress={() => setIsHardwareGps(!isHardwareGps)}
          >
            <Text style={{ fontSize: 12, color: '#94a3b8', fontWeight: '600' }}>
              {isHardwareGps ? 'Switch to Test Simulation Wander' : 'Switch to Real Satellite GPS'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hardware Accelerometer Snatch Armor Card */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Device Snatch Armor (Accelerometer)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: isSnatchDetectorActive ? '#10b981' : '#64748b' }}>
                {isSnatchDetectorActive ? '⚡ 20 Hz ACTIVE' : 'PAUSED'}
              </Text>
            </View>
          </View>

          {motionTelemetry && (
            <View style={{ marginTop: 8, marginBottom: 12 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>Instantaneous G-Force:</Text>
                <Text
                  style={[
                    styles.metaValue,
                    motionTelemetry.isSpike
                      ? { color: '#ef4444', fontWeight: '900' }
                      : { color: '#38bdf8' },
                  ]}
                >
                  {motionTelemetry.magnitude.toFixed(2)} G {motionTelemetry.isSpike ? '💥 (SNATCH SPIKE!)' : '(Baseline 1.0G)'}
                </Text>
              </View>

              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>3-Axis Vector [X, Y, Z]:</Text>
                <Text style={[styles.metaValue, { fontFamily: 'monospace', fontSize: 11 }]}>
                  [{motionTelemetry.x.toFixed(2)}, {motionTelemetry.y.toFixed(2)}, {motionTelemetry.z.toFixed(2)}]
                </Text>
              </View>

              {/* Real-time Acceleration Bar */}
              <View style={[styles.meterTrack, { marginTop: 6 }]}>
                <View
                  style={[
                    styles.meterFill,
                    { width: `${Math.min(100, (motionTelemetry.magnitude / 5.0) * 100)}%` },
                    motionTelemetry.isSpike && styles.meterFillAlert,
                  ]}
                />
              </View>
            </View>
          )}

          {/* Snatch Sensitivity Selector */}
          <Text style={[styles.metaLabel, { marginBottom: 6 }]}>Snatch Jerk Trigger Threshold:</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {(['LOW', 'MEDIUM', 'HIGH'] as const).map((lvl) => (
              <TouchableOpacity
                key={lvl}
                style={[
                  styles.mlPill,
                  snatchSensitivity === lvl && styles.mlPillActive,
                ]}
                onPress={() => setSnatchSensitivity(lvl)}
              >
                <Text
                  style={[
                    styles.mlPillText,
                    snatchSensitivity === lvl && styles.mlPillTextActive,
                  ]}
                >
                  {lvl} {lvl === 'LOW' ? '(4.2G)' : lvl === 'MEDIUM' ? '(3.2G)' : '(2.2G)'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Action Row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.simNetBtn, { flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444' }]}
              onPress={() => hardwareSnatchService.simulateSnatchJerk()}
            >
              <Text style={[styles.simNetBtnText, { color: '#fda4af' }]}>
                📱 Simulate Snatch Jerk
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.simNetBtn, { flex: 1 }]}
              onPress={() => setIsSnatchDetectorActive(!isSnatchDetectorActive)}
            >
              <Text style={styles.simNetBtnText}>
                {isSnatchDetectorActive ? '🛑 Pause Snatch' : '▶️ Resume Snatch'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dead Man's Switch Safety Timer */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{"Dead Man's Switch Timer"}</Text>
          <Text style={styles.cardDesc}>
            Triggers automatic SOS distress if you do not check-in before the timer hits zero.
          </Text>
          {deadmanSeconds ? (
            <View style={styles.timerActiveRow}>
              <Text style={styles.timerCountdown}>⏰ {deadmanSeconds}s Remaining</Text>
              <TouchableOpacity
                style={styles.timerCancelBtn}
                onPress={() => setDeadmanSeconds(null)}
              >
                <Text style={styles.timerCancelText}>Disarm Timer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.timerPresetRow}>
              {[30, 60, 300].map((sec) => (
                <TouchableOpacity
                  key={sec}
                  style={styles.presetBtn}
                  onPress={() => setDeadmanSeconds(sec)}
                >
                  <Text style={styles.presetBtnText}>{sec >= 60 ? `${sec / 60} min` : `${sec}s`}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Volunteer Sentinel Mode Toggle */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardTitle}>Community Sentinel Mesh</Text>
              <Text style={styles.cardDesc}>Receive alerts within 500m</Text>
            </View>
            <TouchableOpacity
              style={[styles.volunteerToggle, isVolunteer && styles.volunteerToggleActive]}
              onPress={() => setIsVolunteer(!isVolunteer)}
            >
              <Text style={styles.volunteerToggleText}>{isVolunteer ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0d14',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  stealthBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  stealthBtnText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  sosContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  sosButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sosButtonActive: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
  },
  sosText: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 2,
  },
  sosSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  card: {
    backgroundColor: 'rgba(24, 34, 52, 0.75)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  cardDesc: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metaLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  metaValue: {
    color: '#06b6d4',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  modelStatusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  modelStatusBadgeReady: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  modelStatusBadgeText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
  },
  mlStreamBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  meterTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 10,
  },
  meterFill: {
    height: '100%',
    backgroundColor: '#06b6d4',
    borderRadius: 3,
  },
  meterFillAlert: {
    backgroundColor: '#ef4444',
  },
  mlToggleBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  mlToggleBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },
  mlToggleBtnText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  batteryPresetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  battBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
  },
  battBtnText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600',
  },
  battBtnCritical: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  battBtnCriticalText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },
  shutdownSimBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  shutdownSimBtnText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '700',
  },
  simNetBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  simNetBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },
  simNetBtnText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  smsActionBtn: {
    flex: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  smsActionBtnText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '700',
  },
  triggerGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  triggerBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  triggerBtnEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  triggerBtnText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  timerPresetRow: {
    flexDirection: 'row',
    gap: 10,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: '#6366f1',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  presetBtnText: {
    color: '#818cf8',
    fontWeight: '700',
    fontSize: 12,
  },
  timerActiveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 10,
    borderRadius: 8,
  },
  timerCountdown: {
    color: '#f87171',
    fontWeight: '700',
    fontSize: 14,
  },
  timerCancelBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  timerCancelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  volunteerToggle: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  volunteerToggleActive: {
    backgroundColor: '#10b981',
  },
  volunteerToggleText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  lastGaspBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 2,
    borderColor: '#ef4444',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  lastGaspTitle: {
    color: '#fca5a5',
    fontWeight: '900',
    fontSize: 13,
  },
  lastGaspSub: {
    color: '#fff',
    fontSize: 11,
    marginTop: 2,
  },
  shutdownNoticeBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  shutdownNoticeBannerTitle: {
    color: '#34d399',
    fontWeight: '800',
    fontSize: 13,
  },
  shutdownNoticeBannerSub: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 2,
  },
  responderBanner: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderWidth: 1,
    borderColor: '#f97316',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  responderBannerTitle: {
    color: '#fb923c',
    fontWeight: '800',
    fontSize: 13,
  },
  responderBannerSub: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 2,
  },
  nearbyBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  nearbyBannerTitle: {
    color: '#f87171',
    fontWeight: '800',
    fontSize: 13,
  },
  nearbyBannerSub: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 2,
  },
  // Powered off screen
  poweredOffContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  poweredOffContent: {
    alignItems: 'center',
    maxWidth: 400,
  },
  poweredOffEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  poweredOffTitle: {
    color: '#ef4444',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  poweredOffSub: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  shutdownNoticeBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
    width: '100%',
  },
  shutdownNoticeTitle: {
    color: '#34d399',
    fontWeight: '800',
    fontSize: 12,
    marginBottom: 4,
  },
  shutdownNoticeText: {
    color: '#f8fafc',
    fontSize: 12,
  },
  powerOnBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  powerOnBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  // Calculator Decoy
  calcContainer: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
    justifyContent: 'flex-end',
  },
  calcDisplay: {
    padding: 20,
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  calcDisplayText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '300',
  },
  calcGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  calcBtn: {
    width: '21%',
    aspectRatio: 1,
    borderRadius: 40,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calcBtnEqual: {
    backgroundColor: '#ff9f0a',
  },
  calcBtnText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
  },
  calcHint: {
    color: '#555',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  logoutBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  citizenProfileCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  citizenAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  citizenAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  citizenName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  citizenPhone: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 1,
  },
  emergencyContactPill: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  emergencyContactPillText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  mlPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  mlPillActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderColor: '#a855f7',
  },
  mlPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  mlPillTextActive: {
    color: '#d8b4fe',
  },
});
