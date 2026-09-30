import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { PipelineTelemetry } from "../services/twoTierDistressPipeline";
import { AudioVaultState } from "../services/hardwareAudioVaultService";
import { SnatchSensitivity } from "../services/hardwareSnatchService";

export interface ShieldTabProps {
  batteryLevel: number;
  isSosActive: boolean;
  dynamicConfigNotice: string | null;
  shutdownLastGaspNotice: string | null;
  resolutionNotice: string | null;
  responderStatus: string | null;
  nearbyAlert: any | null;
  isVolunteer: boolean;
  handlePromptCancelSos: () => void;
  triggerDistress: (type: any) => void;
  coords: { lat: number; lng: number } | null;
  triggerSmsFallback: (lat: number, lng: number, batt: number) => void;
  pipelineTelemetry: PipelineTelemetry;
  onToggleVoicePipeline: () => void;
  isSnatchDetectorActive: boolean;
  onToggleSnatchDetector: () => void;
  snatchSensitivity: SnatchSensitivity;
  onSetSnatchSensitivity: (lvl: SnatchSensitivity) => void;
  audioVault: AudioVaultState;
  onStartAudioRecording: () => void;
  onStopAudioRecording: () => void;
  deadmanSeconds: number | null;
  onSetDeadmanSeconds: (sec: number | null) => void;
}

