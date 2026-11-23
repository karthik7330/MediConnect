import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  Heart, 
  FileText, 
  ShieldCheck, 
  Save, 
  Truck, 
  Award,
  CheckCircle2
} from 'lucide-react-native';
import { theme } from '../../lib/theme';
import { supabaseAdmin } from '../../lib/supabase';
import { Profile, UserRole } from '@mediconnect/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ProfileScreenProps {
  userProfile: Profile | null;
  onBack: () => void;
  onProfileUpdated?: (updated: Profile) => void;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  userProfile,
  onBack,
  onProfileUpdated
}) => {
  const [fullName, setFullName] = useState(userProfile?.fullName || '');
  const [email, setEmail] = useState(userProfile?.email || '');
  const [bloodGroup, setBloodGroup] = useState(userProfile?.bloodGroup || 'O+');
  const [medicalNotes, setMedicalNotes] = useState(userProfile?.medicalNotes || '');
  const [saving, setSaving] = useState(false);

  const role = userProfile?.role || 'NORMAL_USER';

  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'NORMAL_USER':
        return { label: 'Citizen User', bg: '#EFF6FF', text: '#1D4ED8' };
      case 'EMERGENCY_CONTACT':
        return { label: 'Emergency Contact', bg: '#FDF4FF', text: '#9333EA' };
      case 'AMBULANCE_PERSONNEL':
        return { label: 'Ambulance Paramedic', bg: '#FEF2F2', text: '#DC2626' };
      case 'MAIN_ADMIN':
        return { label: 'Main Administrator', bg: '#FEE2E2', text: '#991B1B' };
      case 'SUB_ADMIN':
        return { label: 'Sub-Administrator', bg: '#FEF3C7', text: '#92400E' };
      default:
        return { label: String(r), bg: '#F1F5F9', text: '#475569' };
    }
  };

  const badge = getRoleBadge(role);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Please enter your full name.');
      return;
    }

    if (!userProfile?.id) {
      Alert.alert('Error', 'User record not identified.');
      return;
    }

    setSaving(true);
    try {
      const updatedProfile: Profile = {
        ...userProfile,
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        bloodGroup: bloodGroup.trim(),
        medicalNotes: medicalNotes.trim(),
        updatedAt: new Date().toISOString()
      };

      const { error } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name: updatedProfile.fullName,
          email: updatedProfile.email || null,
          blood_group: updatedProfile.bloodGroup || null,
          medical_notes: updatedProfile.medicalNotes || null,
          updated_at: updatedProfile.updatedAt
        })
        .eq('id', userProfile.id);

      if (error) throw error;

      await AsyncStorage.setItem('@mediconnect_current_user', JSON.stringify(updatedProfile));
      if (onProfileUpdated) {
        onProfileUpdated(updatedProfile);
      }

      Alert.alert('Profile Saved', 'Your medical and account details have been updated successfully.');
    } catch (err: unknown) {
      Alert.alert('Save Failed', err instanceof Error ? err.message : 'Could not save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>User Profile & Medical ID</Text>
          <Text style={styles.headerSub}>Manage your verified emergency healthcare info</Text>
        </View>
      </View>

      {/* Avatar & Role Card */}
      <View style={styles.avatarCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
        <Text style={styles.cardName}>{fullName || 'MediConnect User'}</Text>
        <Text style={styles.cardPhone}>{userProfile?.phoneNumber || 'No phone registered'}</Text>

        <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
          <ShieldCheck size={14} color={badge.text} style={{ marginRight: 4 }} />
          <Text style={[styles.roleBadgeText, { color: badge.text }]}>{badge.label}</Text>
        </View>
      </View>

      {/* Form Fields */}
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>PERSONAL ACCOUNT DETAILS</Text>

        {/* Full Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputBox}>
            <User size={18} color={theme.colors.textMuted} />
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Karthik Valli"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        </View>

        {/* Registered Mobile (Read-only) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Registered Mobile Number (System ID)</Text>
          <View style={[styles.inputBox, styles.inputDisabled]}>
            <Phone size={18} color="#94A3B8" />
            <TextInput
              style={[styles.input, { color: '#64748B' }]}
              value={userProfile?.phoneNumber || ''}
              editable={false}
            />
          </View>
        </View>

        {/* Email Address */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputBox}>
            <Mail size={18} color={theme.colors.textMuted} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="e.g. user@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        </View>
      </View>

      {/* Medical Emergency Vitals Section (For Citizens) */}
      {role === 'NORMAL_USER' && (
        <View style={styles.formSection}>
          <View style={styles.sectionTitleRow}>
            <Heart size={16} color="#DC2626" />
            <Text style={[styles.sectionTitle, { color: '#DC2626', marginBottom: 0 }]}>
              EMERGENCY MEDICAL ID (AUTONOMOUS TRIAGE)
            </Text>
          </View>
          <Text style={styles.sectionHint}>
            Shared instantly with paramedics and trauma center doctors upon SOS activation.
          </Text>

          {/* Blood Group Picker */}
          <Text style={[styles.label, { marginTop: 12 }]}>Blood Group</Text>
          <View style={styles.bloodGrid}>
            {BLOOD_GROUPS.map(bg => (
              <TouchableOpacity
                key={bg}
                style={[styles.bloodPill, bloodGroup === bg && styles.bloodPillActive]}
                onPress={() => setBloodGroup(bg)}
              >
                <Text style={[styles.bloodPillText, bloodGroup === bg && styles.bloodPillTextActive]}>
                  {bg}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Medical Notes / Allergies */}
          <View style={[styles.inputGroup, { marginTop: 14 }]}>
            <Text style={styles.label}>Medical Conditions / Allergies / Notes</Text>
            <View style={[styles.inputBox, { height: 90, alignItems: 'flex-start', paddingTop: 10 }]}>
              <FileText size={18} color={theme.colors.textMuted} style={{ marginTop: 2 }} />
              <TextInput
                style={[styles.input, { height: 75, textAlignVertical: 'top' }]}
                value={medicalNotes}
                onChangeText={setMedicalNotes}
                placeholder="e.g. Diabetic, Penicillin allergy, Asthmatic, Cardiac history"
                placeholderTextColor={theme.colors.textMuted}
                multiline
              />
            </View>
          </View>
        </View>
      )}

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.btnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Save size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>Save Profile Changes</Text>
          </View>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20
  },
  backBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A'
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  avatarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  cardName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A'
  },
  cardPhone: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 10
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700'
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 12
  },
  sectionHint: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10
  },
  inputGroup: {
    marginBottom: 14
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: '#FFFFFF',
    gap: 10
  },
  inputDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0'
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500'
  },
  bloodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4
  },
  bloodPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC'
  },
  bloodPillActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626'
  },
  bloodPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  bloodPillTextActive: {
    color: '#FFFFFF'
  },
  saveBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  },
  btnDisabled: {
    opacity: 0.6
  }
});
