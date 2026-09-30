import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DiagnosticsTab, DiagnosticsTabProps } from '../../src/components/DiagnosticsTab';

describe('DiagnosticsTab Component Tests', () => {
  const defaultProps: DiagnosticsTabProps = {
    isConnected: true,
    backendUrl: 'http://localhost:3000',
    pingCount: 42,
    pipelineTelemetry: {
      isPipelineActive: true,
      tier1Status: 'spotting',
      tier2Status: 'idle',
      yamnetConfidence: 0.75,
      targetClass: 'Scream',
      wakeWordDetected: 'Help Me',
      transcript: 'Help me emergency',
      distressIntent: 'DANGER_ESCAPE',
      verificationLatencyMs: 120,
      speakerBiometrics: {
        isMatch: true,
        similarity: 0.88,
        threshold: 0.72,
        reason: 'Authenticated Owner Voice (88%)',
        isEnrolled: true,
      },
      ringBufferFill: 60,
      ringBufferSeconds: 3.0,
      liveAudioEnergyPercent: 45,
      liveDbfs: -22.5,
      liveBiometricScore: 88,
      lastEventTimestamp: '2026-10-01T00:00:00.000Z',
      screamSensitivity: 'MEDIUM',
      screamThresholdDbfs: -15.0,
      wakeWordSensitivity: 'BALANCED',
      speechThresholdDbfs: -24.0,
    },
    speakerProfile: {
      userId: 'usr_alice',
      userName: 'Alice',
      enrolledAt: '2026-10-01T00:00:00.000Z',
      embeddingVector: [0.1, 0.2, 0.3],
      samplesCount: 3,
    },
    currentUser: {
      id: 'usr_alice',
      name: 'Alice',
      phone: '+1555000111',
      role: 'USER',
      isVolunteer: false,
      mlSensitivity: 'MEDIUM',
    },
    isCalibratingVoice: false,
    calibrationStep: 1,
    isRecordingVoiceSample: false,
    recordedSamplesCount: 0,
    enrollmentNotice: null,
    calibrationPrompts: [
      { phrase: 'Help me guardian', desc: 'Clear speaking tone' },
      { phrase: 'Emergency now', desc: 'Urgent voice' },
      { phrase: 'Save me quick', desc: 'Whispered tone' },
    ],
    onStartVoiceCalibration: jest.fn(),
    onRecordCalibrationSample: jest.fn(),
    onCancelVoiceCalibration: jest.fn(),
    onChangeBiometricThreshold: jest.fn(),
    onSetScreamSensitivity: jest.fn(),
    onSetWakeWordSensitivity: jest.fn(),
    onSimulateScream: jest.fn(),
    onSimulateWakeWordOwner: jest.fn(),
    onSimulateWakeWordBystander: jest.fn(),
    motionTelemetry: {
      magnitude: 1.05,
      deltaG: 0.05,
      x: 0.1,
      y: 0.2,
      z: 1.0,
      isSpike: false,
      sensitivity: 'MEDIUM',
    },
    isSnatchDetectorActive: true,
    onToggleSnatchDetector: jest.fn(),
    snatchSensitivity: 'MEDIUM',
    onSetSnatchSensitivity: jest.fn(),
    onSimulateSnatchJerk: jest.fn(),
    isHardwareGps: true,
    onToggleGpsMode: jest.fn(),
    coords: { lat: 40.7128, lng: -74.006 },
    locationAccuracy: 4.8,
    locationSpeed: 1.2,
    onForceGpsPoll: jest.fn(),
    isSimulatedOffline: false,
    onToggleDropNetwork: jest.fn(),
    offlineQueueLength: 0,
    lastTransmissionMethod: 'Socket.IO (Live)',
    onSimulateShutdown: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render edge ML spotters, vocal amplitude dBFS, and ring buffer telemetry', () => {
    const { getByText } = render(<DiagnosticsTab {...defaultProps} />);

    expect(getByText('Two-Tier Edge ML Distress')).toBeTruthy();
    expect(getByText('⚡ SPOTTING (16kHz)')).toBeTruthy();
    expect(getByText('-22.5 dBFS (45%)')).toBeTruthy();
    expect(getByText('Scream (75%)')).toBeTruthy();
    expect(getByText('"Help Me" Spotted')).toBeTruthy();
    expect(getByText('3.0s / 5.0s')).toBeTruthy();
  });

  it('should render test trigger simulation pills and trigger mock events', () => {
    const { getByText } = render(<DiagnosticsTab {...defaultProps} />);

    const screamPill = getByText('🗣️ Scream (YAMNet)');
    fireEvent.press(screamPill);
    expect(defaultProps.onSimulateScream).toHaveBeenCalledTimes(1);

    const ownerPill = getByText('📢 WakeWord (Owner)');
    fireEvent.press(ownerPill);
    expect(defaultProps.onSimulateWakeWordOwner).toHaveBeenCalledTimes(1);

    const bystanderPill = getByText('👤 Bystander (Reject)');
    fireEvent.press(bystanderPill);
    expect(defaultProps.onSimulateWakeWordBystander).toHaveBeenCalledTimes(1);
  });

  it('should render voice biometrics section and start voice calibration', () => {
    const { getByText } = render(<DiagnosticsTab {...defaultProps} />);

    expect(getByText(/Speaker Biometrics/i)).toBeTruthy();
    expect(getByText(/Owner: Alice/i)).toBeTruthy();

    const calibBtn = getByText('🎙️ Calibrate Voice (3 Prompts)');
    fireEvent.press(calibBtn);
    expect(defaultProps.onStartVoiceCalibration).toHaveBeenCalledTimes(1);
  });

  it('should render 3-step live voice calibration mode when active', () => {
    const { getByText } = render(
      <DiagnosticsTab
        {...defaultProps}
        isCalibratingVoice={true}
        calibrationStep={2}
        recordedSamplesCount={1}
      />
    );

    expect(getByText('🎙️ CALIBRATING PROMPT 2 OF 3')).toBeTruthy();
    expect(getByText('1/3 Recorded')).toBeTruthy();
    expect(getByText('"Emergency now"')).toBeTruthy();

    const recordBtn = getByText('🎙️ Record Sample 2');
    fireEvent.press(recordBtn);
    expect(defaultProps.onRecordCalibrationSample).toHaveBeenCalledTimes(1);
  });

  it('should render accelerometer G-force telemetry and simulate snatch jerk', () => {
    const { getByText } = render(<DiagnosticsTab {...defaultProps} />);

    expect(getByText('1.05 G')).toBeTruthy();
    expect(getByText('[0.1, 0.2, 1.0]')).toBeTruthy();

    const simSnatchBtn = getByText('📱 Simulate Snatch Jerk');
    fireEvent.press(simSnatchBtn);
    expect(defaultProps.onSimulateSnatchJerk).toHaveBeenCalledTimes(1);

    const pauseBtn = getByText('🛑 Pause');
    fireEvent.press(pauseBtn);
    expect(defaultProps.onToggleSnatchDetector).toHaveBeenCalledTimes(1);
  });

  it('should render GPS geospatial telemetry and force GPS poll', () => {
    const { getByText } = render(<DiagnosticsTab {...defaultProps} />);

    expect(getByText('40.71280, -74.00600')).toBeTruthy();
    expect(getByText('±4.8m')).toBeTruthy();
    expect(getByText('4.3 km/h')).toBeTruthy();

    const forceGpsBtn = getByText('🔄 Force GPS Poll');
    fireEvent.press(forceGpsBtn);
    expect(defaultProps.onForceGpsPoll).toHaveBeenCalledTimes(1);
  });

  it('should render network fault injection buttons and simulated OS shutdown', () => {
    const { getByText } = render(<DiagnosticsTab {...defaultProps} />);

    const dropNetBtn = getByText('❌ Drop Network');
    fireEvent.press(dropNetBtn);
    expect(defaultProps.onToggleDropNetwork).toHaveBeenCalledTimes(1);

    const shutdownBtn = getByText(
      '⚡ Simulate Sudden OS Shutdown (Pre-Shutdown Hook)'
    );
    fireEvent.press(shutdownBtn);
    expect(defaultProps.onSimulateShutdown).toHaveBeenCalledTimes(1);
  });
});
