import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  Shield,
  Phone,
  Lock,
  User,
  HeartHandshake,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Zap,
  Volume2,
  ShieldAlert,
} from 'lucide-react-native';
import { loginCitizen, registerCitizen, CitizenUser } from '../services/authService';

interface CitizenAuthProps {
  backendUrl: string;
  onAuthSuccess: (user: CitizenUser, token: string) => void;
  onBypassGuestMode: () => void;
}

export const CitizenAuth: React.FC<CitizenAuthProps> = ({
  backendUrl,
  onAuthSuccess,
  onBypassGuestMode,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [emergencyName, setEmergencyName] = useState<string>('');
  const [emergencyPhone, setEmergencyPhone] = useState<string>('');
  const [isVolunteer, setIsVolunteer] = useState<boolean>(false);
  const [mlSensitivity, setMlSensitivity] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!phone.trim() || !password.trim()) {
      setErrorMsg('Please enter both your phone number and password.');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setErrorMsg('Please provide your full legal name or display alias.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        const res = await loginCitizen(phone.trim(), password, backendUrl);
        setSuccessMsg(`Welcome, ${res.user.name || 'Citizen'}! Safe Guard Armed.`);
        setTimeout(() => onAuthSuccess(res.user, res.token), 500);
      } else {
        const res = await registerCitizen(
          {
            phone: phone.trim(),
            password,
            name: name.trim(),
            isVolunteer,
            mlSensitivity,
            emergencyContactName: emergencyName.trim() || undefined,
            emergencyContactPhone: emergencyPhone.trim() || undefined,
          },
          backendUrl
        );
        setSuccessMsg(`Profile registered! Emergency matrix configured.`);
        setTimeout(() => onAuthSuccess(res.user, res.token), 500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error. Please verify input.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillSampleCitizen = () => {
    setPhone('+1555019888');
    setPassword('citizen_pass_123');
    if (mode === 'register') {
      setName('Elena Rostova');
      setEmergencyName('David Rostova (Brother)');
      setEmergencyPhone('+1555019999');
      setIsVolunteer(true);
      setMlSensitivity('HIGH');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Hero Brand */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Shield size={34} color="#ffffff" />
          </View>
          <View style={styles.appTitleRow}>
            <Text style={styles.appTitle}>PROJECT </Text>
            <Text style={[styles.appTitle, styles.appTitleHighlight]}>GUARDIAN</Text>
          </View>
          <Text style={styles.appSubtitle}>
            Autonomous Personal Safety & Multi-Sensor SOS Mesh
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, mode === 'login' && styles.tabButtonActive]}
            activeOpacity={0.8}
            onPress={() => {
              setMode('login');
              setErrorMsg(null);
            }}
          >
            <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
              Citizen Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, mode === 'register' && styles.tabButtonActive]}
            activeOpacity={0.8}
            onPress={() => {
              setMode('register');
              setErrorMsg(null);
            }}
          >
            <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>
              New Onboarding
            </Text>
          </TouchableOpacity>
        </View>

        {/* Feedback Alerts */}
        {errorMsg && (
          <View style={styles.errorBox}>
            <AlertCircle size={18} color="#fca5a5" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {successMsg && (
          <View style={styles.successBox}>
            <CheckCircle2 size={18} color="#86efac" />
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        )}

        {/* Auth Form Card */}
        <View style={styles.card}>
          {mode === 'register' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name / Display Alias</Text>
              <View style={styles.inputWrapper}>
                <User size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Maya Lin"
                  placeholderTextColor="#64748b"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Phone Number (Identity Handle)</Text>
            <View style={styles.inputWrapper}>
              <Phone size={18} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="+1 (555) 019-888"
                placeholderTextColor="#64748b"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Security Password</Text>
            <View style={styles.inputWrapper}>
              <Lock size={18} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="••••••••••••"
                placeholderTextColor="#64748b"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          {mode === 'register' && (
            <>
              {/* Emergency Contact Section */}
              <View style={styles.sectionDivider} />
              <View style={styles.subSectionHeader}>
                <Users size={16} color="#38bdf8" />
                <Text style={styles.subSectionTitle}>Primary Emergency Contact</Text>
              </View>
              <Text style={styles.subSectionDesc}>
                Will receive priority SMS / GPS alerts during active distress beacons
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Contact Name / Relationship</Text>
                <View style={styles.inputWrapper}>
                  <User size={18} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. David (Brother)"
                    placeholderTextColor="#64748b"
                    value={emergencyName}
                    onChangeText={setEmergencyName}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Contact Phone Number</Text>
                <View style={styles.inputWrapper}>
                  <Phone size={18} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="+1 (555) 019-999"
                    placeholderTextColor="#64748b"
                    value={emergencyPhone}
                    onChangeText={setEmergencyPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* Edge ML Sensitivity Selector */}
              <View style={styles.sectionDivider} />
              <View style={styles.subSectionHeader}>
                <Volume2 size={16} color="#a855f7" />
                <Text style={styles.subSectionTitle}>Acoustic Scream Sensitivity</Text>
              </View>

              <View style={styles.mlPillRow}>
                {(['LOW', 'MEDIUM', 'HIGH'] as const).map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.mlPill,
                      mlSensitivity === level && styles.mlPillActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setMlSensitivity(level)}
                  >
                    <Text
                      style={[
                        styles.mlPillText,
                        mlSensitivity === level && styles.mlPillTextActive,
                      ]}
                    >
                      {level} {level === 'LOW' ? '(90%)' : level === 'MEDIUM' ? '(80%)' : '(70%)'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Community Volunteer Checkbox */}
              <TouchableOpacity
                style={styles.volunteerBox}
                onPress={() => setIsVolunteer(!isVolunteer)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, isVolunteer && styles.checkboxActive]}>
                  {isVolunteer && <CheckCircle2 size={16} color="#ffffff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.volunteerTitle}>Join Volunteer Sentinel Mesh</Text>
                  <Text style={styles.volunteerDesc}>
                    Receive silent proximity alerts when someone within 500m triggers an SOS
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* Submit Action */}
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <View style={styles.submitButtonContent}>
                <Text style={styles.submitButtonText}>
                  {mode === 'login' ? 'Arm & Enter Safety HUD' : 'Complete Citizen Registration'}
                </Text>
                <ArrowRight size={18} color="#ffffff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick Demo Pre-fills & Guest SOS Bypass */}
        <View style={styles.quickBar}>
          <TouchableOpacity
            style={styles.prefillButton}
            onPress={fillSampleCitizen}
            activeOpacity={0.8}
          >
            <Zap size={14} color="#f59e0b" />
            <Text style={styles.prefillButtonText}>Pre-fill Sample</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.guestButton}
            onPress={onBypassGuestMode}
            activeOpacity={0.8}
          >
            <ShieldAlert size={14} color="#ef4444" />
            <Text style={styles.guestButtonText}>Test SOS (Guest)</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNote}>
          Encrypted AES-256 Mesh • Real-time WebSockets • Edge ML
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0d14',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 32 : 16,
    paddingBottom: 36,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  appTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: '#ffffff',
  },
  appTitleHighlight: {
    color: '#ef4444',
  },
  appSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
    minHeight: 40,
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#ef4444',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  successText: {
    color: '#86efac',
    fontSize: 12,
    flex: 1,
  },
  card: {
    backgroundColor: 'rgba(20, 27, 43, 0.85)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 15, 25, 0.7)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    height: 44,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: 44,
    color: '#ffffff',
    fontSize: 13,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 12,
  },
  subSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  subSectionDesc: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 10,
  },
  mlPillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  mlPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  mlPillActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderColor: '#a855f7',
  },
  mlPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  mlPillTextActive: {
    color: '#d8b4fe',
  },
  volunteerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  volunteerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fda4af',
  },
  volunteerDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    lineHeight: 15,
  },
  submitButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
    minHeight: 46,
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  quickBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    gap: 8,
  },
  prefillButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    minHeight: 38,
  },
  prefillButtonText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
  },
  guestButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    minHeight: 38,
  },
  guestButtonText: {
    fontSize: 11,
    color: '#fda4af',
    fontWeight: '700',
  },
  footerNote: {
    fontSize: 10,
    color: '#475569',
    textAlign: 'center',
    marginTop: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
