import { emergencySmsService, EmergencySmsPayload } from '../../src/services/emergencySmsService';
import { Linking, Platform } from 'react-native';

describe('EmergencySmsService Unit Tests', () => {
  const mockPayload: EmergencySmsPayload = {
    recipients: ['+1555019999', '+1555018888'],
    lat: 40.7128,
    lng: -74.006,
    batteryLevel: 85,
    incidentId: 'inc_test_123',
    userName: 'Jane Victim',
    reason: 'AUDIO_SCREAM',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should format emergency distress SMS text with coordinates and battery info', () => {
    const formatted = emergencySmsService.formatEmergencyMessage(mockPayload);
    expect(formatted).toContain('Jane Victim');
    expect(formatted).toContain('Battery: 85%');
    expect(formatted).toContain('https://maps.google.com/?q=40.71280,-74.00600');
    expect(formatted).toContain('inc_test_123');
    expect(formatted).toContain('AUDIO_SCREAM');
  });

  it('should format emergency distress SMS text with default fallbacks when payload fields are missing', () => {
    const fallbackPayload: EmergencySmsPayload = {
      lat: 40.7128,
      lng: -74.006,
      batteryLevel: 90,
    };
    const formatted = emergencySmsService.formatEmergencyMessage(fallbackPayload);
    expect(formatted).toContain('Citizen User');
    expect(formatted).toContain('CRITICAL_SOS');
  });

  it('should construct valid sms: URI scheme with encoded recipients and body', () => {
    const uri = emergencySmsService.buildSmsUri(['+1555019999'], 'Help me!');
    expect(uri).toContain('sms:+1555019999');
    expect(uri).toContain(encodeURIComponent('Help me!'));
  });

  it('should construct valid sms: URI scheme with empty recipients list', () => {
    const uri = emergencySmsService.buildSmsUri(undefined, 'Help me!');
    expect(uri).toContain('sms:');
    expect(uri).toContain(encodeURIComponent('Help me!'));
  });

  it('should construct valid Android and iOS sms: URI schemes', () => {
    const originalOS = Platform.OS;
    Platform.OS = 'android';
    const androidUri = emergencySmsService.buildSmsUri(['+1555019999'], 'Help me!');
    expect(androidUri).toContain('sms:+1555019999?body=');

    Platform.OS = 'ios';
    const iosUri = emergencySmsService.buildSmsUri(['+1555019999'], 'Help me!');
    expect(iosUri).toContain('sms:+1555019999&body=');
    Platform.OS = originalOS;
  });

  it('should dispatch emergency SMS via Linking.openURL when supported', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValueOnce(true);
    jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined as any);

    const result = await emergencySmsService.dispatchEmergencySms(mockPayload);

    expect(result.success).toBe(true);
    expect(result.uri).toContain('sms:');
    expect(Linking.openURL).toHaveBeenCalled();
  });

  it('should handle dispatch failure gracefully', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValueOnce(false);

    const result = await emergencySmsService.dispatchEmergencySms(mockPayload);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
