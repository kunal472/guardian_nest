import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

export interface EmergencyNotificationPayload {
  incidentId: string;
  victimName: string;
  victimPhone: string;
  triggerType: string;
  lat: number;
  lng: number;
  batteryLevel?: number;
  recipients: Array<{ name: string; phone: string }>;
  reason?: string;
}

export interface SmsDispatchResult {
  recipient: string;
  contactName: string;
  success: boolean;
  mode: 'TWILIO_LIVE' | 'DEV_AUDIT_LOG' | 'THROTTLED';
  messageSid?: string;
  error?: string;
  timestamp: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private twilioAccountSid: string | null = null;
  private twilioAuthToken: string | null = null;
  private twilioPhoneNumber: string | null = null;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    this.twilioAccountSid =
      this.configService.get<string>('TWILIO_ACCOUNT_SID') || process.env.TWILIO_ACCOUNT_SID || null;
    this.twilioAuthToken =
      this.configService.get<string>('TWILIO_AUTH_TOKEN') || process.env.TWILIO_AUTH_TOKEN || null;
    this.twilioPhoneNumber =
      this.configService.get<string>('TWILIO_PHONE_NUMBER') || process.env.TWILIO_PHONE_NUMBER || null;

    if (this.isTwilioConfigured()) {
      this.logger.log('📱 Telephony SMS Gateway initialized with Twilio live provider credentials.');
    } else {
      this.logger.log('📱 Telephony SMS Gateway initialized in DEV-AUDIT mode (Zero cost, structured logging active).');
    }
  }

  public isTwilioConfigured(): boolean {
    return Boolean(this.twilioAccountSid && this.twilioAuthToken && this.twilioPhoneNumber);
  }

  /**
   * Format standard emergency text message with live Google Maps coordinate pin
   */
  public formatDistressMessage(payload: EmergencyNotificationPayload, contactName: string): string {
    const batt = payload.batteryLevel !== undefined ? Math.round(payload.batteryLevel) : 100;
    const cleanTrigger = payload.triggerType.replace(/_/g, ' ');
    const mapUrl = `https://maps.google.com/?q=${payload.lat.toFixed(5)},${payload.lng.toFixed(5)}`;

    return (
      `🚨 GUARDIAN EMERGENCY ALERT (Ref #${payload.incidentId.slice(0, 8)}):\n` +
      `Hello ${contactName}, ${payload.victimName} (${payload.victimPhone}) triggered an urgent SOS distress signal!\n\n` +
      `• Origin: ${cleanTrigger}\n` +
      `• Battery Level: ${batt}%\n` +
      `• Time: ${new Date().toLocaleTimeString()}\n\n` +
      `📍 Live GPS Coordinates:\n${mapUrl}`
    );
  }

  /**
   * Dispatch automated SMS alerts to all registered emergency contacts
   */
  public async dispatchEmergencyAlert(
    payload: EmergencyNotificationPayload,
  ): Promise<SmsDispatchResult[]> {
    const results: SmsDispatchResult[] = [];
    const timestamp = new Date().toISOString();

    if (!payload.recipients || payload.recipients.length === 0) {
      this.logger.warn(`[SMS Service] No emergency contacts registered for incident #${payload.incidentId}`);
      return results;
    }

    this.logger.warn(
      `🚨 [SERVER-SIDE SMS DISPATCH] Triggered for ${payload.victimName} (${payload.recipients.length} emergency contacts)`,
    );

    for (const recipient of payload.recipients) {
      const cleanPhone = recipient.phone.trim();
      if (!cleanPhone) continue;

      const cooldownKey = `sms:cooldown:${payload.incidentId}:${cleanPhone}`;
      const isThrottled = await this.redisService.get(cooldownKey);

      if (isThrottled) {
        this.logger.log(`⏳ SMS throttled for ${recipient.name} (${cleanPhone}) - Cooldown active (60s).`);
        results.push({
          recipient: cleanPhone,
          contactName: recipient.name,
          success: true,
          mode: 'THROTTLED',
          timestamp,
        });
        continue;
      }

      const messageText = this.formatDistressMessage(payload, recipient.name);

      if (this.isTwilioConfigured()) {
        const sendRes = await this.sendTwilioSms(cleanPhone, messageText);
        results.push({
          recipient: cleanPhone,
          contactName: recipient.name,
          success: sendRes.success,
          mode: 'TWILIO_LIVE',
          messageSid: sendRes.sid,
          error: sendRes.error,
          timestamp,
        });
      } else {
        // Dev-Audit Mode: Log formatted payload to server console & audit log
        this.logger.warn(`\n================== [TELEPHONY SMS AUDIT DISPATCH] ==================`);
        this.logger.warn(`To: ${recipient.name} <${cleanPhone}>`);
        this.logger.warn(`From: GUARDIAN_DISPATCH_CLOUD <${this.twilioPhoneNumber || '+18885550199'}>`);
        this.logger.warn(`Payload Body:\n${messageText}`);
        this.logger.warn(`===================================================================\n`);

        results.push({
          recipient: cleanPhone,
          contactName: recipient.name,
          success: true,
          mode: 'DEV_AUDIT_LOG',
          messageSid: `audit_msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          timestamp,
        });
      }

      // Set 60-second rate-limit cooldown per contact
      await this.redisService.set(cooldownKey, '1', 60);
    }

    return results;
  }

  /**
   * Direct REST call to Twilio Messages API (Zero heavy SDK dependencies)
   */
  private async sendTwilioSms(
    toPhone: string,
    body: string,
  ): Promise<{ success: boolean; sid?: string; error?: string }> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`;
      const authHeader = `Basic ${Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString('base64')}`;

      const formData = new URLSearchParams();
      formData.append('To', toPhone);
      formData.append('From', this.twilioPhoneNumber!);
      formData.append('Body', body);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const json = await response.json();
      if (response.ok) {
        this.logger.log(`✅ Live SMS successfully dispatched to ${toPhone} (SID: ${json.sid})`);
        return { success: true, sid: json.sid };
      } else {
        this.logger.error(`❌ Twilio SMS delivery failed to ${toPhone}: ${json.message}`);
        return { success: false, error: json.message };
      }
    } catch (err: any) {
      this.logger.error(`❌ Twilio network error sending to ${toPhone}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
