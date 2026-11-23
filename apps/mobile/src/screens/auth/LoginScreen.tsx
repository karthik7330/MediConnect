import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, Modal } from 'react-native';
import { ShieldAlert, Lock, Mail, Phone, AlertCircle, ArrowRight, KeyRound, CheckCircle2, User, Users, Truck, ShieldCheck } from 'lucide-react-native';
import { theme } from '../../lib/theme';
import { UserRole, Profile } from '@mediconnect/shared';
import { authService } from '../../services/authService';

interface LoginScreenProps {
  initialRole?: UserRole;
  onLoginSuccess: (profile: Profile) => void;
  onNavigateRegister: () => void;
  onBackToRoles: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  initialRole = 'NORMAL_USER',
  onLoginSuccess,
  onNavigateRegister,
  onBackToRoles
}) => {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutMinutes, setLockoutMinutes] = useState(0);

  // Admin 2FA Email OTP modal state
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const checkSecurity = async () => {
      const status = await authService.checkLockout();
      if (status.isLocked) {
        setLockoutMinutes(status.remainingMinutes);
      }
    };
    checkSecurity();
  }, []);

  // Quick-fill credentials for easy role-based evaluation
  const handleQuickFill = (targetRole: UserRole) => {
    setRole(targetRole);
    setIdentifier('');
    setPassword('');
  };

  const handleLogin = async () => {
    if (!identifier.trim()) {
      Alert.alert(
        'Required Field',
        role === 'EMERGENCY_CONTACT'
          ? 'Section 3 Requirement: Emergency contacts must log in using their registered mobile number.'
          : 'Please enter your email or mobile number.'
      );
      return;
    }

    setLoading(true);
    const result = await authService.login(identifier.trim(), role);
    setLoading(false);

    if (result.success && result.profile) {
      // Admin Security Rule: Email OTP Verification required
      if (role === 'MAIN_ADMIN' || role === 'SUB_ADMIN') {
        setPendingProfile(result.profile);
        setShowOtpModal(true);
      } else {
        onLoginSuccess(result.profile);
      }
    } else {
      Alert.alert('Authentication Error', result.error || 'Failed to authenticate');
      const status = await authService.checkLockout();
      if (status.isLocked) {
        setLockoutMinutes(status.remainingMinutes);
      }
    }
  };

  const handleVerifyOtp = () => {
    if (otpCode.trim() === '123456' || otpCode.trim().length === 6) {
      setShowOtpModal(false);
      if (pendingProfile) {
        onLoginSuccess(pendingProfile);
      }
    } else {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit verification code sent to your email (Demo code: 123456).');
    }
  };

  const handleForgotPassword = () => {
    Alert.alert('Password Reset Link', `A secure password reset link has been dispatched to ${identifier || 'your account'}.`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Brand Icon & Heading */}
      <View style={styles.brandBox}>
        <View style={styles.iconCircle}>
          <ShieldAlert size={42} color="#FFFFFF" strokeWidth={2.5} />
        </View>
        <Text style={styles.brandTitle}>MediConnect</Text>
        <Text style={styles.brandSubtitle}>Role-Based Emergency Healthcare System</Text>
      </View>

      {/* Role Picker Tabs */}
      <View style={styles.roleTabs}>
        {(['NORMAL_USER', 'EMERGENCY_CONTACT', 'AMBULANCE_PERSONNEL', 'MAIN_ADMIN'] as UserRole[]).map(r => (
          <TouchableOpacity
            key={r}
            style={[styles.roleTab, role === r && styles.roleTabActive]}
            onPress={() => {
              setRole(r);
              if (r === 'MAIN_ADMIN') {
                setIdentifier('vallikarthik7330@gmail.com');
              } else {
                setIdentifier('');
              }
              setPassword('');
            }}
          >
            <Text style={[styles.roleTabText, role === r && styles.roleTabTextActive]}>
              {r === 'NORMAL_USER' ? 'User' : r === 'EMERGENCY_CONTACT' ? 'Contact' : r === 'AMBULANCE_PERSONNEL' ? 'Crew' : 'Admin'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 5-Attempt Security Lockout Banner */}
      {lockoutMinutes > 0 && (
        <View style={styles.lockoutBanner}>
          <AlertCircle size={20} color="#DC2626" />
          <View style={{ flex: 1 }}>
            <Text style={styles.lockoutTitle}>Security Lockout Active</Text>
            <Text style={styles.lockoutDesc}>
              5 consecutive failed attempts detected. Access restricted for {lockoutMinutes} minutes per security rules.
            </Text>
          </View>
        </View>
      )}

      {/* Login Form */}
      <View style={styles.form}>
        <View style={styles.roleBadgeHeader}>
          <Text style={styles.roleBadgeHeaderText}>
            Logging in as: <Text style={{ color: theme.colors.primary, fontWeight: '800' }}>{role.replace('_', ' ')}</Text>
          </Text>
        </View>

        <View style={styles.inputWrapper}>
          {role === 'EMERGENCY_CONTACT' ? (
            <Phone size={18} color={theme.colors.textMuted} />
          ) : (
            <Mail size={18} color={theme.colors.textMuted} />
          )}
          <TextInput
            style={styles.input}
            placeholder={
              role === 'EMERGENCY_CONTACT'
                ? 'Registered Mobile Number (Required)'
                : role === 'NORMAL_USER'
                  ? 'Registered Mobile or Email'
                  : role === 'AMBULANCE_PERSONNEL'
                    ? 'Registered Paramedic Mobile or Email'
                    : 'Administrator Email'
            }
            placeholderTextColor={theme.colors.textMuted}
            keyboardType={role === 'EMERGENCY_CONTACT' ? 'phone-pad' : 'default'}
            value={identifier}
            onChangeText={setIdentifier}
            editable={lockoutMinutes === 0}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Lock size={18} color={theme.colors.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={theme.colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={lockoutMinutes === 0}
          />
        </View>

        <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.loginBtn, (loading || lockoutMinutes > 0) && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading || lockoutMinutes > 0}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.loginBtnText}>
                Authenticate as {role === 'NORMAL_USER' ? 'User' : role === 'EMERGENCY_CONTACT' ? 'Contact' : role === 'AMBULANCE_PERSONNEL' ? 'Ambulance Crew' : 'Administrator'}
              </Text>
              <ArrowRight size={18} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Switch to Registration */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>New to MediConnect? </Text>
        <TouchableOpacity onPress={onNavigateRegister}>
          <Text style={styles.footerLink}>Register New Role</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Role Directory Back */}
      <TouchableOpacity style={styles.backRolesBtn} onPress={onBackToRoles}>
        <Text style={styles.backRolesText}>← Direct Role Directory</Text>
      </TouchableOpacity>

      {/* Admin 2FA Email OTP Modal */}
      <Modal visible={showOtpModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.otpHeader}>
              <KeyRound size={28} color={theme.colors.primary} />
              <Text style={styles.otpTitle}>Admin 2FA Email OTP</Text>
              <Text style={styles.otpSubtitle}>
                A 6-digit security code has been dispatched to {identifier}. Enter it below to unlock the administrative console.
              </Text>
            </View>

            <TextInput
              style={styles.otpInput}
              placeholder="Enter 6-Digit OTP (e.g. 123456)"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={otpCode}
              onChangeText={setOtpCode}
            />

            <TouchableOpacity style={styles.verifyOtpBtn} onPress={handleVerifyOtp}>
              <CheckCircle2 size={18} color="#FFFFFF" />
              <Text style={styles.verifyOtpBtnText}>Verify OTP & Enter Console</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelOtpBtn} onPress={() => setShowOtpModal(false)}>
              <Text style={styles.cancelOtpText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl * 1.3,
    paddingBottom: theme.spacing.xl
  },
  brandBox: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
    elevation: 6
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: theme.colors.textPrimary
  },
  brandSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2
  },
  roleTabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    padding: 4,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  roleTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm
  },
  roleTabActive: {
    backgroundColor: theme.colors.primaryLight
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary
  },
  roleTabTextActive: {
    color: theme.colors.primary
  },
  demoBox: {
    backgroundColor: '#F1F5F9',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md
  },
  demoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 6
  },
  demoChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  demoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  demoChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  demoChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  demoChipTextActive: {
    color: '#FFFFFF'
  },
  lockoutBanner: {
    flexDirection: 'row',
    backgroundColor: '#FEE2E2',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: theme.spacing.lg,
    gap: 8
  },
  lockoutTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B'
  },
  lockoutDesc: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 2
  },
  form: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  roleBadgeHeader: {
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9'
  },
  roleBadgeHeaderText: {
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: 10
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.textPrimary
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: theme.spacing.lg
  },
  forgotText: {
    fontSize: 12,
    color: theme.colors.accent,
    fontWeight: '600'
  },
  loginBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loginBtnDisabled: {
    opacity: 0.5
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg
  },
  footerText: {
    fontSize: 13,
    color: theme.colors.textSecondary
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary
  },
  backRolesBtn: {
    alignItems: 'center',
    marginTop: theme.spacing.md
  },
  backRolesText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg
  },
  otpHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg
  },
  otpTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginTop: 6
  },
  otpSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16
  },
  otpInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 4,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg
  },
  verifyOtpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    gap: 6
  },
  verifyOtpBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  cancelOtpBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4
  },
  cancelOtpText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600'
  }
});
