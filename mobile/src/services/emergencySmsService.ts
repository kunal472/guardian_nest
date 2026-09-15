import { Linking, Platform } from 'react-native';

export interface EmergencySmsPayload {
  recipients?: string[];
  lat: number;
  lng: number;
  batteryLevel: number;
  incidentId?: string;
  userName?: string;
  reason?: string;
}

export interface SmsDispatchResult {
  success: boolean;
  uri: string;
  formattedBody: string;
  timestamp: string;
  error?: string;
}

class EmergencySmsService {
  /**
   * Compose standard emergency distress message body with Google Maps coordinates pin
   */
  public formatEmergencyMessage(payload: EmergencySmsPayload): string {
    const victim = payload.userName || 'Citizen User';
    const incId = payload.incidentId || 'CRITICAL_SOS';
    const batt = Math.round(payload.batteryLevel);
    const reasonText = payload.reason ? ` (${payload.reason})` : '';

    return (
      `🚨 GUARDIAN EMERGENCY ALERT${reasonText}: ${victim} triggered distress! ` +
      `Battery: ${batt}%. ` +
      `Live GPS Map: https://maps.google.com/?q=${payload.lat.toFixed(5)},${payload.lng.toFixed(5)} ` +
      `| Ref #${incId}`
    );
  }

  /**
   * Build cross-platform sms: URI scheme
   * iOS syntax: sms:123456789&body=text or sms:&body=text
   * Android syntax: sms:123456789?body=text
   */
  public buildSmsUri(recipients: string[] | undefined, body: string): string {
    const encodedBody = encodeURIComponent(body);
    const recipientList = recipients && recipients.length > 0 ? recipients.join(',') : '';

    if (Platform.OS === 'ios') {
      return recipientList
        ? `sms:${recipientList}&body=${encodedBody}`
        : `sms:&body=${encodedBody}`;
    }

    // Android & Web standard
    return recipientList
      ? `sms:${recipientList}?body=${encodedBody}`
      : `sms:?body=${encodedBody}`;
  }

  /**
   * Launch native device SMS application with pre-populated emergency dispatch text
   */
  public async dispatchEmergencySms(payload: EmergencySmsPayload): Promise<SmsDispatchResult> {
    const body = this.formatEmergencyMessage(payload);
    const uri = this.buildSmsUri(payload.recipients, body);
    const timestamp = new Date().toISOString();

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // On web, attempt to open the SMS protocol link or fallback to window.open
        window.open(uri, '_blank');
        return {
          success: true,
          uri,
          formattedBody: body,
          timestamp,
        };
      }

      const supported = await Linking.canOpenURL(uri).catch(() => true);
      if (supported) {
        await Linking.openURL(uri);
        return {
          success: true,
          uri,
          formattedBody: body,
          timestamp,
        };
      } else {
        throw new Error('Device does not support SMS deep-link intent');
      }
    } catch (err: any) {
      console.warn('[EmergencySmsService] SMS dispatch warning:', err?.message);
      return {
        success: false,
        uri,
        formattedBody: body,
        timestamp,
        error: err?.message || 'Failed to open SMS application',
      };
    }
  }
}

export const emergencySmsService = new EmergencySmsService();