export const ShieldTab: React.FC<ShieldTabProps> = ({
  batteryLevel,
  isSosActive,
  dynamicConfigNotice,
  shutdownLastGaspNotice,
  resolutionNotice,
  responderStatus,
  nearbyAlert,
  isVolunteer,
  handlePromptCancelSos,
  triggerDistress,
  coords,
  triggerSmsFallback,
  pipelineTelemetry,
  onToggleVoicePipeline,
  isSnatchDetectorActive,
  onToggleSnatchDetector,
  snatchSensitivity,
  onSetSnatchSensitivity,
  audioVault,
  onStartAudioRecording,
  onStopAudioRecording,
  deadmanSeconds,
  onSetDeadmanSeconds,
}) => {
  return (
    <View style={styles.container}>
      {/* Critical Last Gasp Alert Banner */}
      {batteryLevel <= 5 && isSosActive && (
        <View style={styles.lastGaspBanner}>
          <Text style={styles.lastGaspTitle}>
            ⚡ CRITICAL BATTERY "LAST GASP" TRANSMISSION
          </Text>
          <Text style={styles.lastGaspSub}>
            Battery at {Math.round(batteryLevel)}%! Final GPS fix pinned & broadcasted.
          </Text>
        </View>
      )}

      {/* Dynamic Edge ML Remote Sync Banner */}
      {dynamicConfigNotice && (
        <View style={styles.dynamicConfigBanner}>
          <Text style={styles.dynamicConfigBannerTitle}>
            ⚙️ GLOBAL EDGE ML CONFIG SYNCED
          </Text>
          <Text style={styles.dynamicConfigBannerSub}>
            {dynamicConfigNotice}
          </Text>
        </View>
      )}

      {/* Pre-Shutdown Beacon Feedback Banner */}
      {shutdownLastGaspNotice && (
        <View style={styles.shutdownNoticeBanner}>
          <Text style={styles.shutdownNoticeBannerTitle}>
            🛡️ PRE-SHUTDOWN BEACON DISPATCHED
          </Text>
          <Text style={styles.shutdownNoticeBannerSub}>
            {shutdownLastGaspNotice}
          </Text>
        </View>
      )}

      {/* Incident Resolution Notice */}
      {resolutionNotice && (
        <View style={styles.resolutionBanner}>
          <Text style={styles.resolutionBannerTitle}>
            🛡️ EMERGENCY INCIDENT RESOLVED
          </Text>
          <Text style={styles.resolutionBannerSub}>
            {resolutionNotice}
          </Text>
        </View>
      )}

      {/* Dynamic Responder Alert Notification */}
      {responderStatus && isSosActive && (
        <View style={styles.responderBanner}>
          <Text style={styles.responderBannerTitle}>
            {responderStatus === "DISPATCHED"
              ? "🚑 RESCUE UNIT EN ROUTE"
              : "⚠️ DISPATCH NOTIFIED"}
          </Text>
          <Text style={styles.responderBannerSub}>
            Status: {responderStatus} • Responders alerted
          </Text>
        </View>
      )}

      {/* Nearby Alert for Volunteers */}
      {nearbyAlert && isVolunteer && (
        <View style={styles.nearbyBanner}>
          <Text style={styles.nearbyBannerTitle}>
            🚨 NEARBY DISTRESS DETECTED
          </Text>
          <Text style={styles.nearbyBannerSub}>
            {nearbyAlert.victimName || "Victim"} is within{" "}
            {nearbyAlert.distanceMeters || "250"}m!
          </Text>
        </View>
      )}

      {/* Main SOS Trigger Button */}
      <View style={styles.sosContainer}>
        <TouchableOpacity
          style={[styles.sosButton, isSosActive && styles.sosButtonActive]}
          activeOpacity={0.75}
          onPress={() =>
            isSosActive ? handlePromptCancelSos() : triggerDistress("MANUAL_SOS")
          }
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.sosText}>{isSosActive ? "CANCEL" : "SOS"}</Text>
          <Text style={styles.sosSubtext}>
            {isSosActive ? "Tap to Disarm / Resolve" : "Instant Satellite Alert"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick Emergency SMS Button */}
      <TouchableOpacity
        style={styles.emergencySmsCardBtn}
        activeOpacity={0.8}
        onPress={() => {
          if (coords) {
            triggerSmsFallback(coords.lat, coords.lng, Math.round(batteryLevel));
          } else {
            triggerSmsFallback(0, 0, Math.round(batteryLevel));
          }
        }}
      >
        <Text style={styles.emergencySmsCardIcon}>📱</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.emergencySmsCardTitle}>Fast Emergency SMS</Text>
          <Text style={styles.emergencySmsCardSub}>
            Broadcasts instant SMS with live GPS link to all registered contacts
          </Text>
        </View>
      </TouchableOpacity>

      {/* Citizen Protection Matrix */}
      <Text style={styles.sectionHeader}>Active Protection Armor</Text>

      {/* Voice Guardian Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.cardTitle}>🎙️ Voice Guardian</Text>
            <Text style={styles.cardDesc}>
              Detects screams, distress cries & "Help Me" keywords
            </Text>
          </View>
          <View
            style={[
              styles.modelStatusBadge,
              pipelineTelemetry.isPipelineActive && styles.modelStatusBadgeReady,
            ]}
          >
            <Text style={styles.modelStatusBadgeText}>
              {pipelineTelemetry.isPipelineActive ? "🟢 ARMED" : "⚪ PAUSED"}
            </Text>
          </View>
        </View>

        <View style={styles.buttonRowResponsive}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              pipelineTelemetry.isPipelineActive ? styles.actionBtnOrange : styles.actionBtnBlue,
              { flex: 1 },
            ]}
            activeOpacity={0.8}
            onPress={onToggleVoicePipeline}
          >
            <Text style={styles.actionBtnText}>
              {pipelineTelemetry.isPipelineActive ? "⏸️ Pause Voice Sentry" : "▶️ Arm Voice Sentry"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Snatch Defense Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.cardTitle}>📱 Snatch Defense</Text>
            <Text style={styles.cardDesc}>
              Triggers SOS upon violent physical device theft jerk
            </Text>
          </View>
          <View
            style={[
              styles.modelStatusBadge,
              isSnatchDetectorActive && styles.modelStatusBadgeReady,
            ]}
          >
            <Text style={styles.modelStatusBadgeText}>
              {isSnatchDetectorActive ? "🟢 20Hz ARMED" : "⚪ PAUSED"}
            </Text>
          </View>
        </View>

        <Text style={[styles.metaLabel, { marginBottom: 6 }]}>
          Theft Jerk Sensitivity:
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
                {lvl} {lvl === "LOW" ? "(4.2G)" : lvl === "MEDIUM" ? "(3.2G)" : "(2.2G)"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.buttonRowResponsive, { marginTop: 8 }]}>
          <TouchableOpacity
            style={[styles.actionBtn, { flex: 1 }]}
            activeOpacity={0.8}
            onPress={onToggleSnatchDetector}
          >
            <Text style={styles.actionBtnText}>
              {isSnatchDetectorActive ? "🛑 Pause Snatch Defense" : "▶️ Resume Snatch Defense"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 30s Audio Evidence Vault Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.cardTitle}>📁 30s Audio Evidence Vault</Text>
            <Text style={styles.cardDesc}>
              {audioVault.status === "recording"
                ? `Recording Evidence (${audioVault.remainingSeconds}s remaining)...`
                : audioVault.status === "uploading"
                  ? "Transmitting encrypted audio to secure vault..."
                  : audioVault.status === "secured"
                    ? "Evidence safely uploaded to Cloud Vault"
                    : "Captures 30s high-fidelity audio evidence upon SOS"}
            </Text>
          </View>
          <View
            style={[
              styles.modelStatusBadge,
              audioVault.status === "recording"
                ? styles.modelStatusBadgeRed
                : audioVault.status === "secured"
                  ? styles.modelStatusBadgeReady
                  : {},
            ]}
          >
            <Text
              style={[
                styles.modelStatusBadgeText,
                audioVault.status === "recording"
                  ? { color: "#f87171" }
                  : audioVault.status === "secured"
                    ? { color: "#34d399" }
                    : {},
              ]}
            >
              {audioVault.status === "recording"
                ? `🔴 REC ${audioVault.remainingSeconds}s`
                : audioVault.status === "uploading"
                  ? "UPLOADING"
                  : audioVault.status === "secured"
                    ? "SECURED"
                    : "STANDBY"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.mlToggleBtn,
            audioVault.status === "recording" && styles.mlToggleBtnActive,
          ]}
          activeOpacity={0.8}
          onPress={() => {
            if (audioVault.status === "recording") {
              onStopAudioRecording();
            } else {
              onStartAudioRecording();
            }
          }}
        >
          <Text style={styles.mlToggleBtnText}>
            {audioVault.status === "recording"
              ? "⏹️ Stop & Transmit Evidence"
              : "🎙️ Record 30s Evidence"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dead Man's Switch Timer Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⏱️ Dead Man's Switch Timer</Text>
        <Text style={styles.cardDesc}>
          Triggers automatic SOS if not checked-in before timer expires.
        </Text>
        {deadmanSeconds ? (
          <View style={styles.timerActiveRow}>
            <Text style={styles.timerCountdown}>
              ⏰ {deadmanSeconds}s Remaining
            </Text>
            <TouchableOpacity
              style={styles.timerCancelBtn}
              activeOpacity={0.8}
              onPress={() => onSetDeadmanSeconds(null)}
            >
              <Text style={styles.timerCancelText}>Disarm</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.buttonRowResponsive}>
            {[30, 60, 300].map((sec) => (
              <TouchableOpacity
                key={sec}
                style={styles.presetBtn}
                activeOpacity={0.8}
                onPress={() => onSetDeadmanSeconds(sec)}
              >
                <Text style={styles.presetBtnText}>
                  {sec >= 60 ? `${sec / 60} min` : `${sec}s`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 10,
    marginLeft: 2,
  },
  lastGaspBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "#ef4444",
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  lastGaspTitle: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  lastGaspSub: {
    color: "#fca5a5",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
  dynamicConfigBanner: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderColor: "#38bdf8",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  dynamicConfigBannerTitle: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "800",
  },
  dynamicConfigBannerSub: {
    color: "#bae6fd",
    fontSize: 11,
    marginTop: 2,
  },
  shutdownNoticeBanner: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderColor: "#a855f7",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  shutdownNoticeBannerTitle: {
    color: "#c084fc",
    fontSize: 12,
    fontWeight: "800",
  },
  shutdownNoticeBannerSub: {
    color: "#e9d5ff",
    fontSize: 11,
    marginTop: 2,
  },
  resolutionBanner: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10b981",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  resolutionBannerTitle: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: "800",
  },
  resolutionBannerSub: {
    color: "#a7f3d0",
    fontSize: 11,
    marginTop: 2,
  },
  responderBanner: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "#f59e0b",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  responderBannerTitle: {
    color: "#fbbf24",
    fontSize: 12,
    fontWeight: "800",
  },
  responderBannerSub: {
    color: "#fde68a",
    fontSize: 11,
    marginTop: 2,
  },
  nearbyBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "#ef4444",
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  nearbyBannerTitle: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "900",
  },
  nearbyBannerSub: {
    color: "#fca5a5",
    fontSize: 11,
    marginTop: 2,
  },
  sosContainer: {
    alignItems: "center",
    marginVertical: 14,
  },
  sosButton: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 22,
    elevation: 12,
    borderWidth: 5,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  sosButtonActive: {
    backgroundColor: "#10b981",
    shadowColor: "#10b981",
  },
  sosText: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 1,
  },
  sosSubtext: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  emergencySmsCardBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(56, 189, 248, 0.4)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  emergencySmsCardIcon: {
    fontSize: 26,
  },
  emergencySmsCardTitle: {
    color: "#38bdf8",
    fontSize: 15,
    fontWeight: "800",
  },
  emergencySmsCardSub: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
  },
  card: {
    backgroundColor: "#131926",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  cardTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "800",
  },
  cardDesc: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
  },
  modelStatusBadge: {
    backgroundColor: "rgba(148, 163, 184, 0.15)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.3)",
  },
  modelStatusBadgeReady: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  modelStatusBadgeRed: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  modelStatusBadgeText: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "800",
  },
  metaLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  buttonRowResponsive: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  actionBtn: {
    backgroundColor: "#1e293b",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  actionBtnBlue: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  actionBtnOrange: {
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  actionBtnText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
  },
  mlPill: {
    flex: 1,
    backgroundColor: "#0f172a",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  mlPillActive: {
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    borderColor: "#38bdf8",
  },
  mlPillText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
  },
  mlPillTextActive: {
    color: "#38bdf8",
  },
  mlToggleBtn: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(56, 189, 248, 0.4)",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  mlToggleBtnActive: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "#ef4444",
  },
  mlToggleBtnText: {
    color: "#38bdf8",
    fontSize: 13,
    fontWeight: "800",
  },
  timerActiveRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ef4444",
    marginTop: 8,
  },
  timerCountdown: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "800",
  },
  timerCancelBtn: {
    backgroundColor: "#ef4444",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  timerCancelText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  presetBtn: {
    flex: 1,
    backgroundColor: "#1e293b",
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  presetBtnText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
  },
});
