import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { CitizenUser } from "../services/authService";

export interface SafeCircleTabProps {
  currentUser: CitizenUser | null;
  isVolunteer: boolean;
  onToggleVolunteer: () => void;
  coords: { lat: number; lng: number } | null;
  batteryLevel: number;
  batteryState: string;
  isLowPowerMode: boolean;
  isConnected: boolean;
  backendUrl: string;
  pingCount: number;
  onRefreshBattery: () => void;
  onLogout: () => void;
  onTriggerSmsFallback: (lat: number, lng: number, batt: number) => void;
}

export const SafeCircleTab: React.FC<SafeCircleTabProps> = ({
  currentUser,
  isVolunteer,
  onToggleVolunteer,
  coords,
  batteryLevel,
  batteryState,
  isLowPowerMode,
  isConnected,
  backendUrl,
  pingCount,
  onRefreshBattery,
  onLogout,
  onTriggerSmsFallback,
}) => {
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Citizen Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "👤"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName} numberOfLines={1}>
              {currentUser?.name || "Citizen User"}
            </Text>
            <Text style={styles.profilePhone} numberOfLines={1}>
              {currentUser?.phone || "+91 9876543210"}
            </Text>
            <View style={styles.badgeRow}>
              <View style={styles.protectedBadge}>
                <Text style={styles.protectedBadgeText}>🛡️ PROTECTED CITIZEN</Text>
              </View>
              {isVolunteer && (
                <View style={styles.volunteerBadge}>
                  <Text style={styles.volunteerBadgeText}>🤝 SENTINEL</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {currentUser?.bloodGroup && (
          <View style={styles.medicalInfoRow}>
            <Text style={styles.medicalLabel}>Blood Group:</Text>
            <Text style={styles.medicalValue}>{currentUser.bloodGroup}</Text>
          </View>
        )}
      </View>

      {/* Community Sentinel Mesh Toggle */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.cardTitle}>Community Sentinel Mesh</Text>
            <Text style={styles.cardDesc}>
              Receive discreet alerts if a distress beacon is triggered within 500m of your location.
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.volunteerToggle,
              isVolunteer && styles.volunteerToggleActive,
            ]}
            activeOpacity={0.8}
            onPress={onToggleVolunteer}
          >
            <Text style={styles.volunteerToggleText}>
              {isVolunteer ? "ACTIVE" : "OFF"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Emergency Contacts Roster */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardTitle}>Emergency Contacts Circle</Text>
            <Text style={styles.cardDesc}>
              Trusted contacts notified instantly via SMS & Push during SOS
            </Text>
          </View>
          <View style={styles.contactCountBadge}>
            <Text style={styles.contactCountText}>
              {currentUser?.emergencyContacts?.length || 0} Contacts
            </Text>
          </View>
        </View>

        {currentUser?.emergencyContacts && currentUser.emergencyContacts.length > 0 ? (
          <View style={{ marginTop: 8 }}>
            {currentUser.emergencyContacts.map((contact, index) => (
              <View key={contact.phoneNumber || index} style={styles.contactItem}>
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactAvatarText}>
                    {contact.contactName ? contact.contactName.charAt(0).toUpperCase() : "#"}
                  </Text>
                </View>
                <View style={{ flex: 1, paddingHorizontal: 10 }}>
                  <Text style={styles.contactName} numberOfLines={1}>
                    {contact.contactName}
                  </Text>
                  <Text style={styles.contactPhone} numberOfLines={1}>
                    {contact.phoneNumber}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.directSmsBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (coords) {
                      onTriggerSmsFallback(
                        coords.lat,
                        coords.lng,
                        Math.round(batteryLevel)
                      );
                    }
                  }}
                >
                  <Text style={styles.directSmsBtnText}>📲 SOS SMS</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyContactsBox}>
            <Text style={styles.emptyContactsIcon}>👥</Text>
            <Text style={styles.emptyContactsTitle}>No Emergency Contacts Added</Text>
            <Text style={styles.emptyContactsSub}>
              Add primary contacts to automatically relay SOS coordinates and emergency notifications.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.broadcastSmsBtn}
          activeOpacity={0.8}
          onPress={() => {
            if (coords) {
              onTriggerSmsFallback(
                coords.lat,
                coords.lng,
                Math.round(batteryLevel)
              );
            }
          }}
        >
          <Text style={styles.broadcastSmsBtnText}>
            🚨 Test Fast SMS Dispatch to Circle
          </Text>
        </TouchableOpacity>
      </View>

      {/* Device & Network Health */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Device & Network Health</Text>

        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>Mesh Gateway:</Text>
          <Text
            style={[
              styles.healthValue,
              { color: isConnected ? "#10b981" : "#ef4444" },
            ]}
          >
            {isConnected ? "🟢 ONLINE" : "🔴 OFFLINE"}
          </Text>
        </View>

        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>Endpoint:</Text>
          <Text style={[styles.healthValue, { fontSize: 11 }]} numberOfLines={1}>
            {backendUrl}
          </Text>
        </View>

        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>Telemetry Transmitted:</Text>
          <Text style={styles.healthValue}>{pingCount} updates</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>Battery Power:</Text>
          <Text
            style={[
              styles.healthValue,
              batteryLevel <= 10 ? { color: "#ef4444" } : { color: "#10b981" },
            ]}
          >
            {Math.round(batteryLevel)}% ({batteryState})
          </Text>
        </View>

        {isLowPowerMode && (
          <View style={styles.lowPowerNotice}>
            <Text style={styles.lowPowerNoticeText}>
              ⚠️ OS Low Power Mode Detected • Polling throttled to conserve energy
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.refreshBatteryBtn}
          activeOpacity={0.75}
          onPress={onRefreshBattery}
        >
          <Text style={styles.refreshBatteryBtnText}>🔄 Refresh Hardware Battery Snapshot</Text>
        </TouchableOpacity>
      </View>

      {/* Sign Out Action */}
      <TouchableOpacity
        style={styles.logoutButton}
        activeOpacity={0.8}
        onPress={onLogout}
      >
        <Text style={styles.logoutButtonText}>🚪 Sign Out of Guardian Nest</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 36,
  },
  profileCard: {
    backgroundColor: "rgba(24, 34, 52, 0.9)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    borderWidth: 2,
    borderColor: "#38bdf8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: "900",
    color: "#38bdf8",
  },
  profileName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: 0.2,
  },
  profilePhone: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
    fontWeight: "500",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  protectedBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  protectedBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#34d399",
  },
  volunteerBadge: {
    backgroundColor: "rgba(168, 85, 247, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.4)",
  },
  volunteerBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#d8b4fe",
  },
  medicalInfoRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  medicalLabel: {
    fontSize: 12,
    color: "#94a3b8",
  },
  medicalValue: {
    fontSize: 13,
    color: "#ef4444",
    fontWeight: "800",
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
  volunteerToggle: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  volunteerToggleActive: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: "#10b981",
  },
  volunteerToggleText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "800",
  },
  contactCountBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  contactCountText: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "700",
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  contactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(168, 85, 247, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  contactAvatarText: {
    color: "#d8b4fe",
    fontSize: 14,
    fontWeight: "800",
  },
  contactName: {
    color: "#f1f5f9",
    fontSize: 13,
    fontWeight: "700",
  },
  contactPhone: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 1,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  directSmsBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  directSmsBtnText: {
    color: "#f87171",
    fontSize: 11,
    fontWeight: "700",
  },
  emptyContactsBox: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 10,
    marginVertical: 8,
  },
  emptyContactsIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  emptyContactsTitle: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyContactsSub: {
    color: "#64748b",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
  broadcastSmsBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    alignItems: "center",
    marginTop: 6,
  },
  broadcastSmsBtnText: {
    color: "#fca5a5",
    fontSize: 12,
    fontWeight: "800",
  },
  healthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 4,
  },
  healthLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "500",
  },
  healthValue: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 8,
  },
  lowPowerNotice: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    padding: 8,
    borderRadius: 6,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  lowPowerNoticeText: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: "600",
  },
  refreshBatteryBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 6,
  },
  refreshBatteryBtnText: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "700",
  },
  logoutButton: {
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.3)",
    alignItems: "center",
    marginTop: 8,
  },
  logoutButtonText: {
    color: "#fda4af",
    fontSize: 13,
    fontWeight: "800",
  },
});
