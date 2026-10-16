import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { normalizeBackendUrl } from "../services/authService";

export interface ServerConfigModalProps {
  visible: boolean;
  currentUrl: string;
  isConnected?: boolean;
  pingCount?: number;
  onClose: () => void;
  onApply: (newUrl: string) => void;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
  visible,
  currentUrl,
  isConnected = false,
  pingCount = 0,
  onClose,
  onApply,
}) => {
  const [inputUrl, setInputUrl] = useState<string>(currentUrl);
  const [isTestingPing, setIsTestingPing] = useState<boolean>(false);
  const [pingResult, setPingResult] = useState<{
    ok: boolean;
    msg: string;
    latencyMs?: number;
  } | null>(null);

  useEffect(() => {
    if (visible) {
      setInputUrl(currentUrl);
      setPingResult(null);
    }
  }, [visible, currentUrl]);

  const normalizedPreview = normalizeBackendUrl(inputUrl || currentUrl);

  const testPing = async (target?: string) => {
    const urlToTest = normalizeBackendUrl(target || inputUrl || currentUrl);
    setInputUrl(urlToTest);
    setIsTestingPing(true);
    setPingResult(null);

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${urlToTest}/api/incidents`, {
        method: "GET",
        signal: controller.signal,
      }).catch((e) => {
        throw new Error(e?.message || "Connection refused");
      });
      clearTimeout(timeout);
      const latency = Date.now() - startTime;
      setPingResult({
        ok: true,
        msg: `HTTP ${res.status} OK`,
        latencyMs: latency,
      });
    } catch (err: any) {
      setPingResult({
        ok: false,
        msg: err?.message || "Server unreachable. Check Wi-Fi & IP.",
      });
    } finally {
      setIsTestingPing(false);
    }
  };

  const handleSave = () => {
    const finalUrl = normalizeBackendUrl(inputUrl || currentUrl);
    onApply(finalUrl);
    onClose();
  };

  const PRESETS = [
    { label: "📶 Host Wi-Fi", url: "http://10.122.65.208:3000" },
    { label: "🤖 Android Emul", url: "http://10.0.2.2:3000" },
    { label: "💻 Localhost", url: "http://localhost:3000" },
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContainer}
          >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>📡 Backend Server IP</Text>
              <Text style={styles.modalSubtitle}>
                Connect mobile sensors & SOS stream to Guardian Nest backend
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeIconBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeIconText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Current Live Status Card */}
          <View style={styles.statusCard}>
            <View style={styles.statusDotRow}>
              <View
                style={[
                  styles.statusDot,
                  isConnected ? styles.statusDotGreen : styles.statusDotRed,
                ]}
              />
              <Text
                style={[
                  styles.statusStatusText,
                  { color: isConnected ? "#4ade80" : "#f87171" },
                ]}
              >
                {isConnected ? "GATEWAY CONNECTED" : "GATEWAY OFFLINE"}
              </Text>
            </View>
            <Text style={styles.statusUrlText} numberOfLines={1}>
              Active: {currentUrl}
            </Text>
            <Text style={styles.statusPingText}>
              Streamed Pings: {pingCount} updates transmitted
            </Text>
          </View>

          {/* IP Input Field */}
          <Text style={styles.inputLabel}>SERVER IP / HOSTNAME & PORT:</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={inputUrl}
              onChangeText={(text) => {
                setInputUrl(text);
                setPingResult(null);
              }}
              placeholder="e.g. 10.122.65.208 or 10.122.65.208:3000"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={Platform.OS === "ios" ? "url" : "default"}
            />
            <TouchableOpacity
              style={styles.pingBtn}
              onPress={() => testPing()}
              disabled={isTestingPing}
              activeOpacity={0.8}
            >
              {isTestingPing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.pingBtnText}>Test Ping</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Real-time normalized preview */}
          <Text style={styles.previewText} numberOfLines={1}>
            Connecting to: <Text style={styles.previewHighlight}>{normalizedPreview}</Text>
          </Text>

          {/* Ping Result Feedback */}
          {pingResult && (
            <View
              style={[
                styles.pingResultBox,
                pingResult.ok ? styles.pingResultOk : styles.pingResultError,
              ]}
            >
              <Text
                style={[
                  styles.pingResultText,
                  pingResult.ok ? { color: "#4ade80" } : { color: "#f87171" },
                ]}
              >
                {pingResult.ok ? "✅ " : "❌ "}
                {pingResult.msg}
                {pingResult.latencyMs !== undefined
                  ? ` • ${pingResult.latencyMs}ms latency`
                  : ""}
              </Text>
            </View>
          )}

          {/* Quick Preset Buttons */}
          <Text style={styles.presetsHeader}>Quick 1-Tap Presets:</Text>
          <View style={styles.presetsGrid}>
            {PRESETS.map((preset) => {
              const isSelected = normalizedPreview === preset.url;
              return (
                <TouchableOpacity
                  key={preset.url}
                  style={[
                    styles.presetBtn,
                    isSelected && styles.presetBtnActive,
                  ]}
                  onPress={() => {
                    setInputUrl(preset.url);
                    testPing(preset.url);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.presetBtnText,
                      isSelected && styles.presetBtnTextActive,
                    ]}
                  >
                    {preset.label}
                  </Text>
                  <Text style={styles.presetBtnSub} numberOfLines={1}>
                    {preset.url.replace(/^http:\/\//, "")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Modal Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.applyBtn}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Text style={styles.applyBtnText}>💾 Apply & Connect</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "90%",
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "rgba(56, 189, 248, 0.35)",
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 25,
  },
  scrollContainer: {
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#f8fafc",
    letterSpacing: 0.3,
  },
  modalSubtitle: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
    lineHeight: 15,
  },
  closeIconBtn: {
    padding: 6,
    marginLeft: 8,
  },
  closeIconText: {
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: "700",
  },
  statusCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  statusDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotGreen: {
    backgroundColor: "#10b981",
  },
  statusDotRed: {
    backgroundColor: "#ef4444",
  },
  statusStatusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  statusUrlText: {
    fontSize: 11,
    color: "#cbd5e1",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  statusPingText: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#38bdf8",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: "#ffffff",
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  pingBtn: {
    backgroundColor: "#0284c7",
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  pingBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  previewText: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 6,
    marginBottom: 10,
  },
  previewHighlight: {
    color: "#38bdf8",
    fontWeight: "700",
  },
  pingResultBox: {
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
  },
  pingResultOk: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  pingResultError: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  pingResultText: {
    fontSize: 11,
    fontWeight: "700",
  },
  presetsHeader: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
    marginBottom: 6,
  },
  presetsGrid: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
  },
  presetBtnActive: {
    backgroundColor: "rgba(56, 189, 248, 0.18)",
    borderColor: "#38bdf8",
  },
  presetBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#e2e8f0",
  },
  presetBtnTextActive: {
    color: "#38bdf8",
  },
  presetBtnSub: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  applyBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#0284c7",
    justifyContent: "center",
    alignItems: "center",
  },
  applyBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
});
