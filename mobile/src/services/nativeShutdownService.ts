import { AppState, AppStateStatus, Platform } from 'react-native';
import { emergencySmsService, EmergencySmsPayload } from './emergencySmsService';

export interface PreShutdownBeaconData {
  incidentId: string;
  lat: number;
  lng: number;
  batteryLevel: number;
  reason: string;
  timestamp: string;
  emergencyContacts?: string[];
  userName?: string;
}

export type ShutdownBeaconCallback = (beacon: PreShutdownBeaconData) => void;

const SHUTDOWN_BEACON_STORAGE_KEY = 'guardian_last_shutdown_beacon';

class NativeShutdownService {
  private appStateSubscription: any = null;
  private isListening: boolean = false;
  private lastKnownLocation: { lat: number; lng: number; battery: number } = {
    lat: 40.7128,
    lng: -74.006,
    battery: 100,
  };
  private activeIncidentId: string | null = null;
  private emergencyContacts: string[] = [];
  private userName: string = 'Citizen User';
  private onBeaconDispatched: ShutdownBeaconCallback | null = null;

  /**
   * Update latest telemetry snapshot for instantaneous pre-shutdown serializations
   */
  public updateTelemetry(
    lat: number,
    lng: number,
    battery: number,
    incidentId?: string | null,
    contacts?: string[],
    name?: string,
  ): void {
    this.lastKnownLocation = { lat, lng, battery };
    if (incidentId !== undefined) this.activeIncidentId = incidentId;
    if (contacts) this.emergencyContacts = contacts;
    if (name) this.userName = name;
  }

  /**
   * Start native AppState and Web beforeunload/pagehide pre-shutdown listeners
   */
  public startListening(callback?: ShutdownBeaconCallback): void {
    if (this.isListening) return;
    this.isListening = true;
    if (callback) this.onBeaconDispatched = callback;

    // 1. React Native AppState listener
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    // 2. Web browser page lifecycle listeners
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleWebPageExit);
      window.addEventListener('pagehide', this.handleWebPageExit);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  /**
   * Stop lifecycle listeners
   */
  public stopListening(): void {
    this.isListening = false;
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleWebPageExit);
      window.removeEventListener('pagehide', this.handleWebPageExit);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private handleAppStateChange = (nextState: AppStateStatus): void => {
    if (nextState === 'inactive' || nextState === 'background') {
      if (this.activeIncidentId) {
        this.dispatchPreShutdownBeacon('APP_STATE_BACKGROUND_SUSPEND');
      }
    }
  };

  private handleWebPageExit = (): void => {
    if (this.activeIncidentId) {
      this.dispatchPreShutdownBeacon('BROWSER_TAB_EXIT_OR_CLOSE');
    }
  };

  private handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      if (this.activeIncidentId) {
        this.dispatchPreShutdownBeacon('DOCUMENT_VISIBILITY_HIDDEN');
      }
    }
  };

  /**
   * Dispatch synchronous Pre-Shutdown Last Gasp Beacon
   */
  public dispatchPreShutdownBeacon(
    reason: string = 'OS_TERMINATION',
    backendUrl: string = 'http://10.44.176.208:3000',
  ): PreShutdownBeaconData {
    const payload: PreShutdownBeaconData = {
      incidentId: this.activeIncidentId || 'inc_preshutdown_lastgasp',
      lat: this.lastKnownLocation.lat,
      lng: this.lastKnownLocation.lng,
      batteryLevel: Math.round(this.lastKnownLocation.battery),
      reason,
      timestamp: new Date().toISOString(),
      emergencyContacts: this.emergencyContacts,
      userName: this.userName,
    };

    console.warn(`[NATIVE PRE-SHUTDOWN] Emitting synchronous Last Gasp beacon (${reason})...`, payload);

    // 1. Save to local storage for persistent crash/reboot forensics
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SHUTDOWN_BEACON_STORAGE_KEY, JSON.stringify(payload));
      }
    } catch {
      // Fallback
    }

    // 2. High-priority browser beacon (if on Web)
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const endpoint = `${backendUrl}/api/incidents/${payload.incidentId}/location`;
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
    } else {
      // 3. Keepalive HTTP fetch fallback
      try {
        fetch(`${backendUrl}/api/incidents/${payload.incidentId}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: payload.lat,
            lng: payload.lng,
            batteryLevel: payload.batteryLevel,
            isLastGasp: true,
            reason: payload.reason,
          }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        // Fallback
      }
    }

    // 4. Auto-trigger Emergency SMS if power is critical (<= 5%)
    if (payload.batteryLevel <= 5) {
      emergencySmsService.dispatchEmergencySms({
        lat: payload.lat,
        lng: payload.lng,
        batteryLevel: payload.batteryLevel,
        incidentId: payload.incidentId,
        userName: payload.userName,
        reason: 'CRITICAL BATTERY DEPLETION',
        recipients: payload.emergencyContacts,
      });
    }

    if (this.onBeaconDispatched) {
      this.onBeaconDispatched(payload);
    }

    return payload;
  }

  /**
   * Get last recorded shutdown beacon
   */
  public getLastRecordedBeacon(): PreShutdownBeaconData | null {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(SHUTDOWN_BEACON_STORAGE_KEY);
        if (stored) return JSON.parse(stored);
      }
    } catch {
      // Fallback
    }
    return null;
  }

  public clearLastRecordedBeacon(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SHUTDOWN_BEACON_STORAGE_KEY);
      }
    } catch {
      // Fallback
    }
  }
}

export const nativeShutdownService = new NativeShutdownService();
