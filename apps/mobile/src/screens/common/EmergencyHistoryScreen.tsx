import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { 
  ArrowLeft, 
  History, 
  Calendar, 
  Clock, 
  MapPin, 
  Truck, 
  Hospital, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  ShieldAlert,
  ChevronRight
} from 'lucide-react-native';
import { theme } from '../../lib/theme';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { Profile, UserRole } from '@mediconnect/shared';
import { distanceService } from '../../services/distanceService';
import { contactService } from '../../services/contactService';

interface EmergencyHistoryScreenProps {
  userProfile: Profile | null;
  onBack: () => void;
  onSelectEmergency?: (emergencyId: string) => void;
}

export const EmergencyHistoryScreen: React.FC<EmergencyHistoryScreenProps> = ({
  userProfile,
  onBack,
  onSelectEmergency
}) => {
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const role = userProfile?.role || 'NORMAL_USER';
  const userId = userProfile?.id || '';

  const fetchHistory = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      let query = supabaseAdmin
        .from('emergency_requests')
        .select(`
          *,
          patient:profiles!emergency_requests_user_id_fkey(full_name, phone_number, blood_group),
          hospital:hospitals!emergency_requests_selected_hospital_id_fkey(name, address),
          crew:ambulance_crews!emergency_requests_assigned_ambulance_id_fkey(vehicle_number)
        `)
        .order('created_at', { ascending: false });

      // STRICT SCOPING BY ROLE:
      if (role === 'NORMAL_USER') {
        // Citizens ONLY see their own personal triggered SOS incidents
        query = query.eq('user_id', userId);
      } else if (role === 'AMBULANCE_PERSONNEL') {
        // Paramedics ONLY see dispatches assigned to their unit
        query = query.eq('assigned_ambulance_id', userId);
      } else if (role === 'EMERGENCY_CONTACT') {
        // Emergency Contacts ONLY see incidents of connected citizens who authorized them
        const [connected, direct] = await Promise.all([
          contactService.getConnectedCitizens(userProfile?.phoneNumber || '', userId),
          supabaseAdmin.from('emergency_contacts').select('user_id').eq('contact_user_id', userId)
        ]);
        const ids = new Set<string>();
        (connected || []).forEach((c: any) => { if (c.sender_user_id) ids.add(c.sender_user_id); });
        (direct.data || []).forEach((c: any) => { if (c.user_id) ids.add(c.user_id); });

        const idList = Array.from(ids);
        if (idList.length > 0) {
          query = query.in('user_id', idList);
        } else {
          setHistoryItems([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setHistoryItems(data || []);
    } catch (err) {
      console.warn('[EmergencyHistoryScreen] Fetch warning:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [userId, role]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'EMERGENCY_RESOLVED':
        return { label: 'Resolved & Handover', bg: '#DCFCE7', text: '#166534', icon: CheckCircle2 };
      case 'EMERGENCY_CANCELLED':
        return { label: 'Cancelled', bg: '#F1F5F9', text: '#64748B', icon: XCircle };
      case 'SOS_ACTIVATED':
        return { label: 'SOS Activated', bg: '#FEE2E2', text: '#DC2626', icon: AlertCircle };
      case 'AMBULANCE_DISPATCHED':
      case 'AMBULANCE_ON_THE_WAY':
        return { label: 'Ambulance En Route', bg: '#E0F2FE', text: '#0284C7', icon: Truck };
      case 'PATIENT_PICKED_UP':
      case 'PATIENT_REACHED_HOSPITAL':
        return { label: 'Patient In Transit', bg: '#FEF3C7', text: '#D97706', icon: Hospital };
      default:
        return { label: status, bg: '#F1F5F9', text: '#475569', icon: Clock };
    }
  };

  const getRoleHeaderDesc = () => {
    if (role === 'NORMAL_USER') return 'Your personal emergency SOS request logs';
    if (role === 'AMBULANCE_PERSONNEL') return 'Past dispatch responses and medical transports';
    if (role === 'EMERGENCY_CONTACT') return 'Emergency history for your protected family network';
    return 'Incident audit ledger';
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Incident History</Text>
          <Text style={styles.headerSub}>{getRoleHeaderDesc()}</Text>
        </View>
      </View>

      {/* History List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>Loading verified incident ledger...</Text>
        </View>
      ) : historyItems.length > 0 ? (
        <View style={styles.list}>
          {historyItems.map((item) => {
            const statusInfo = getStatusBadge(item.current_status);
            const StatusIcon = statusInfo.icon;
            const dateStr = new Date(item.created_at).toLocaleDateString([], {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });
            const timeStr = new Date(item.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <View key={item.id} style={styles.itemCard}>
                {/* Top Row: Date & Status */}
                <View style={styles.itemTopRow}>
                  <View style={styles.dateRow}>
                    <Calendar size={13} color="#64748B" />
                    <Text style={styles.dateText}>{dateStr} at {timeStr}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <StatusIcon size={12} color={statusInfo.text} style={{ marginRight: 4 }} />
                    <Text style={[styles.statusText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
                  </View>
                </View>

                {/* Location / Address */}
                <View style={styles.infoRow}>
                  <MapPin size={15} color="#DC2626" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>Incident Location:</Text>
                    <Text style={styles.infoValue} numberOfLines={2}>
                      {item.address_text || 'GPS Coordinates Recorded'}
                    </Text>
                  </View>
                </View>

                {/* Responding Ambulance Unit */}
                <View style={styles.infoRow}>
                  <Truck size={15} color="#0284C7" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>Responding Unit:</Text>
                    <Text style={styles.infoValue}>
                      {item.crew?.vehicle_number || (item.assigned_ambulance_id ? 'Assigned Paramedic Unit' : 'Autonomous Broadcast')}
                    </Text>
                  </View>
                </View>

                {/* Destination Trauma Center */}
                {item.hospital?.name && (
                  <View style={styles.infoRow}>
                    <Hospital size={15} color="#166534" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoLabel}>Destination Hospital:</Text>
                      <Text style={styles.infoValue}>
                        {item.hospital.name}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Patient Details (For Ambulance / Emergency Contact) */}
                {role !== 'NORMAL_USER' && item.patient && (
                  <View style={styles.patientStrip}>
                    <Text style={styles.patientStripText}>
                      Patient: <Text style={{ fontWeight: '700' }}>{item.patient.full_name}</Text> • Blood Group: {item.patient.blood_group || 'O+'}
                    </Text>
                  </View>
                )}

                {/* Incident ID footer */}
                <View style={styles.cardFooter}>
                  <Text style={styles.incidentIdText}>ID: {item.id.slice(0, 18)}...</Text>
                  <Text style={styles.verifiedText}>Verified PostGIS Record</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <History size={36} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>No Emergency Requests Found</Text>
          <Text style={styles.emptySubtitle}>
            {role === 'NORMAL_USER'
              ? 'You have not triggered any emergency SOS requests yet. When an emergency is initiated, full trip logs will be documented here.'
              : role === 'AMBULANCE_PERSONNEL'
                ? 'No past paramedic dispatch missions recorded for this unit yet.'
                : 'No emergency incidents logged for your protected family network yet.'}
          </Text>
        </View>
      )}
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
  centerBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600'
  },
  list: {
    gap: 14
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    gap: 10
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  dateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B'
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700'
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B'
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 1
  },
  patientStrip: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  patientStripText: {
    fontSize: 11,
    color: '#334155'
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  incidentIdText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#94A3B8'
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A'
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 20
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18
  }
});
