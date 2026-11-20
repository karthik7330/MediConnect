import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, Modal, ActivityIndicator } from 'react-native';
import { Users, UserPlus, Phone, CheckCircle2, XCircle, Clock, ArrowLeft, RefreshCw, Heart } from 'lucide-react-native';
import { theme } from '../../lib/theme';
import { contactService } from '../../services/contactService';
import { Profile } from '@mediconnect/shared';
import { supabase } from '../../lib/supabase';

interface EmergencyContactsScreenProps {
  onBack: () => void;
  userProfile?: Profile | null;
}

export const EmergencyContactsScreen: React.FC<EmergencyContactsScreenProps> = ({ onBack, userProfile }) => {
  const currentUserId = userProfile?.id || '44444444-4444-4444-4444-444444444444';
  const currentUserName = userProfile?.fullName || 'Citizen User';

  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRel, setNewRel] = useState('Family');
  const [sending, setSending] = useState(false);

  // Fetch sent requests and contacts
  const loadContacts = async () => {
    setLoading(true);
    const sent = await contactService.getSentRequests(currentUserId);
    setContacts(sent);
    setLoading(false);
  };

  useEffect(() => {
    loadContacts();

    // Listen for live acceptance updates via Supabase
    const channel = supabase
      .channel('citizen_contacts_channel')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'connection_requests',
        filter: `sender_user_id=eq.${currentUserId}`
      }, () => {
        loadContacts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const handleSendRequest = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      Alert.alert('Required Fields', 'Please enter both full name and valid mobile number of your emergency contact.');
      return;
    }

    setSending(true);
    const result = await contactService.sendConnectionRequest(currentUserId, currentUserName, newPhone.trim());
    setSending(false);

    if (result.success && result.request) {
      setNewName('');
      setNewPhone('');
      setModalVisible(false);
      loadContacts();

      Alert.alert(
        'Connection Request Dispatched',
        `An emergency contact link has been sent to ${newPhone.trim()}.\n\nWhen they sign in to the Family Contact Portal on their device with this phone number, they will see your request to Accept.`
      );
    } else {
      Alert.alert('Error', result.error || 'Failed to send connection request.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency Contacts</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <UserPlus size={18} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoBanner}>
          <Text style={styles.sectionSubtitle}>
            These registered family contacts will automatically receive your live GPS coordinates, ambulance ETA, and hospital route the moment you press SOS.
          </Text>
        </View>

        <View style={styles.listHeaderRow}>
          <Text style={styles.listHeader}>LINKED CONTACTS ({contacts.length})</Text>
          <TouchableOpacity onPress={loadContacts} style={styles.refreshBtn}>
            <RefreshCw size={14} color={theme.colors.primary} />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20 }} />
        ) : contacts.length > 0 ? (
          <View style={styles.list}>
            {contacts.map(item => (
              <View key={item.id} style={styles.contactCard}>
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Users size={20} color={theme.colors.accent} />
                  </View>
                  <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                    <Text style={styles.contactName}>{item.recipient_phone}</Text>
                    <Text style={styles.contactRel}>
                      Recipient Phone: {item.recipient_phone}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusBadge, 
                    item.status === 'ACCEPTED' ? styles.statusAccepted : 
                    item.status === 'REJECTED' ? styles.statusRejected : styles.statusPending
                  ]}>
                    {item.status === 'ACCEPTED' ? (
                      <CheckCircle2 size={12} color="#15803D" />
                    ) : item.status === 'REJECTED' ? (
                      <XCircle size={12} color="#DC2626" />
                    ) : (
                      <Clock size={12} color="#D97706" />
                    )}
                    <Text style={[
                      styles.statusBadgeText,
                      item.status === 'ACCEPTED' ? styles.statusTextAccepted : 
                      item.status === 'REJECTED' ? styles.statusTextRejected : styles.statusTextPending
                    ]}>
                      {item.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBottom}>
                  <Text style={styles.statusDescription}>
                    {item.status === 'ACCEPTED' 
                      ? '✓ Fully Linked: Will receive instantaneous alert during SOS' 
                      : item.status === 'REJECTED' 
                      ? '✕ Invitation was rejected by recipient' 
                      : '⏳ Invitation Pending: Waiting for family member to accept in their Contact Portal'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Users size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No Emergency Contacts Added</Text>
            <Text style={styles.emptyDesc}>
              Tap the "+ Add" button above to add family members or close friends who should receive emergency notifications.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add Contact Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Emergency Contact</Text>
            <Text style={styles.modalSubtitle}>
              Enter your family member's phone number. They must accept your invite in their Emergency Contact Portal.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Contact Full Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Sarah Jenkins"
                placeholderTextColor={theme.colors.textMuted}
                value={newName}
                onChangeText={setNewName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mobile Phone Number</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. +91 98765 43212"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="phone-pad"
                value={newPhone}
                onChangeText={setNewPhone}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Relationship</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Parent, Spouse, Sibling"
                placeholderTextColor={theme.colors.textMuted}
                value={newRel}
                onChangeText={setNewRel}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, sending && { opacity: 0.6 }]}
                onPress={handleSendRequest}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Send Invite</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl * 1.5,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  backBtn: {
    padding: 6
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  content: {
    padding: theme.spacing.lg
  },
  infoBanner: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16
  },
  sectionSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  listHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: theme.colors.textMuted
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary
  },
  list: {
    gap: 12
  },
  contactCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  contactName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  contactRel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 1
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  statusAccepted: {
    backgroundColor: '#DCFCE7'
  },
  statusPending: {
    backgroundColor: '#FEF3C7'
  },
  statusRejected: {
    backgroundColor: '#FEE2E2'
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800'
  },
  statusTextAccepted: {
    color: '#15803D'
  },
  statusTextPending: {
    color: '#B45309'
  },
  statusTextRejected: {
    color: '#DC2626'
  },
  cardBottom: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  statusDescription: {
    fontSize: 11,
    color: theme.colors.textMuted
  },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    padding: 32,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    textAlign: 'center',
    marginTop: 20
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginTop: 12,
    marginBottom: 4
  },
  emptyDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 240
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
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.lg,
    padding: 20
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 4
  },
  modalSubtitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 16
  },
  inputGroup: {
    marginBottom: 12
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    color: theme.colors.textPrimary
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12
  },
  cancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary
  },
  submitBtn: {
    flex: 1,
    height: 42,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  submitBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
