import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { ShieldCheck, User, Users, Truck, Lock, Mail, Phone, ArrowLeft, AlertCircle } from 'lucide-react-native';
import { theme } from '../../lib/theme';
import { UserRole, Profile } from '@mediconnect/shared';
import { authService } from '../../services/authService';

interface RegisterScreenProps {
  onRegisterSuccess: (profile: Profile) => void;
  onNavigateLogin: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onRegisterSuccess, onNavigateLogin }) => {
  const [role, setRole] = useState<UserRole>('NORMAL_USER');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Normal User medical fields
  const [bloodGroup, setBloodGroup] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');

  // Ambulance Crew fields
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');

  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !phone.trim() || !password.trim()) {
      Alert.alert('Required Fields', 'Please complete your full name, mobile number, and password.');
      return;
    }

    if (role === 'AMBULANCE_PERSONNEL' && (!licenseNumber.trim() || !vehicleNumber.trim())) {
      Alert.alert('Crew Verification', 'Paramedic license and vehicle number are required for ambulance registration.');
      return;
    }

    setLoading(true);
    const result = await authService.register({
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      role,
      bloodGroup: bloodGroup.trim() || undefined,
      medicalNotes: medicalNotes.trim() || undefined,
      licenseNumber: licenseNumber.trim() || undefined,
      vehicleNumber: vehicleNumber.trim() || undefined
    });
    setLoading(false);

    if (result.success && result.profile) {
      if (role === 'AMBULANCE_PERSONNEL') {
        Alert.alert(
          'Registration Submitted',
          'Ambulance registration submitted. Per system security rules, online dispatch will activate upon Main Admin verification.',
          [{ text: 'Continue to Dashboard', onPress: () => onRegisterSuccess(result.profile!) }]
        );
      } else {
        Alert.alert('Account Created', `Welcome to MediConnect, ${result.profile.fullName}!`, [
          { text: 'Enter Dashboard', onPress: () => onRegisterSuccess(result.profile!) }
        ]);
      }
    } else {
      Alert.alert('Registration Failed', result.error || 'Could not create account');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onNavigateLogin}>
          <ArrowLeft size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Account</Text>
      </View>

      {/* Role Selector Header */}
      <Text style={styles.label}>Select Your MediConnect Role</Text>
      <View style={styles.roleGrid}>
        <TouchableOpacity
          style={[styles.roleCard, role === 'NORMAL_USER' && styles.roleCardActive]}
          onPress={() => setRole('NORMAL_USER')}
        >
          <User size={22} color={role === 'NORMAL_USER' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text style={[styles.roleCardTitle, role === 'NORMAL_USER' && styles.roleCardTitleActive]}>Normal User</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleCard, role === 'EMERGENCY_CONTACT' && styles.roleCardActive]}
          onPress={() => setRole('EMERGENCY_CONTACT')}
        >
          <Users size={22} color={role === 'EMERGENCY_CONTACT' ? theme.colors.accent : theme.colors.textSecondary} />
          <Text style={[styles.roleCardTitle, role === 'EMERGENCY_CONTACT' && styles.roleCardTitleActive]}>Emergency Contact</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleCard, role === 'AMBULANCE_PERSONNEL' && styles.roleCardActive]}
          onPress={() => setRole('AMBULANCE_PERSONNEL')}
        >
          <Truck size={22} color={role === 'AMBULANCE_PERSONNEL' ? '#0284C7' : theme.colors.textSecondary} />
          <Text style={[styles.roleCardTitle, role === 'AMBULANCE_PERSONNEL' && styles.roleCardTitleActive]}>Ambulance</Text>
        </TouchableOpacity>
      </View>

      {/* Ambulance Admin Notice */}
      {role === 'AMBULANCE_PERSONNEL' && (
        <View style={styles.adminNotice}>
          <AlertCircle size={18} color="#0369A1" />
          <Text style={styles.adminNoticeText}>
            Ambulance personnel accounts require Main Admin approval before receiving active emergency dispatches.
          </Text>
        </View>
      )}

      {/* Core Profile Inputs */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Full Legal Name"
          placeholderTextColor={theme.colors.textMuted}
          value={fullName}
          onChangeText={setFullName}
        />

        <TextInput
          style={styles.input}
          placeholder="Mobile Number (e.g. +1 555-0199)"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <TextInput
          style={styles.input}
          placeholder="Email Address (Optional)"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {/* Role Specific Fields */}
        {role === 'NORMAL_USER' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Blood Group (e.g. O+, A+, B-, AB+)"
              placeholderTextColor={theme.colors.textMuted}
              value={bloodGroup}
              onChangeText={setBloodGroup}
            />
            <TextInput
              style={styles.input}
              placeholder="Medical Notes / Allergies (e.g. Asthma, Penicillin)"
              placeholderTextColor={theme.colors.textMuted}
              value={medicalNotes}
              onChangeText={setMedicalNotes}
            />
          </>
        )}

        {role === 'AMBULANCE_PERSONNEL' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Paramedic License Number"
              placeholderTextColor={theme.colors.textMuted}
              value={licenseNumber}
              onChangeText={setLicenseNumber}
            />
            <TextInput
              style={styles.input}
              placeholder="Vehicle / Ambulance Unit (e.g. AMB-04)"
              placeholderTextColor={theme.colors.textMuted}
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Complete Registration</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already registered? </Text>
        <TouchableOpacity onPress={onNavigateLogin}>
          <Text style={styles.footerLink}>Sign In</Text>
        </TouchableOpacity>
      </View>
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
    paddingTop: theme.spacing.xl * 1.4,
    paddingBottom: theme.spacing.xl
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: theme.spacing.lg
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.md
  },
  roleCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border
  },
  roleCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight
  },
  roleCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginTop: 6
  },
  roleCardTitleActive: {
    color: theme.colors.primary
  },
  adminNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    gap: 8
  },
  adminNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#0369A1',
    lineHeight: 15,
    fontWeight: '600'
  },
  form: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginTop: theme.spacing.xs
  },
  submitBtnDisabled: {
    opacity: 0.6
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.xl
  },
  footerText: {
    fontSize: 13,
    color: theme.colors.textSecondary
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary
  }
});
