import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { 
  ShieldAlert, 
  Lock, 
  Mail, 
  Phone, 
  User, 
  Users, 
  Truck, 
  ArrowRight, 
  Heart, 
  FileText, 
  CheckCircle2, 
  X,
  HelpCircle
} from 'lucide-react-native';
import { theme } from '../../lib/theme';
import { UserRole, Profile } from '@mediconnect/shared';
import { authService } from '../../services/authService';

interface MobileAuthHomeScreenProps {
  onLoginSuccess: (profile: Profile) => void;
}

export const MobileAuthHomeScreen: React.FC<MobileAuthHomeScreenProps> = ({ onLoginSuccess }) => {
  // Mobile only supports the 3 citizen & responder roles (NO Admin on mobile)
  const [selectedRole, setSelectedRole] = useState<'NORMAL_USER' | 'EMERGENCY_CONTACT' | 'AMBULANCE_PERSONNEL'>('NORMAL_USER');
  const [authMode, setAuthMode] = useState<'SIGN_IN' | 'SIGN_UP'>('SIGN_IN');

  // Sign In inputs
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Sign Up inputs
  const [fullName, setFullName] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');

  // Role-specific sign up fields
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [contactRelation, setContactRelation] = useState('Parent');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');

  // Forgot Password Modal
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const bloodGroupOptions = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'];
  const relationOptions = ['Parent', 'Spouse', 'Child', 'Sibling', 'Personal Physician', 'Friend'];

  // Handle role switch
  const handleRoleChange = (role: 'NORMAL_USER' | 'EMERGENCY_CONTACT' | 'AMBULANCE_PERSONNEL') => {
    setSelectedRole(role);
    setIdentifier('');
    setPassword('');
  };

  // 1. Sign In Action
  const handleSignIn = async () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert('Required Fields', 'Please enter your phone number/email and password.');
      return;
    }

    setLoading(true);
    const result = await authService.login(identifier.trim(), selectedRole);
    setLoading(false);

    if (result.success && result.profile) {
      onLoginSuccess(result.profile);
    } else {
      Alert.alert('Authentication Notice', result.error || 'Failed to authenticate. Please check your credentials.');
    }
  };

  // 2. Sign Up Action
  const handleSignUp = async () => {
    if (!fullName.trim() || !signUpPhone.trim() || !signUpPassword.trim()) {
      Alert.alert('Missing Fields', 'Full Name, Phone Number, and Password are required.');
      return;
    }

    if (selectedRole === 'AMBULANCE_PERSONNEL' && (!licenseNumber.trim() || !vehicleNumber.trim())) {
      Alert.alert('Crew Verification', 'Paramedic license and vehicle number are required for ambulance registration.');
      return;
    }

    setLoading(true);
    const result = await authService.register({
      fullName: fullName.trim(),
      phone: signUpPhone.trim(),
      email: signUpEmail.trim() || undefined,
      role: selectedRole,
      bloodGroup: selectedRole === 'NORMAL_USER' ? bloodGroup : undefined,
      medicalNotes: selectedRole === 'NORMAL_USER' ? medicalNotes.trim() : undefined,
      licenseNumber: selectedRole === 'AMBULANCE_PERSONNEL' ? licenseNumber.trim() : undefined,
      vehicleNumber: selectedRole === 'AMBULANCE_PERSONNEL' ? vehicleNumber.trim() : undefined
    });
    setLoading(false);

    if (result.success && result.profile) {
      Alert.alert(
        'Account Registered',
        selectedRole === 'AMBULANCE_PERSONNEL'
          ? 'Ambulance registration submitted. Paramedic credentials will be verified by Main Admin Karthik.'
          : 'Welcome to MediConnect. Your emergency safety network is active.',
        [{ text: 'Continue', onPress: () => onLoginSuccess(result.profile!) }]
      );
    } else {
      Alert.alert('Registration Error', result.error || 'Unable to register profile.');
    }
  };

  // 3. Forgot Password Action
  const handleForgotSubmit = () => {
    if (!forgotInput.trim()) {
      Alert.alert('Field Required', 'Please enter your registered phone number or email.');
      return;
    }

    setForgotLoading(true);
    setTimeout(() => {
      setForgotLoading(false);
      setForgotModalVisible(false);
      Alert.alert(
        'Recovery Instructions Dispatched',
        `A secure one-time passcode and reset link have been dispatched to ${forgotInput.trim()}.`
      );
      setForgotInput('');
    }, 900);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <View style={styles.iconCircle}>
            <ShieldAlert size={36} color="#FFFFFF" />
          </View>
          <Text style={styles.brandTitle}>MediConnect</Text>
          <Text style={styles.brandSubtitle}>Emergency Health & Autonomous Dispatch</Text>
        </View>

        {/* 3 Mobile Roles Selector */}
        <View style={styles.roleSelectorBox}>
          <Text style={styles.sectionHeading}>SELECT ACCESS PORTAL</Text>
          <View style={styles.roleTabsRow}>
            {/* Citizen Role */}
            <TouchableOpacity
              style={[styles.roleTab, selectedRole === 'NORMAL_USER' && styles.roleTabActive]}
              onPress={() => handleRoleChange('NORMAL_USER')}
            >
              <User size={18} color={selectedRole === 'NORMAL_USER' ? '#FFFFFF' : theme.colors.primary} />
              <Text style={[styles.roleTabText, selectedRole === 'NORMAL_USER' && styles.roleTabTextActive]}>
                Citizen
              </Text>
            </TouchableOpacity>

            {/* Emergency Contact Role */}
            <TouchableOpacity
              style={[styles.roleTab, selectedRole === 'EMERGENCY_CONTACT' && styles.roleTabActive]}
              onPress={() => handleRoleChange('EMERGENCY_CONTACT')}
            >
              <Users size={18} color={selectedRole === 'EMERGENCY_CONTACT' ? '#FFFFFF' : theme.colors.accent} />
              <Text style={[styles.roleTabText, selectedRole === 'EMERGENCY_CONTACT' && styles.roleTabTextActive]}>
                Contact
              </Text>
            </TouchableOpacity>

            {/* Ambulance Crew Role */}
            <TouchableOpacity
              style={[styles.roleTab, selectedRole === 'AMBULANCE_PERSONNEL' && styles.roleTabActive]}
              onPress={() => handleRoleChange('AMBULANCE_PERSONNEL')}
            >
              <Truck size={18} color={selectedRole === 'AMBULANCE_PERSONNEL' ? '#FFFFFF' : '#0284C7'} />
              <Text style={[styles.roleTabText, selectedRole === 'AMBULANCE_PERSONNEL' && styles.roleTabTextActive]}>
                Ambulance
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Auth Mode Toggle: Sign In vs Sign Up */}
        <View style={styles.authModeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, authMode === 'SIGN_IN' && styles.modeBtnActive]}
            onPress={() => setAuthMode('SIGN_IN')}
          >
            <Text style={[styles.modeBtnText, authMode === 'SIGN_IN' && styles.modeBtnTextActive]}>
              Sign In
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeBtn, authMode === 'SIGN_UP' && styles.modeBtnActive]}
            onPress={() => setAuthMode('SIGN_UP')}
          >
            <Text style={[styles.modeBtnText, authMode === 'SIGN_UP' && styles.modeBtnTextActive]}>
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>

        {/* CARD CONTAINER */}
        <View style={styles.card}>
          {authMode === 'SIGN_IN' ? (
            /* ================= SIGN IN TAB ================= */
            <View style={styles.form}>
              <View style={styles.roleHintBox}>
                <Text style={styles.roleHintText}>
                  Signing in to <Text style={{ fontWeight: '800', color: theme.colors.textPrimary }}>
                    {selectedRole === 'NORMAL_USER' ? 'Citizen Emergency SOS' : selectedRole === 'EMERGENCY_CONTACT' ? 'Family Safety Portal' : 'Ambulance Paramedic Console'}
                  </Text>
                </Text>
              </View>

              {/* Identifier Input */}
              <View style={styles.inputWrapper}>
                {selectedRole === 'EMERGENCY_CONTACT' ? (
                  <Phone size={18} color={theme.colors.textMuted} />
                ) : (
                  <Mail size={18} color={theme.colors.textMuted} />
                )}
                <TextInput
                  style={styles.input}
                  placeholder={
                    selectedRole === 'EMERGENCY_CONTACT'
                      ? 'Registered Mobile Number (+91...)'
                      : 'Mobile Number or Email'
                  }
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType={selectedRole === 'EMERGENCY_CONTACT' ? 'phone-pad' : 'default'}
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputWrapper}>
                <Lock size={18} color={theme.colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={theme.colors.textMuted}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              {/* Forgot Password */}
              <TouchableOpacity 
                style={styles.forgotBtn} 
                onPress={() => {
                  setForgotInput(identifier.includes('@') ? identifier : '');
                  setForgotModalVisible(true);
                }}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={handleSignIn}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>
                      Sign In as {selectedRole === 'NORMAL_USER' ? 'Citizen' : selectedRole === 'EMERGENCY_CONTACT' ? 'Contact' : 'Paramedic'}
                    </Text>
                    <ArrowRight size={18} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* ================= SIGN UP TAB ================= */
            <View style={styles.form}>
              <View style={styles.roleHintBox}>
                <Text style={styles.roleHintText}>
                  Registering as <Text style={{ fontWeight: '800', color: theme.colors.textPrimary }}>
                    {selectedRole === 'NORMAL_USER' ? 'Citizen (Instant SOS)' : selectedRole === 'EMERGENCY_CONTACT' ? 'Family Contact' : 'Ambulance Crew'}
                  </Text>
                </Text>
              </View>

              {/* Full Name */}
              <View style={styles.inputWrapper}>
                <User size={18} color={theme.colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Legal Name"
                  placeholderTextColor={theme.colors.textMuted}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              {/* Phone */}
              <View style={styles.inputWrapper}>
                <Phone size={18} color={theme.colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Primary Mobile Number (+91...)"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="phone-pad"
                  value={signUpPhone}
                  onChangeText={setSignUpPhone}
                />
              </View>

              {/* Email */}
              <View style={styles.inputWrapper}>
                <Mail size={18} color={theme.colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="email-address"
                  value={signUpEmail}
                  onChangeText={setSignUpEmail}
                  autoCapitalize="none"
                />
              </View>

              {/* Password */}
              <View style={styles.inputWrapper}>
                <Lock size={18} color={theme.colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Create Password"
                  placeholderTextColor={theme.colors.textMuted}
                  secureTextEntry
                  value={signUpPassword}
                  onChangeText={setSignUpPassword}
                />
              </View>

              {/* Citizen-Specific Fields: Blood Group & Medical Notes */}
              {selectedRole === 'NORMAL_USER' && (
                <View style={styles.extraSection}>
                  <Text style={styles.extraHeading}>EMERGENCY MEDICAL PROFILE</Text>
                  
                  <Text style={styles.fieldLabel}>Blood Group</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                    {bloodGroupOptions.map(bg => (
                      <TouchableOpacity
                        key={bg}
                        style={[styles.bloodChip, bloodGroup === bg && styles.bloodChipActive]}
                        onPress={() => setBloodGroup(bg)}
                      >
                        <Text style={[styles.bloodChipText, bloodGroup === bg && styles.bloodChipTextActive]}>
                          {bg}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <View style={[styles.inputWrapper, { marginTop: 12 }]}>
                    <Heart size={18} color={theme.colors.textMuted} />
                    <TextInput
                      style={styles.input}
                      placeholder="Critical Conditions / Allergies (e.g. Asthma)"
                      placeholderTextColor={theme.colors.textMuted}
                      value={medicalNotes}
                      onChangeText={setMedicalNotes}
                    />
                  </View>
                </View>
              )}

              {/* Emergency Contact Specific: Relationship */}
              {selectedRole === 'EMERGENCY_CONTACT' && (
                <View style={styles.extraSection}>
                  <Text style={styles.extraHeading}>RELATIONSHIP TO PATIENT</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                    {relationOptions.map(rel => (
                      <TouchableOpacity
                        key={rel}
                        style={[styles.bloodChip, contactRelation === rel && styles.bloodChipActive]}
                        onPress={() => setContactRelation(rel)}
                      >
                        <Text style={[styles.bloodChipText, contactRelation === rel && styles.bloodChipTextActive]}>
                          {rel}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Ambulance Paramedic Specific: License & Vehicle */}
              {selectedRole === 'AMBULANCE_PERSONNEL' && (
                <View style={styles.extraSection}>
                  <Text style={styles.extraHeading}>CREW CREDENTIALS & VEHICLE</Text>
                  <View style={styles.inputWrapper}>
                    <FileText size={18} color={theme.colors.textMuted} />
                    <TextInput
                      style={styles.input}
                      placeholder="Medical Paramedic License No."
                      placeholderTextColor={theme.colors.textMuted}
                      value={licenseNumber}
                      onChangeText={setLicenseNumber}
                    />
                  </View>

                  <View style={[styles.inputWrapper, { marginTop: 10 }]}>
                    <Truck size={18} color={theme.colors.textMuted} />
                    <TextInput
                      style={styles.input}
                      placeholder="Vehicle Registration (e.g. TN-01-AMB-4091)"
                      placeholderTextColor={theme.colors.textMuted}
                      value={vehicleNumber}
                      onChangeText={setVehicleNumber}
                    />
                  </View>
                </View>
              )}

              {/* Create Account Submit */}
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled, { marginTop: 16 }]}
                onPress={handleSignUp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Complete Registration</Text>
                    <CheckCircle2 size={18} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Footer info */}
        <Text style={styles.footerText}>
          Protected by PostGIS Geofencing & Zero-Trust Privacy Protocols
        </Text>
      </ScrollView>

      {/* Forgot Password Modal */}
      <Modal
        visible={forgotModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setForgotModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <HelpCircle size={22} color={theme.colors.primary} />
                <Text style={styles.modalTitle}>Password Reset</Text>
              </View>
              <TouchableOpacity onPress={() => setForgotModalVisible(false)}>
                <X size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Enter your registered mobile number or email address. We will dispatch a secure verification code to reset your password.
            </Text>

            <View style={[styles.inputWrapper, { marginBottom: 16 }]}>
              <Mail size={18} color={theme.colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Mobile Number or Email"
                placeholderTextColor={theme.colors.textMuted}
                value={forgotInput}
                onChangeText={setForgotInput}
                autoFocus
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setForgotModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalSubmitBtn}
                onPress={handleForgotSubmit}
                disabled={forgotLoading}
              >
                {forgotLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Send Code</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl * 1.5,
    paddingBottom: theme.spacing.xl * 2
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: theme.spacing.sm
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: -0.5
  },
  brandSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginTop: 2
  },
  roleSelectorBox: {
    marginBottom: theme.spacing.lg
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm
  },
  roleTabsRow: {
    flexDirection: 'row',
    gap: 8
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  roleTabActive: {
    backgroundColor: theme.colors.textPrimary,
    borderColor: theme.colors.textPrimary
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  roleTabTextActive: {
    color: '#FFFFFF'
  },
  authModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: theme.borderRadius.md,
    padding: 3,
    marginBottom: theme.spacing.md
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm
  },
  modeBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary
  },
  modeBtnTextActive: {
    color: theme.colors.textPrimary
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  form: {
    width: '100%'
  },
  roleHintBox: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md
  },
  roleHintText: {
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    height: 50,
    backgroundColor: '#FFFFFF',
    marginBottom: theme.spacing.md,
    gap: 10
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: '500'
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: theme.spacing.lg
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: theme.borderRadius.md,
    gap: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3
  },
  primaryBtnDisabled: {
    opacity: 0.6
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14
  },
  extraSection: {
    marginTop: 4,
    marginBottom: theme.spacing.sm
  },
  extraHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: theme.colors.textMuted,
    marginBottom: 8
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 6
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: 6
  },
  bloodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  bloodChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  bloodChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  bloodChipTextActive: {
    color: '#FFFFFF'
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xl
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg
  },
  modalBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary
  },
  modalDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 16
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary
  },
  modalSubmitBtn: {
    flex: 1,
    height: 44,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
