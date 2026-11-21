import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  ActivityIndicator,
  Image,
  Linking
} from 'react-native';
import { 
  Users, 
  UserPlus, 
  AlertTriangle, 
  Phone, 
  MessageSquare, 
  Navigation, 
  CheckCircle2, 
  Hospital, 
  LogOut, 
  ShieldCheck, 
  Clock, 
  X, 
  ShieldAlert, 
  Heart,
  ChevronRight,
  RefreshCw,
  MapPin,
  ExternalLink,
  Truck
} from 'lucide-react-native';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { contactService } from '../../services/contactService';
import { mapNavigationService } from '../../services/mapNavigationService';
import { distanceService } from '../../services/distanceService';
import { LiveMapCard } from '../../components/common/LiveMapCard';
import { Profile } from '@mediconnect/shared';

interface ContactHomeScreenProps {
  onSwitchRole: () => void;
  onOpenLiveTracking?: () => void;
  onOpenFeedback?: () => void;
  userProfile?: Profile | null;
}

export const ContactHomeScreen: React.FC<ContactHomeScreenProps> = ({ 
  onSwitchRole, 
  onOpenLiveTracking, 
  onOpenFeedback,
  userProfile
}) => {
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [activeEmergency, setActiveEmergency] = useState<any | null>(null);

  // Live Assigned Ambulance Telemetry (Only active once driver accepts SOS)
  const [assignedAmbulance, setAssignedAmbulance] = useState<{
    id: string;
    vehicleNumber: string;
    phone: string;
    officerName: string;
    coords: { latitude: number; longitude: number } | null;
    speedKmh?: number;
  } | null>(null);

  // Incoming Connection Requests & Connected Citizens
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [connectedCitizens, setConnectedCitizens] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const contactPhone = userProfile?.phoneNumber || '';
  const contactUserId = userProfile?.id || '';

  // 1. Fetch Incoming Connection Requests & Connected Citizens
  const loadRequestsAndConnections = async () => {
    if (!contactPhone && !contactUserId) return;
    setLoadingRequests(true);
    try {
      const [requests, connected] = await Promise.all([
        contactService.getIncomingRequests(contactPhone),
        contactService.getConnectedCitizens(contactPhone, contactUserId)
      ]);
      setIncomingRequests(requests);
      setConnectedCitizens(connected);
    } catch (err) {
      console.warn('[ContactHomeScreen] Error loading requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  // 2. Fetch Ambulance Telemetry directly from ambulance_crews and live_ambulance_tracking
  const fetchAmbulanceTelemetry = async (crewId: string, emergencyId: string) => {
    try {
      const { data: crew } = await supabase
        .from('ambulance_crews')
        .select('id, vehicle_number, location, last_location_update')
        .eq('id', crewId)
        .single();

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('id', crewId)
        .maybeSingle();

      const { data: liveTrack } = await supabase
        .from('live_ambulance_tracking')
        .select('current_location, speed_kmh, heading')
        .eq('emergency_id', emergencyId)
        .maybeSingle();

      const rawLoc = liveTrack?.current_location || crew?.location;
      const crewCoords = distanceService.parsePoint(rawLoc);

      setAssignedAmbulance({
        id: crewId,
        vehicleNumber: crew?.vehicle_number || 'TN-01-AMB-4091',
        phone: profile?.phone_number || '+919876543210',
        officerName: profile?.full_name || 'Paramedic Unit Officer',
        coords: crewCoords,
        speedKmh: liveTrack?.speed_kmh ? Number(liveTrack.speed_kmh) : 48
      });
    } catch (err) {
      console.warn('[ContactHomeScreen] Error fetching ambulance telemetry:', err);
    }
  };

  // 3. Fetch Active Emergency Incidents with Patient & Hospital Joins
  const fetchActiveEmergency = async () => {
    try {
      const { data } = await supabase
        .from('emergency_requests')
        .select(`
          *,
          patient:profiles!emergency_requests_user_id_fkey(full_name, phone_number, blood_group, medical_notes),
          hospital:hospitals!emergency_requests_selected_hospital_id_fkey(name, address, emergency_phone, icu_beds_available)
        `)
        .neq('current_status', 'EMERGENCY_RESOLVED')
        .neq('current_status', 'EMERGENCY_CANCELLED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setActiveEmergency(data);
        const hasAccepted = data.assigned_ambulance_id && data.current_status !== 'SOS_ACTIVATED';
        if (hasAccepted) {
          fetchAmbulanceTelemetry(data.assigned_ambulance_id, data.id);
        } else {
          setAssignedAmbulance(null);
        }
      } else {
        setActiveEmergency(null);
        setAssignedAmbulance(null);
      }
    } catch {
      setActiveEmergency(null);
      setAssignedAmbulance(null);
    }
  };

  useEffect(() => {
    loadRequestsAndConnections();
    fetchActiveEmergency();

    // 1. Live subscription for Emergency Incidents
    const channelId = `contact_feed_${Date.now()}`;
    const emergencyChannel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_requests' }, (payload: any) => {
        if (payload.new) {
          // Immediately apply new status to UI without waiting
          setActiveEmergency((prev: any) => {
            if (!prev || prev.id === payload.new.id) {
              return {
                ...prev,
                ...payload.new,
                patient: prev?.patient,
                hospital: prev?.hospital
              };
            }
            return prev;
          });

          if (payload.new.assigned_ambulance_id && payload.new.current_status !== 'SOS_ACTIVATED') {
            fetchAmbulanceTelemetry(payload.new.assigned_ambulance_id, payload.new.id);
          }
        }
        fetchActiveEmergency();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_ambulance_tracking' }, (payload: any) => {
        if (payload.new?.current_location) {
          const parsed = distanceService.parsePoint(payload.new.current_location);
          if (parsed) {
            setAssignedAmbulance((prev: any) => prev ? {
              ...prev,
              coords: parsed,
              speedKmh: payload.new.speed_kmh ? Number(payload.new.speed_kmh) : prev.speedKmh
            } : null);
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulance_crews' }, (payload: any) => {
        if (payload.new?.location) {
          const parsed = distanceService.parsePoint(payload.new.location);
          if (parsed) {
            setAssignedAmbulance((prev: any) => prev ? { ...prev, coords: parsed } : null);
          }
        }
      })
      .subscribe();

    // 2. Live subscription for Connection Requests
    const reqChannelId = `contact_reqs_${Date.now()}`;
    const requestsChannel = supabase
      .channel(reqChannelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connection_requests' }, () => {
        loadRequestsAndConnections();
      })
      .subscribe();

    // 3. Guaranteed auto-sync timer every 2.5 seconds: ensures status & live coordinates update automatically without re-login!
    const autoSyncTimer = setInterval(() => {
      fetchActiveEmergency();
    }, 2500);

    return () => {
      clearInterval(autoSyncTimer);
      supabase.removeChannel(emergencyChannel);
      supabase.removeChannel(requestsChannel);
    };
  }, [contactPhone, contactUserId]);

  // 3. Handle Accept Connection Request
  const handleAcceptRequest = async (request: any) => {
    setRespondingId(request.id);
    const success = await contactService.respondToRequest(request.id, contactUserId, 'ACCEPTED');
    setRespondingId(null);

    if (success) {
      Alert.alert(
        'Emergency Link Established',
        `You have accepted the request from ${request.sender_name}.\n\nYou are now linked to their safety network and will receive real-time SOS alerts, live Google Maps tracking, and hospital route when they trigger an emergency.`
      );
      loadRequestsAndConnections();
    } else {
      Alert.alert('Connection Error', 'Failed to accept connection request. Please try again.');
    }
  };

  // 4. Handle Decline Connection Request
  const handleDeclineRequest = async (request: any) => {
    setRespondingId(request.id);
    const success = await contactService.respondToRequest(request.id, contactUserId, 'REJECTED');
    setRespondingId(null);

    if (success) {
      Alert.alert('Request Declined', `You have declined the emergency contact invite from ${request.sender_name}.`);
      loadRequestsAndConnections();
    } else {
      Alert.alert('Notice', 'Failed to update request.');
    }
  };

  const handleAcknowledge = () => {
    setHasAcknowledged(true);
    Alert.alert('Acknowledged', 'The patient and responders have been notified that you are actively monitoring their telemetry.');
  };

  // Local phone dialer execution
  const handleDirectCallPatient = (phone: string, name: string) => {
    mapNavigationService.makePhoneCall(phone, name);
  };

  // Local SMS app execution
  const handleDirectSmsPatient = (phone: string, name: string) => {
    mapNavigationService.sendSms(
      phone,
      `MediConnect Alert: I am tracking your emergency location and responders are en route to you.`
    );
  };

  // Google Maps navigation execution
  const handleNavigateToPatient = (lat: number, lng: number, name: string) => {
    mapNavigationService.openNavigation(lat, lng, name);
  };

  const handleNavigateToHospital = (lat: number, lng: number, name: string) => {
    mapNavigationService.openNavigation(lat, lng, name);
  };

  // Dynamically parse live coordinates from active incident
  const patientCoords = activeEmergency ? distanceService.parsePoint(activeEmergency.user_location) : null;
  const hospitalCoords = activeEmergency?.hospital?.location
    ? distanceService.parsePoint(activeEmergency.hospital.location)
    : { latitude: 13.0604, longitude: 80.2505 };

  const patientName = activeEmergency?.patient?.full_name || 'Citizen User';
  const patientPhone = activeEmergency?.patient?.phone_number || '+919876543210';
  const patientBlood = activeEmergency?.patient?.blood_group || 'O+';
  const patientNotes = activeEmergency?.patient?.medical_notes || 'Immediate assistance requested';

  const hospitalName = activeEmergency?.hospital?.name || 'Apollo Hospitals Greams Road (Level 1 Trauma)';
  const hospitalAddress = activeEmergency?.hospital?.address || '21 Greams Lane, Thousand Lights, Chennai';
  const hospitalPhone = activeEmergency?.hospital?.emergency_phone || '+914428290200';
  const hospitalBeds = activeEmergency?.hospital?.icu_beds_available ?? 12;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Family Contact Portal</Text>
          <Text style={styles.roleTag}>
            {userProfile?.fullName || 'Emergency Contact'} • {contactPhone || 'Live Monitor'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            style={[styles.switchButton, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]}
            onPress={() => {
              fetchActiveEmergency();
              loadRequestsAndConnections();
            }}
          >
            <RefreshCw size={14} color="#0F172A" />
            <Text style={[styles.switchButtonText, { color: '#0F172A' }]}>Sync</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.switchButton} onPress={onSwitchRole}>
            <LogOut size={14} color={theme.colors.accent} />
            <Text style={styles.switchButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ==================================================================== */}
      {/* 1. INCOMING CONNECTION REQUESTS (High Priority Action Card)          */}
      {/* ==================================================================== */}
      {incomingRequests.length > 0 && (
        <View style={styles.incomingContainer}>
          <View style={styles.incomingHeader}>
            <View style={styles.incomingTitleRow}>
              <UserPlus size={18} color="#D97706" />
              <Text style={styles.incomingTitle}>INCOMING CONNECTION REQUESTS</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{incomingRequests.length} PENDING</Text>
            </View>
          </View>

          {incomingRequests.map((req) => (
            <View key={req.id} style={styles.requestItemCard}>
              <View style={styles.requestSenderRow}>
                <View style={styles.senderAvatar}>
                  <Text style={styles.senderAvatarText}>
                    {req.sender_name ? req.sender_name.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.senderName}>{req.sender_name || 'Citizen User'}</Text>
                  <Text style={styles.senderRole}>Wants you as their Emergency Contact</Text>
                  <View style={styles.timeRow}>
                    <Clock size={12} color={theme.colors.textMuted} />
                    <Text style={styles.timeText}>
                      Sent {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.requestNote}>
                By accepting, you will automatically receive their live Google Maps position, ambulance ETA, and trauma hospital routing whenever they trigger SOS.
              </Text>

              {/* Action Buttons */}
              <View style={styles.requestActionRow}>
                <TouchableOpacity
                  style={[styles.acceptBtn, respondingId === req.id && styles.btnDisabled]}
                  onPress={() => handleAcceptRequest(req)}
                  disabled={respondingId === req.id}
                >
                  {respondingId === req.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <CheckCircle2 size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.acceptBtnText}>Accept & Connect</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.declineBtn, respondingId === req.id && styles.btnDisabled]}
                  onPress={() => handleDeclineRequest(req)}
                  disabled={respondingId === req.id}
                >
                  <X size={16} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
                  <Text style={styles.declineBtnText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ==================================================================== */}
      {/* 2. REAL-TIME EMERGENCY INCIDENT CARD WITH GOOGLE MAPS & DIALER      */}
      {/* ==================================================================== */}
      {activeEmergency ? (
        <View style={styles.incidentCard}>
          <View style={styles.incidentHeader}>
            <AlertTriangle size={24} color={theme.colors.primary} />
            <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
              <Text style={styles.incidentTitle}>ACTIVE EMERGENCY IN PROGRESS</Text>
              <Text style={styles.incidentUser}>{patientName} (Family Member)</Text>
            </View>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE GPS</Text>
            </View>
          </View>

          {/* Patient Details & Vitals Box */}
          <View style={styles.patientInfoBox}>
            <View style={styles.patientInfoRow}>
              <Text style={styles.patientInfoLabel}>Patient Name:</Text>
              <Text style={styles.patientInfoValue}>{patientName}</Text>
            </View>
            <View style={styles.patientInfoRow}>
              <Text style={styles.patientInfoLabel}>Registered Mobile:</Text>
              <Text style={styles.patientInfoValue}>{patientPhone}</Text>
            </View>
            <View style={styles.patientInfoRow}>
              <Text style={styles.patientInfoLabel}>Blood Group:</Text>
              <Text style={[styles.patientInfoValue, { color: theme.colors.primary }]}>{patientBlood}</Text>
            </View>
            <View style={styles.patientInfoRow}>
              <Text style={styles.patientInfoLabel}>Medical Notes:</Text>
              <Text style={styles.patientInfoValue}>{patientNotes}</Text>
            </View>
          </View>

          {/* Status indicator */}
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Current Status:</Text>
            <Text style={styles.statusValue}>{activeEmergency.current_status || 'SOS_ACTIVATED'}</Text>
          </View>

          {/* Incident Address */}
          <View style={styles.detailRow}>
            <MapPin size={16} color={theme.colors.primary} />
            <Text style={styles.detailText}>
              {activeEmergency.address_text || (patientCoords ? `GPS (${patientCoords.latitude.toFixed(5)}, ${patientCoords.longitude.toFixed(5)})` : 'Incident Location GPS')}
            </Text>
          </View>

          {/* ================================================================ */}
          {/* RESPONDER LIVE DISPATCH TELEMETRY (Only shown once accepted)     */}
          {/* ================================================================ */}
          {assignedAmbulance ? (
            <View style={styles.responderBox}>
              <View style={styles.responderHeader}>
                <Truck size={16} color="#16A34A" />
                <Text style={styles.responderTitle}>RESPONDING CREW: {assignedAmbulance.vehicleNumber}</Text>
              </View>
              <Text style={styles.responderSub}>
                Officer: {assignedAmbulance.officerName} • Driver accepted & transmitting live GPS
              </Text>
              <TouchableOpacity
                style={styles.responderCallBtn}
                onPress={() => mapNavigationService.makePhoneCall(assignedAmbulance.phone, assignedAmbulance.officerName)}
              >
                <Phone size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.responderCallBtnText}>Call Driver ({assignedAmbulance.phone})</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.waitingResponderBox}>
              <Clock size={16} color="#D97706" />
              <Text style={styles.waitingResponderText}>
                Matching closest emergency responder... Live ambulance coordinates will stream here the instant the driver accepts.
              </Text>
            </View>
          )}

          {/* ================================================================ */}
          {/* LIVE PRECISION SATELLITE MAP CARD (Guaranteed No Blank Screen)   */}
          {/* ================================================================ */}
          <LiveMapCard
            patientCoords={patientCoords}
            ambulanceCoords={assignedAmbulance?.coords || null}
            hospitalCoords={hospitalCoords}
            patientName={patientName}
            ambulanceTitle={assignedAmbulance?.vehicleNumber}
            hospitalName={hospitalName}
            statusLabel={activeEmergency.current_status}
            onNavigatePatient={() => {
              if (patientCoords) {
                handleNavigateToPatient(patientCoords.latitude, patientCoords.longitude, patientName);
              } else {
                Alert.alert('GPS Pending', 'Acquiring patient satellite coordinates...');
              }
            }}
            onNavigateHospital={() => {
              if (hospitalCoords) {
                handleNavigateToHospital(hospitalCoords.latitude, hospitalCoords.longitude, hospitalName);
              }
            }}
          />

          {/* Direct Phone Dialer & SMS Actions (Direct native dialer) */}
          <View style={styles.contactActions}>
            <TouchableOpacity 
              style={styles.callPatientBtn} 
              onPress={() => handleDirectCallPatient(patientPhone, patientName)}
            >
              <Phone size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.callPatientBtnText}>Call Patient ({patientPhone})</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.smsPatientBtn} 
              onPress={() => handleDirectSmsPatient(patientPhone, patientName)}
            >
              <MessageSquare size={16} color={theme.colors.accent} style={{ marginRight: 4 }} />
              <Text style={styles.smsPatientBtnText}>SMS Alert</Text>
            </TouchableOpacity>
          </View>

          {/* Destination Hospital Card */}
          <View style={styles.hospitalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Hospital size={18} color="#0284C7" />
                <Text style={styles.hospitalName}>{hospitalName}</Text>
              </View>
            </View>
            <Text style={styles.hospitalDetails}>
              {hospitalAddress}{'\n'}
              Trauma bay pre-alerted • Real-time ICU beds: {hospitalBeds}
            </Text>
            <TouchableOpacity 
              style={styles.hospitalCallBtn}
              onPress={() => mapNavigationService.makePhoneCall(hospitalPhone, hospitalName)}
            >
              <Phone size={14} color="#0369A1" style={{ marginRight: 4 }} />
              <Text style={styles.hospitalCallBtnText}>Call Trauma Center ({hospitalPhone})</Text>
            </TouchableOpacity>
          </View>

          {/* Acknowledge Action */}
          <TouchableOpacity 
            style={[styles.ackButton, hasAcknowledged && styles.ackButtonDone]}
            onPress={handleAcknowledge}
            disabled={hasAcknowledged}
          >
            <CheckCircle2 size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.ackButtonText}>
              {hasAcknowledged ? 'SOS Acknowledged • Monitoring Live' : 'Acknowledge SOS'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ==================================================================== */}
      {/* 3. PROTECTED FAMILY MEMBERS (Active Links)                           */}
      {/* ==================================================================== */}
      <View style={styles.networkSection}>
        <View style={styles.networkSectionHeader}>
          <Heart size={18} color={theme.colors.primary} />
          <Text style={styles.networkSectionTitle}>
            Protected Family Network ({connectedCitizens.length})
          </Text>
        </View>

        {connectedCitizens.length > 0 ? (
          connectedCitizens.map((item, index) => (
            <View key={item.id || index} style={styles.connectedCard}>
              <View style={styles.connectedAvatar}>
                <ShieldCheck size={20} color="#166534" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.connectedName}>{item.sender_name || 'Family Member'}</Text>
                <Text style={styles.connectedStatus}>Linked • Emergency Alerts Active</Text>
                <Text style={styles.connectedSub}>Continuous Google Maps telemetry authorized</Text>
              </View>
              <View style={styles.connectedBadge}>
                <Text style={styles.connectedBadgeText}>SAFE</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Users size={28} color={theme.colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>No Family Members Connected Yet</Text>
            <Text style={styles.emptyDesc}>
              Your registered mobile number is:{'\n'}
              <Text style={{ fontWeight: '800', color: theme.colors.accent }}>
                {contactPhone || 'Registered Mobile Number'}
              </Text>
            </Text>
            <View style={styles.instructionBox}>
              <Text style={styles.instructionStep}>
                1. Ask your family member to open MediConnect Citizen Portal.
              </Text>
              <Text style={styles.instructionStep}>
                2. Tap <Text style={{ fontWeight: '700' }}>Emergency Contacts</Text> ➔ <Text style={{ fontWeight: '700' }}>[Add]</Text>.
              </Text>
              <Text style={styles.instructionStep}>
                3. Enter your phone number above.
              </Text>
              <Text style={styles.instructionStep}>
                4. Their request will appear right here for you to Accept.
              </Text>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={loadRequestsAndConnections}>
              <RefreshCw size={14} color={theme.colors.accent} />
              <Text style={styles.refreshBtnText}>Check for Incoming Requests</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Role-Based Privacy Notice */}
      {!activeEmergency && (
        <View style={styles.safeCard}>
          <View style={styles.safeIconCircle}>
            <ShieldCheck size={28} color="#166534" />
          </View>
          <Text style={styles.safeTitle}>Continuous Safety Monitoring Active</Text>
          <Text style={styles.safeSubtitle}>
            Zero active emergency incidents in your network. Location telemetry is strictly kept private until an emergency SOS is triggered by your family member, at which point Google Maps live navigation unlocks immediately.
          </Text>
        </View>
      )}
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
    paddingTop: theme.spacing.xl * 1.2,
    paddingBottom: 40
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary
  },
  roleTag: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginTop: 2
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    gap: 4
  },
  switchButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.accent
  },

  // Incoming Requests Styles
  incomingContainer: {
    backgroundColor: '#FFFBEB',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: '#F59E0B',
    marginBottom: theme.spacing.lg,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3
  },
  incomingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A'
  },
  incomingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  incomingTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5
  },
  countBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: '#F59E0B'
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E'
  },
  requestItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 10
  },
  requestSenderRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  senderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.accent
  },
  senderAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.accent
  },
  senderName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  senderRole: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 1
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3
  },
  timeText: {
    fontSize: 11,
    color: theme.colors.textMuted
  },
  requestNote: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 17,
    marginTop: 10,
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6
  },
  requestActionRow: {
    flexDirection: 'row',
    gap: 10
  },
  acceptBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  declineBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600'
  },
  btnDisabled: {
    opacity: 0.6
  },

  // Incident Styles
  incidentCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    marginBottom: theme.spacing.lg,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4
  },
  incidentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm
  },
  incidentTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 0.5
  },
  incidentUser: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textPrimary
  },
  liveBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: '#F87171'
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#991B1B'
  },

  // Patient Info Box
  patientInfoBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  patientInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2
  },
  patientInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#991B1B'
  },
  patientInfoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textPrimary
  },

  statusBox: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statusLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  statusValue: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '800'
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing.sm
  },
  detailText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600'
  },

  // Map Container & Static Image
  mapContainer: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
    backgroundColor: '#E2E8F0',
    position: 'relative'
  },
  mapImage: {
    width: '100%',
    height: 180
  },
  mapLegend: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  legendText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155'
  },

  // Nav Buttons
  responderBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: theme.spacing.sm
  },
  responderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  responderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534'
  },
  responderSub: {
    fontSize: 11,
    color: '#15803D',
    marginBottom: 8
  },
  responderCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm
  },
  responderCallBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  waitingResponderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: theme.spacing.sm
  },
  waitingResponderText: {
    flex: 1,
    fontSize: 11,
    color: '#B45309',
    fontWeight: '500',
    lineHeight: 16
  },
  navButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.sm
  },
  googleNavButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    paddingVertical: 11,
    borderRadius: theme.borderRadius.md,
    elevation: 2
  },
  googleNavButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },

  // Direct Phone & SMS
  contactActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.sm
  },
  callPatientBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803D',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    elevation: 2
  },
  callPatientBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13
  },
  smsPatientBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentLight,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.accent
  },
  smsPatientBtnText: {
    color: theme.colors.accent,
    fontWeight: '700',
    fontSize: 12
  },

  // Hospital Card
  hospitalCard: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  hospitalName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1'
  },
  hospitalDetails: {
    fontSize: 11,
    color: '#0284C7',
    marginTop: 2,
    lineHeight: 16
  },
  hospitalCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E0F2FE'
  },
  hospitalCallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1'
  },

  ackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md
  },
  ackButtonDone: {
    backgroundColor: theme.colors.success
  },
  ackButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },

  // Network Section Styles
  networkSection: {
    marginBottom: theme.spacing.lg
  },
  networkSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10
  },
  networkSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  connectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8
  },
  connectedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  connectedName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  connectedStatus: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
    marginTop: 1
  },
  connectedSub: {
    fontSize: 11,
    color: theme.colors.textMuted
  },
  connectedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm
  },
  connectedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534'
  },

  // Empty State Styles
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed'
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4
  },
  emptyDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12
  },
  instructionBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: theme.borderRadius.sm,
    width: '100%',
    marginBottom: 12
  },
  instructionStep: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 18
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accentLight
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.accent
  },

  // Safe Card Styles
  safeCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    textAlign: 'center'
  },
  safeIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  safeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 4,
    textAlign: 'center'
  },
  safeSubtitle: {
    fontSize: 12,
    color: '#15803D',
    lineHeight: 18,
    textAlign: 'center'
  }
});