import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { PipelineTelemetry } from "../services/twoTierDistressPipeline";
import { MotionTelemetry, SnatchSensitivity } from "../services/hardwareSnatchService";
import { speakerBiometricsService } from "../services/speakerBiometricsService";

export interface DiagnosticsTabProps {
  isConnected: boolean;
  backendUrl: string;
  pingCount: number;
  pipelineTelemetry: PipelineTelemetry;
  speakerProfile: any;
  currentUser: any;
  isCalibratingVoice: boolean;
  calibrationStep: number;
  isRecordingVoiceSample: boolean;
  recordedSamplesCount: number;
  enrollmentNotice: string | null;
  calibrationPrompts: { phrase: string; desc: string }[];
  onStartVoiceCalibration: () => void;
  onRecordCalibrationSample: () => void;
  onCancelVoiceCalibration: () => void;
  onChangeBiometricThreshold: () => void;
  onSetScreamSensitivity: (lvl: "LOUD_ONLY" | "MEDIUM" | "SENSITIVE") => void;
  onSetWakeWordSensitivity: (lvl: "STRICT" | "BALANCED" | "SENSITIVE") => void;
  onSimulateScream: () => void;
  onSimulateWakeWordOwner: () => void;
  onSimulateWakeWordBystander: () => void;
  motionTelemetry: MotionTelemetry | null;
  isSnatchDetectorActive: boolean;
  onToggleSnatchDetector: () => void;
  snatchSensitivity: SnatchSensitivity;
  onSetSnatchSensitivity: (lvl: SnatchSensitivity) => void;
  onSimulateSnatchJerk: () => void;
  isHardwareGps: boolean;
  onToggleGpsMode: () => void;
  coords: { lat: number; lng: number } | null;
  locationAccuracy: number | null;
  locationSpeed: number | null;
  onForceGpsPoll: () => void;
  isSimulatedOffline: boolean;
  onToggleDropNetwork: () => void;
  offlineQueueLength: number;
  lastTransmissionMethod: string;
  onSimulateShutdown: () => void;
}

