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

const BACKEND_URL = 'http://localhost:3000';

type TriggerType = 'MANUAL_SOS' | 'AUDIO_SCREAM' | 'DEVICE_SNATCH' | 'DEAD_MAN_SWITCH';

interface QueuedLocation {
  lat: number;
  lng: number;
  batteryLevel: number;
  timestamp: string;
}

export default function App() {
  const [isSosActive, setIsSosActive] = useState<boolean>(false);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState<TriggerType>('MANUAL_SOS');
  const [responderStatus, setResponderStatus] = useState<string | null>(null);
  const [isVolunteer, setIsVolunteer] = useState<boolean>(false);
  const [nearbyAlert, setNearbyAlert] = useState<any | null>(null);
  const [isStealthMode, setIsStealthMode] = useState<boolean>(false);
  const [calculatorInput, setCalculatorInput] = useState<string>('0');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 40.7128, lng: -74.006 });
  const [pingCount, setPingCount] = useState<number>(0);
  const [deadmanSeconds, setDeadmanSeconds] = useState<number | null>(null);

  // Network & Battery Resilience States
  const [batteryLevel, setBatteryLevel] = useState<number>(85);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [offlineQueue, setOfflineQueue] = useState<QueuedLocation[]>([]);
  const [lastGaspSent, setLastGaspSent] = useState<boolean>(false);
  const [lastTransmissionMethod, setLastTransmissionMethod] = useState<string>('Standby');
  const [isDevicePoweredOff, setIsDevicePoweredOff] = useState<boolean>(false);
  const [shutdownLastGaspNotice, setShutdownLastGaspNotice] = useState<string | null>(null);

  // Acoustic Scream ML States
  const [isMlListening, setIsMlListening] = useState<boolean>(false);
  const [latestMlPrediction, setLatestMlPrediction] = useState<ModelPrediction | null>(null);
  const [mlSensitivityThreshold, setMlSensitivityThreshold] = useState<number>(0.80);
  const [isModelReady, setIsModelReady] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const coordsRef = useRef(coords);
  const batteryRef = useRef(batteryLevel);
  const isSosActiveRef = useRef(isSosActive);
  const incidentIdRef = useRef(incidentId);

  // Initialize ML Model Placeholder
  useEffect(() => {
    screamDetector.loadModel().then((ready) => {
      setIsModelReady(ready);
    });
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

  // Live GPS Location Streaming with Dynamic Throttling & Battery Drain
  useEffect(() => {
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    if (isDevicePoweredOff) return;

    const throttleIntervalMs = isSosActive ? 1000 : 10000;

    streamIntervalRef.current = setInterval(() => {
      setCoords((prev) => {
        const nextLat = prev.lat + (isSosActive ? (Math.random() - 0.5) * 0.0004 : 0);
        const nextLng = prev.lng + (isSosActive ? (Math.random() - 0.5) * 0.0004 : 0);

        setBatteryLevel((prevBatt) => {
          const nextBatt = isSosActive ? Math.max(1, prevBatt - (prevBatt > 10 ? 1 : 0.5)) : prevBatt;

          if (nextBatt <= 5 && !lastGaspSent && isSosActive) {
            setLastGaspSent(true);
            transmitLocation(nextLat, nextLng, nextBatt, true);
          } else if (isSosActive) {
            transmitLocation(nextLat, nextLng, nextBatt, false);
          } else if (isVolunteer && socketRef.current?.connected && !isSimulatedOffline) {
            socketRef.current.emit('volunteer:location_update', {
              volunteerId: 'u_mobile_volunteer',
              lat: nextLat,
              lng: nextLng,
            });
          }

          return nextBatt;
        });

        return { lat: nextLat, lng: nextLng };
      });
    }, throttleIntervalMs);

    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    };
  }, [isSosActive, incidentId, isVolunteer, isSimulatedOffline, isConnected, lastGaspSent, isDevicePoweredOff]);

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

    if (socketRef.current && socketRef.current.connected && !isSimulatedOffline) {
      socketRef.current.emit('distress:triggered', {
        userId: 'u_victim_mobile_01',
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
      if (calculatorInput === '9999' || calculatorInput === '1234') {
        setIsStealthMode(false);
        setCalculatorInput('0');
        return;
      }
      try {
        const res = Function(`'use strict'; return (${calculatorInput})`)();
        setCalculatorInput(String(res));
      } catch {
        setCalculatorInput('Error');
      }
      return;
    }

    setCalculatorInput((prev) => (prev === '0' ? btn : prev + btn));
  };

  // Render Simulated Device Powered Off Black Screen
  if (isDevicePoweredOff) {
    return (
      <SafeAreaView style={styles.poweredOffContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.poweredOffContent}>
          <Text style={styles.poweredOffEmoji}>⚡📴</Text>
          <Text style={styles.poweredOffTitle}>DEVICE POWERED OFF</Text>
          <Text style={styles.poweredOffSub}>
            Emergency SOS was active during shutdown sequence.
          </Text>
          {shutdownLastGaspNotice && (
            <View style={styles.shutdownNoticeBox}>
              <Text style={styles.shutdownNoticeTitle}>✅ PRE-SHUTDOWN LAST GASP FIRED</Text>
              <Text style={styles.shutdownNoticeText}>{shutdownLastGaspNotice}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.powerOnBtn}
            onPress={handleDevicePowerOn}
          >
            <Text style={styles.powerOnBtnText}>🔌 Power Device Back On</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Render Stealth Decoy Calculator if active
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
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>GUARDIAN EDGE</Text>
            <Text style={styles.headerSubtitle}>
              {isSosActive ? '🚨 DISTRESS STREAM ACTIVE (1/s)' : 'STANDBY MODE (1/10s)'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.stealthBtn}
            onPress={() => setIsStealthMode(true)}
          >
            <Text style={styles.stealthBtnText}>🕵️ Decoy UI</Text>
          </TouchableOpacity>
        </View>

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

        {/* Acoustic Scream ML Model Architecture Card */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardTitle}>Edge ML Scream Detector</Text>
              <Text style={styles.cardDesc}>
                Model Engine: {isModelReady ? 'Ready for Weights Drop-in' : 'Initializing...'}
              </Text>
            </View>
            <View style={[styles.modelStatusBadge, isModelReady && styles.modelStatusBadgeReady]}>
              <Text style={styles.modelStatusBadgeText}>{isModelReady ? 'MODEL LOADED' : 'UNLOADED'}</Text>
            </View>
          </View>

          {/* Live AudioWorklet Inference Analyzer */}
          <View style={styles.mlStreamBox}>
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Acoustic Stream Analysis:</Text>
              <Text style={[styles.metaValue, isMlListening ? { color: '#ef4444' } : { color: '#64748b' }]}>
                {isMlListening ? '🎙️ LISTENING (AudioWorklet)' : 'Mic Idle'}
              </Text>
            </View>

            {isMlListening && latestMlPrediction && (
              <View style={{ marginTop: 6 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.metaLabel}>Confidence Score:</Text>
                  <Text style={[styles.metaValue, latestMlPrediction.isScream ? { color: '#ef4444', fontWeight: '900' } : { color: '#06b6d4' }]}>
                    {(latestMlPrediction.confidence * 100).toFixed(1)}% ({latestMlPrediction.label})
                  </Text>
                </View>

                {/* Meter Bar */}
                <View style={styles.meterTrack}>
                  <View
                    style={[
                      styles.meterFill,
                      { width: `${latestMlPrediction.confidence * 100}%` },
                      latestMlPrediction.isScream && styles.meterFillAlert,
                    ]}
                  />
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.mlToggleBtn, isMlListening && styles.mlToggleBtnActive]}
              onPress={toggleMlListening}
            >
              <Text style={styles.mlToggleBtnText}>
                {isMlListening ? '🛑 Stop Audio Detection' : '🎙️ Activate Edge Scream Detection'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Network & Battery Resiliency Center */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Network Resiliency & Pre-Shutdown Armor</Text>
          
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
            <Text style={styles.metaLabel}>Simulate Battery:</Text>
            <TouchableOpacity style={styles.battBtn} onPress={() => setBatteryLevel(100)}>
              <Text style={styles.battBtnText}>100%</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.battBtn} onPress={() => setBatteryLevel(15)}>
              <Text style={styles.battBtnText}>15%</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.battBtn, styles.battBtnCritical]} onPress={() => setBatteryLevel(4)}>
              <Text style={styles.battBtnCriticalText}>4% (Dying)</Text>
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
          <Text style={styles.cardTitle}>Live Geospatial Telemetry</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>GPS Coordinates:</Text>
            <Text style={styles.metaValue}>{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</Text>
          </View>
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
        </View>

        {/* Simulated Edge ML Triggers */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Simulate Edge Sensor Triggers</Text>
          <View style={styles.triggerGrid}>
            <TouchableOpacity
              style={styles.triggerBtn}
              onPress={() => triggerDistress('AUDIO_SCREAM')}
            >
              <Text style={styles.triggerBtnEmoji}>🗣️</Text>
              <Text style={styles.triggerBtnText}>Acoustic Scream (YAMNet)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.triggerBtn}
              onPress={() => triggerDistress('DEVICE_SNATCH')}
            >
              <Text style={styles.triggerBtnEmoji}>📱</Text>
              <Text style={styles.triggerBtnText}>Phone Snatch Jerk</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dead Man's Switch Safety Timer */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dead Man's Switch Timer</Text>
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
});
