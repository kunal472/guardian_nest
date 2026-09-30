import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ShieldTab, ShieldTabProps } from '../../src/components/ShieldTab';

describe('ShieldTab Component Tests', () => {
  const defaultProps: ShieldTabProps = {
    batteryLevel: 85,
    isSosActive: false,
    dynamicConfigNotice: null,
    shutdownLastGaspNotice: null,
    resolutionNotice: null,
    responderStatus: null,
    nearbyAlert: null,
    isVolunteer: false,
    handlePromptCancelSos: jest.fn(),
    triggerDistress: jest.fn(),
    coords: { lat: 40.7128, lng: -74.006 },
    triggerSmsFallback: jest.fn(),
    pipelineTelemetry: {
      isPipelineActive: true,
      tier1Status: 'spotting',
      tier2Status: 'idle',
      yamnetConfidence: 0.1,
      targetClass: null,
      wakeWordDetected: null,
      transcript: null,
      distressIntent: null,
      verificationLatencyMs: 0,
      speakerBiometrics: null,
      ringBufferFill: 20,
      ringBufferSeconds: 1.0,
      liveAudioEnergyPercent: 12,
      liveDbfs: -50.0,
      lastEventTimestamp: null,
    },
    onToggleVoicePipeline: jest.fn(),
    isSnatchDetectorActive: true,
    onToggleSnatchDetector: jest.fn(),
    snatchSensitivity: 'MEDIUM',
    onSetSnatchSensitivity: jest.fn(),
    audioVault: {
      status: 'idle',
      elapsedSeconds: 0,
      remainingSeconds: 30,
      audioMetering: 0,
      recordingUri: null,
      uploadedUrl: null,
      errorMessage: null,
    },
    onStartAudioRecording: jest.fn(),
    onStopAudioRecording: jest.fn(),
    deadmanSeconds: null,
    onSetDeadmanSeconds: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the SOS button in standby mode and trigger distress on press', () => {
    const { getByText } = render(<ShieldTab {...defaultProps} />);

    const sosButton = getByText('SOS');
    expect(sosButton).toBeTruthy();
    expect(getByText('Instant Satellite Alert')).toBeTruthy();

    fireEvent.press(sosButton);
    expect(defaultProps.triggerDistress).toHaveBeenCalledWith('MANUAL_SOS');
  });

  it('should render CANCEL button when SOS is active and prompt cancellation', () => {
    const { getByText } = render(
      <ShieldTab {...defaultProps} isSosActive={true} />
    );

    const cancelButton = getByText('CANCEL');
    expect(cancelButton).toBeTruthy();
    expect(getByText('Tap to Disarm / Resolve')).toBeTruthy();

    fireEvent.press(cancelButton);
    expect(defaultProps.handlePromptCancelSos).toHaveBeenCalledTimes(1);
  });

  it('should invoke triggerSmsFallback when Emergency SMS button is pressed', () => {
    const { getByText } = render(<ShieldTab {...defaultProps} />);

    const smsButton = getByText('Fast Emergency SMS');
    fireEvent.press(smsButton);

    expect(defaultProps.triggerSmsFallback).toHaveBeenCalledWith(
      40.7128,
      -74.006,
      85
    );
  });

  it('should toggle Voice Guardian protection on press', () => {
    const { getByText } = render(<ShieldTab {...defaultProps} />);

    const toggleButton = getByText('⏸️ Pause Voice Sentry');
    fireEvent.press(toggleButton);

    expect(defaultProps.onToggleVoicePipeline).toHaveBeenCalledTimes(1);
  });

  it('should change snatch sensitivity levels when sensitivity pill is pressed', () => {
    const { getByText } = render(<ShieldTab {...defaultProps} />);

    const highPill = getByText(/HIGH \(2\.2G\)/);
    fireEvent.press(highPill);

    expect(defaultProps.onSetSnatchSensitivity).toHaveBeenCalledWith('HIGH');
  });

  it('should trigger audio recording start and stop in 30s Audio Evidence Vault', () => {
    const { getByText, rerender } = render(<ShieldTab {...defaultProps} />);

    const startRecordBtn = getByText('🎙️ Record 30s Evidence');
    fireEvent.press(startRecordBtn);
    expect(defaultProps.onStartAudioRecording).toHaveBeenCalledTimes(1);

    // Rerender in recording status
    rerender(
      <ShieldTab
        {...defaultProps}
        audioVault={{
          ...defaultProps.audioVault,
          status: 'recording',
          remainingSeconds: 24,
          audioMetering: 45,
        }}
      />
    );

    expect(getByText('🔴 REC 24s')).toBeTruthy();
    const stopRecordBtn = getByText('⏹️ Stop & Transmit Evidence');
    fireEvent.press(stopRecordBtn);
    expect(defaultProps.onStopAudioRecording).toHaveBeenCalledTimes(1);
  });

  it('should set Dead Man Switch countdown timer presets', () => {
    const { getByText } = render(<ShieldTab {...defaultProps} />);

    const oneMinBtn = getByText('1 min');
    fireEvent.press(oneMinBtn);

    expect(defaultProps.onSetDeadmanSeconds).toHaveBeenCalledWith(60);
  });

  it('should render active countdown and permit disarming Dead Man Switch', () => {
    const { getByText } = render(
      <ShieldTab {...defaultProps} deadmanSeconds={45} />
    );

    expect(getByText('⏰ 45s Remaining')).toBeTruthy();
    const disarmBtn = getByText('Disarm');
    fireEvent.press(disarmBtn);

    expect(defaultProps.onSetDeadmanSeconds).toHaveBeenCalledWith(null);
  });

  it('should render critical Last Gasp banner when battery <= 5% and SOS is active', () => {
    const { getByText } = render(
      <ShieldTab {...defaultProps} batteryLevel={4} isSosActive={true} />
    );

    expect(
      getByText('⚡ CRITICAL BATTERY "LAST GASP" TRANSMISSION')
    ).toBeTruthy();
    expect(getByText(/Battery at 4%!/i)).toBeTruthy();
  });

  it('should render responder dispatched notice when responderStatus is DISPATCHED', () => {
    const { getByText } = render(
      <ShieldTab
        {...defaultProps}
        isSosActive={true}
        responderStatus="DISPATCHED"
      />
    );

    expect(getByText('🚑 RESCUE UNIT EN ROUTE')).toBeTruthy();
  });
});