export const DiagnosticsTab: React.FC<DiagnosticsTabProps> = ({
  isConnected,
  backendUrl,
  pingCount,
  pipelineTelemetry,
  speakerProfile,
  currentUser,
  isCalibratingVoice,
  calibrationStep,
  isRecordingVoiceSample,
  recordedSamplesCount,
  enrollmentNotice,
  calibrationPrompts,
  onStartVoiceCalibration,
  onRecordCalibrationSample,
  onCancelVoiceCalibration,
  onChangeBiometricThreshold,
  onSetScreamSensitivity,
  onSetWakeWordSensitivity,
  onSimulateScream,
  onSimulateWakeWordOwner,
  onSimulateWakeWordBystander,
  motionTelemetry,
  isSnatchDetectorActive,
  onToggleSnatchDetector,
  snatchSensitivity,
  onSetSnatchSensitivity,
  onSimulateSnatchJerk,
  isHardwareGps,
  onToggleGpsMode,
  coords,
  locationAccuracy,
  locationSpeed,
  onForceGpsPoll,
  isSimulatedOffline,
  onToggleDropNetwork,
  offlineQueueLength,
  lastTransmissionMethod,
  onSimulateShutdown,
}) => {
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Edge ML Neural Spotter & Audio Analysis */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.cardTitle}>Two-Tier Edge ML Distress</Text>
            <Text style={styles.cardDesc}>
              100% On-Device Neural Spotters & Acoustic Intelligence
            </Text>
          </View>
          <View
            style={[
              styles.modelStatusBadge,
              pipelineTelemetry.isPipelineActive && styles.modelStatusBadgeReady,
            ]}
          >
            <Text style={styles.modelStatusBadgeText}>
              {pipelineTelemetry.isPipelineActive ? "🟢 ARMED (ON-DEVICE)" : "⚪ STANDBY"}
            </Text>
          </View>
        </View>

        {/* Tier 1: Real-time Audio Spectrum & Spotters */}
        <View style={styles.subCard}>
          <View style={styles.rowBetween}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#38bdf8" }}>
              TIER 1: Always-On Neural Spotters
            </Text>
            <Text
              style={{
                fontSize: 11,
                color:
                  pipelineTelemetry.tier1Status === "spotting"
                    ? "#10b981"
                    : "#f59e0b",
                fontWeight: "700",
              }}
            >
              {pipelineTelemetry.tier1Status === "spotting"
                ? "⚡ SPOTTING (16kHz)"
                : pipelineTelemetry.tier1Status === "triggered"
                  ? "🚨 TRIGGERED"
                  : "IDLE"}
            </Text>
          </View>

          {/* Real-Time Acoustic Microphone Amplitude Meter */}
          <View style={{ marginTop: 8 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Live Vocal Amplitude (Mic):</Text>
              <Text
                style={[
                  styles.metaValue,
                  {
                    color:
                      (pipelineTelemetry.liveAudioEnergyPercent ?? 0) > 60
                        ? "#ef4444"
                        : (pipelineTelemetry.liveAudioEnergyPercent ?? 0) > 30
                          ? "#fbbf24"
                          : "#10b981",
                    fontWeight: "800",
                  },
                ]}
              >
                {(pipelineTelemetry.liveDbfs ?? -55.0).toFixed(1)} dBFS (
                {pipelineTelemetry.liveAudioEnergyPercent ?? 0}%)
              </Text>
            </View>
            <View style={styles.meterTrack}>
              <View
                style={[
                  styles.meterFill,
                  {
                    width: `${pipelineTelemetry.liveAudioEnergyPercent ?? 8}%`,
                    backgroundColor:
                      (pipelineTelemetry.liveAudioEnergyPercent ?? 0) > 60
                        ? "#ef4444"
                        : (pipelineTelemetry.liveAudioEnergyPercent ?? 0) > 30
                          ? "#fbbf24"
                          : "#10b981",
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.metaStack}>
            <Text style={styles.metaLabel}>Spotter A (YAMNet AudioSet):</Text>
            <Text
              style={[
                styles.metaValue,
                pipelineTelemetry.yamnetConfidence > 0.6
                  ? { color: "#ef4444", fontWeight: "800" }
                  : { color: "#94a3b8" },
              ]}
            >
              {pipelineTelemetry.targetClass
                ? `${pipelineTelemetry.targetClass} (${(pipelineTelemetry.yamnetConfidence * 100).toFixed(0)}%)`
                : "Scream #11 / Yell #9 / Cry #12"}
            </Text>
          </View>

          <View style={styles.metaStack}>
            <Text style={styles.metaLabel}>Spotter B (openWakeWord Zero-Key):</Text>
            <Text
              style={[
                styles.metaValue,
                pipelineTelemetry.wakeWordDetected
                  ? { color: "#a855f7", fontWeight: "800" }
                  : { color: "#94a3b8" },
              ]}
            >
              {pipelineTelemetry.wakeWordDetected
                ? `"${pipelineTelemetry.wakeWordDetected}" Spotted`
                : '"Help Me" / "Emergency" / "Hey Guardian"'}
            </Text>
          </View>

          {/* 5s Circular Audio Ring Buffer Meter */}
          <View style={{ marginTop: 8 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>5s Audio Ring Buffer:</Text>
              <Text style={[styles.metaValue, { color: "#38bdf8" }]}>
                {pipelineTelemetry.ringBufferSeconds.toFixed(1)}s / 5.0s
              </Text>
            </View>
            <View style={styles.meterTrack}>
              <View
                style={[
                  styles.meterFill,
                  {
                    width: `${pipelineTelemetry.ringBufferFill}%`,
                    backgroundColor: "#38bdf8",
                  },
                ]}
              />
            </View>
          </View>

          {/* Configurable Scream Loudness Threshold Control */}
          <View style={{ marginTop: 8 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Scream Loudness Sensitivity:</Text>
              <Text style={[styles.metaValue, { color: "#f87171", fontSize: 11 }]}>
                Floor: {pipelineTelemetry.screamThresholdDbfs ?? -15.0} dBFS
              </Text>
            </View>
            <View style={styles.buttonRowResponsive}>
              {(["LOUD_ONLY", "MEDIUM", "SENSITIVE"] as const).map((lvl) => (
                <TouchableOpacity
                  key={lvl}
                  style={[
                    styles.mlPill,
                    (pipelineTelemetry.screamSensitivity || "MEDIUM") === lvl && styles.mlPillActiveRed,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => onSetScreamSensitivity(lvl)}
                >
                  <Text
                    style={[
                      styles.mlPillText,
                      (pipelineTelemetry.screamSensitivity || "MEDIUM") === lvl && styles.mlPillTextActiveRed,
                    ]}
                  >
                    {lvl === "LOUD_ONLY" ? "LOUD (-8dB)" : lvl === "MEDIUM" ? "MED (-15dB)" : "SENSITIVE"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Configurable WakeWord Voice Sensitivity Control */}
          <View style={{ marginTop: 8 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>WakeWord Voice Sensitivity:</Text>
              <Text style={[styles.metaValue, { color: "#c084fc", fontSize: 11 }]}>
                Floor: {pipelineTelemetry.speechThresholdDbfs ?? -24.0} dBFS
              </Text>
            </View>
            <View style={styles.buttonRowResponsive}>
              {(["STRICT", "BALANCED", "SENSITIVE"] as const).map((lvl) => (
                <TouchableOpacity
                  key={lvl}
                  style={[
                    styles.mlPill,
                    (pipelineTelemetry.wakeWordSensitivity || "BALANCED") === lvl && styles.mlPillActive,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => onSetWakeWordSensitivity(lvl)}
                >
                  <Text
                    style={[
                      styles.mlPillText,
                      (pipelineTelemetry.wakeWordSensitivity || "BALANCED") === lvl && styles.mlPillTextActive,
                    ]}
                  >
                    {lvl === "STRICT" ? "STRICT (+9dB)" : lvl === "BALANCED" ? "BALANCED" : "SENSITIVE (+2.5dB)"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Speaker Biometrics & Voice Filter */}
        <View style={[styles.subCard, styles.subCardPurple]}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#d8b4fe" }}>
                👤 Speaker Biometrics (16-D Centroid)
              </Text>
              <Text style={{ fontSize: 10, color: "#c084fc", marginTop: 1 }} numberOfLines={1}>
                Owner: {speakerProfile?.userName || currentUser?.name || "Owner"}
              </Text>
            </View>
            <View style={styles.badgeSmall}>
              <Text style={styles.badgeSmallText}>
                COSINE &ge; {(speakerBiometricsService.getMatchThreshold() * 100).toFixed(0)}%
              </Text>
            </View>
          </View>

          {pipelineTelemetry.liveBiometricScore !== undefined && (
            <View style={[styles.telemetryMiniBox, { marginTop: 6 }]}>
              <View style={styles.rowBetween}>
                <Text style={{ fontSize: 10, color: "#94a3b8" }}>Live Voice Similarity:</Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color:
                      pipelineTelemetry.liveBiometricScore >=
                      speakerBiometricsService.getMatchThreshold() * 100
                        ? "#34d399"
                        : "#cbd5e1",
                  }}
                >
                  {pipelineTelemetry.liveBiometricScore.toFixed(0)}% Match
                </Text>
              </View>
              <View style={[styles.meterTrack, { marginTop: 4 }]}>
                <View
                  style={[
                    styles.meterFill,
                    {
                      width: `${Math.min(100, Math.max(0, pipelineTelemetry.liveBiometricScore))}%`,
                      backgroundColor:
                        pipelineTelemetry.liveBiometricScore >=
                        speakerBiometricsService.getMatchThreshold() * 100
                          ? "#34d399"
                          : "#a855f7",
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {pipelineTelemetry.speakerBiometrics && (
            <View style={styles.telemetryMiniBox}>
              <Text style={{ fontSize: 10, color: "#94a3b8" }}>Latest Voice Check:</Text>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: pipelineTelemetry.speakerBiometrics.isMatch
                    ? "#34d399"
                    : "#f87171",
                }}
              >
                {pipelineTelemetry.speakerBiometrics.reason}
              </Text>
            </View>
          )}

          {enrollmentNotice && (
            <View style={styles.noticeMiniBox}>
              <Text style={styles.noticeMiniText}>✨ {enrollmentNotice}</Text>
            </View>
          )}

          {/* Interactive 3-Step Live Voice Calibration Card */}
          {isCalibratingVoice ? (
            <View
              style={{
                backgroundColor: "rgba(147, 51, 234, 0.15)",
                borderRadius: 8,
                padding: 10,
                marginTop: 8,
                borderWidth: 1,
                borderColor: "#a855f7",
              }}
            >
              <View style={styles.rowBetween}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#f3e8ff" }}>
                  🎙️ CALIBRATING PROMPT {calibrationStep} OF 3
                </Text>
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#c084fc" }}>
                  {recordedSamplesCount}/3 Recorded
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: "rgba(0,0,0,0.3)",
                  padding: 8,
                  borderRadius: 6,
                  marginVertical: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "900",
                    color: "#38bdf8",
                    textAlign: "center",
                  }}
                >
                  "{calibrationPrompts[calibrationStep - 1]?.phrase}"
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: "#94a3b8",
                    textAlign: "center",
                    marginTop: 2,
                  }}
                >
                  {calibrationPrompts[calibrationStep - 1]?.desc}
                </Text>
              </View>

              {isRecordingVoiceSample && (
                <View style={{ marginBottom: 6 }}>
                  <Text
                    style={{
                      fontSize: 10,
                      color: "#ef4444",
                      fontWeight: "700",
                      textAlign: "center",
                    }}
                  >
                    🔴 Capturing 1.5s Audio Spectrum via Microphone...
                  </Text>
                  <View style={styles.meterTrack}>
                    <View
                      style={[
                        styles.meterFill,
                        { width: "100%", backgroundColor: "#ef4444" },
                      ]}
                    />
                  </View>
                </View>
              )}

              <View style={styles.buttonRowResponsive}>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.actionBtnPurple,
                    { flex: 1.5 },
                    isRecordingVoiceSample && { opacity: 0.6 },
                  ]}
                  activeOpacity={0.8}
                  disabled={isRecordingVoiceSample}
                  onPress={onRecordCalibrationSample}
                >
                  <Text style={styles.actionBtnText}>
                    {isRecordingVoiceSample
                      ? "🎙️ Recording..."
                      : `🎙️ Record Sample ${calibrationStep}`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { flex: 0.8 }]}
                  activeOpacity={0.8}
                  disabled={isRecordingVoiceSample}
                  onPress={onCancelVoiceCalibration}
                >
                  <Text style={[styles.actionBtnText, { color: "#94a3b8" }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.buttonRowResponsive}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPurple, { flex: 1.4 }]}
                activeOpacity={0.8}
                onPress={onStartVoiceCalibration}
              >
                <Text style={styles.actionBtnText}>
                  🎙️ Calibrate Voice (3 Prompts)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1 }]}
                activeOpacity={0.8}
                onPress={onChangeBiometricThreshold}
              >
                <Text style={styles.actionBtnText}>
                  ⚙️ {(speakerBiometricsService.getMatchThreshold() * 100).toFixed(0)}% Match
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Tier 2: Heavy Whisper Verification & NLP Intent */}
        <View style={[styles.subCard, styles.subCardRed]}>
          <View style={styles.rowBetween}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#f87171" }}>
              TIER 2: Whisper ASR + NLP Intent
            </Text>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                color:
                  pipelineTelemetry.tier2Status === "escalated"
                    ? "#ef4444"
                    : pipelineTelemetry.tier2Status === "transcribing"
                      ? "#38bdf8"
                      : "#64748b",
              }}
            >
              {pipelineTelemetry.tier2Status === "transcribing"
                ? "🎙️ TRANSCRIBING"
                : pipelineTelemetry.tier2Status === "intent_verifying"
                  ? "🧠 VERIFYING"
                  : pipelineTelemetry.tier2Status === "escalated"
                    ? "🚨 ESCALATED"
                    : pipelineTelemetry.tier2Status === "rejected"
                      ? "❌ REJECTED"
                      : "STANDBY"}
            </Text>
          </View>

          {pipelineTelemetry.transcript && (
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptText}>
                "{pipelineTelemetry.transcript}"
              </Text>
              {pipelineTelemetry.distressIntent && (
                <View style={styles.intentRow}>
                  <Text style={styles.intentTag}>
                    INTENT: [{pipelineTelemetry.distressIntent}]
                  </Text>
                  <Text style={styles.intentLatency}>
                    • {pipelineTelemetry.verificationLatencyMs}ms
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Test Trigger Simulations */}
        <View style={{ marginTop: 10 }}>
          <Text style={[styles.metaLabel, { marginBottom: 6 }]}>
            Simulate Test Triggers:
          </Text>
          <View style={styles.buttonWrapRow}>
            <TouchableOpacity
              style={[styles.simPill, styles.simPillRed]}
              activeOpacity={0.8}
              onPress={onSimulateScream}
            >
              <Text style={[styles.simPillText, { color: "#fca5a5" }]}>
                🗣️ Scream (YAMNet)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.simPill, styles.simPillPurple]}
              activeOpacity={0.8}
              onPress={onSimulateWakeWordOwner}
            >
              <Text style={[styles.simPillText, { color: "#d8b4fe" }]}>
                📢 WakeWord (Owner)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.simPill, styles.simPillGray]}
              activeOpacity={0.8}
              onPress={onSimulateWakeWordBystander}
            >
              <Text style={[styles.simPillText, { color: "#cbd5e1" }]}>
                👤 Bystander (Reject)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Device Snatch Accelerometer Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Device Snatch Accelerometer G-Forces</Text>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: isSnatchDetectorActive ? "#10b981" : "#64748b",
            }}
          >
            {isSnatchDetectorActive ? "⚡ 20 Hz ACTIVE" : "PAUSED"}
          </Text>
        </View>

        {motionTelemetry && (
          <View style={{ marginTop: 6, marginBottom: 8 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>G-Force Magnitude:</Text>
              <Text
                style={[
                  styles.metaValue,
                  motionTelemetry.isSpike
                    ? { color: "#ef4444", fontWeight: "900" }
                    : { color: "#38bdf8" },
                ]}
              >
                {motionTelemetry.magnitude.toFixed(2)} G{" "}
                {motionTelemetry.isSpike ? "💥 SPIKE!" : ""}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Vector [X, Y, Z]:</Text>
              <Text style={[styles.metaValue, { fontSize: 11 }]}>
                [{motionTelemetry.x.toFixed(1)}, {motionTelemetry.y.toFixed(1)},{" "}
                {motionTelemetry.z.toFixed(1)}]
              </Text>
            </View>

            <View style={styles.meterTrack}>
              <View
                style={[
                  styles.meterFill,
                  {
                    width: `${Math.min(100, (motionTelemetry.magnitude / 5.0) * 100)}%`,
                  },
                  motionTelemetry.isSpike && styles.meterFillAlert,
                ]}
              />
            </View>
          </View>
        )}

        <Text style={[styles.metaLabel, { marginBottom: 6 }]}>
          Snatch Sensitivity:
        </Text>
        <View style={styles.buttonRowResponsive}>
          {(["LOW", "MEDIUM", "HIGH"] as const).map((lvl) => (
            <TouchableOpacity
              key={lvl}
              style={[
                styles.mlPill,
                snatchSensitivity === lvl && styles.mlPillActive,
              ]}
              activeOpacity={0.8}
              onPress={() => onSetSnatchSensitivity(lvl)}
            >
              <Text
                style={[
                  styles.mlPillText,
                  snatchSensitivity === lvl && styles.mlPillTextActive,
                ]}
              >
                {lvl}{" "}
                {lvl === "LOW"
                  ? "(4.2G)"
                  : lvl === "MEDIUM"
                    ? "(3.2G)"
                    : "(2.2G)"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.buttonRowResponsive, { marginTop: 10 }]}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnRed, { flex: 1 }]}
            activeOpacity={0.8}
            onPress={onSimulateSnatchJerk}
          >
            <Text style={[styles.actionBtnText, { color: "#fda4af" }]}>
              📱 Simulate Snatch Jerk
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { flex: 1 }]}
            activeOpacity={0.8}
            onPress={onToggleSnatchDetector}
          >
            <Text style={styles.actionBtnText}>
              {isSnatchDetectorActive ? "🛑 Pause" : "▶️ Resume"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Live GPS Telemetry Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Live Geospatial GPS Telemetry</Text>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: isHardwareGps ? "#10b981" : "#f59e0b",
            }}
          >
            {isHardwareGps ? "🛰️ HARDWARE GPS" : "🎮 SIMULATED"}
          </Text>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.metaLabel}>Coordinates:</Text>
          <Text style={styles.metaValue}>
            {coords && (coords.lat !== 0 || coords.lng !== 0)
              ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
              : "🛰️ Acquiring GPS..."}
          </Text>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.metaLabel}>Accuracy:</Text>
          <Text
            style={[
              styles.metaValue,
              {
                color:
                  locationAccuracy && locationAccuracy < 10
                    ? "#10b981"
                    : "#38bdf8",
              },
            ]}
          >
            {locationAccuracy ? `±${locationAccuracy.toFixed(1)}m` : "Fixing..."}
          </Text>
        </View>

        {locationSpeed !== null && locationSpeed !== undefined && (
          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Speed:</Text>
            <Text style={styles.metaValue}>
              {(locationSpeed * 3.6).toFixed(1)} km/h
            </Text>
          </View>
        )}

        <View style={styles.rowBetween}>
          <Text style={styles.metaLabel}>Streamed Pings:</Text>
          <Text style={styles.metaValue}>{pingCount} updates</Text>
        </View>

        <View style={styles.buttonRowResponsive}>
          <TouchableOpacity
            style={[styles.actionBtn, { flex: 1 }]}
            activeOpacity={0.8}
            onPress={onForceGpsPoll}
          >
            <Text style={styles.actionBtnText}>🔄 Force GPS Poll</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPurple, { flex: 1.2 }]}
            activeOpacity={0.8}
            onPress={onToggleGpsMode}
          >
            <Text style={[styles.actionBtnText, { color: "#d8b4fe" }]}>
              {isHardwareGps ? "Switch to Sim GPS" : "Switch to Real GPS"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Network Fault Injection & Resiliency Testing */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Network Resiliency & Fault Injection</Text>

        <View style={styles.metaStack}>
          <Text style={styles.metaLabel}>Transmission Pipeline:</Text>
          <Text style={styles.metaValue} numberOfLines={1}>
            {lastTransmissionMethod}
          </Text>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.metaLabel}>Offline Queue Buffer:</Text>
          <Text
            style={[
              styles.metaValue,
              offlineQueueLength > 0 ? { color: "#f97316" } : {},
            ]}
          >
            {offlineQueueLength} Pings Buffered
          </Text>
        </View>

        <View style={styles.buttonRowResponsive}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              isSimulatedOffline && styles.actionBtnRed,
              { flex: 1 },
            ]}
            activeOpacity={0.8}
            onPress={onToggleDropNetwork}
          >
            <Text style={styles.actionBtnText}>
              {isSimulatedOffline ? "📶 Reconnect Network" : "❌ Drop Network"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.shutdownSimBtn}
          activeOpacity={0.8}
          onPress={onSimulateShutdown}
        >
          <Text style={styles.shutdownSimBtnText}>
            ⚡ Simulate Sudden OS Shutdown (Pre-Shutdown Hook)
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 36,
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
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnPurple: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderColor: "rgba(168, 85, 247, 0.4)",
  },
  actionBtnRed: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  actionBtnText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
  },
  mlPill: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
  },
  mlPillActive: {
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    borderColor: "#38bdf8",
  },
  mlPillActiveRed: {
    backgroundColor: "rgba(239, 68, 68, 0.25)",
    borderColor: "#ef4444",
  },
  mlPillText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
  },
  mlPillTextActive: {
    color: "#38bdf8",
  },
  mlPillTextActiveRed: {
    color: "#fca5a5",
  },
  simPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  simPillRed: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  simPillPurple: {
    backgroundColor: "rgba(168, 85, 247, 0.12)",
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  simPillGray: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  simPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  telemetryMiniBox: {
    marginTop: 6,
    padding: 6,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderRadius: 6,
  },
  noticeMiniBox: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    padding: 6,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  noticeMiniText: {
    color: "#34d399",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  transcriptBox: {
    marginTop: 6,
    padding: 8,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 6,
  },
  transcriptText: {
    color: "#fca5a5",
    fontSize: 11,
    fontStyle: "italic",
  },
  intentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  intentTag: {
    color: "#ef4444",
    fontSize: 10,
    fontWeight: "900",
  },
  intentLatency: {
    color: "#94a3b8",
    fontSize: 10,
  },
  shutdownSimBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    alignItems: "center",
  },
  shutdownSimBtnText: {
    color: "#fca5a5",
    fontSize: 12,
    fontWeight: "700",
  },
});
