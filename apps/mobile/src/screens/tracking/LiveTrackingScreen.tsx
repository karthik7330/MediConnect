import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { ArrowLeft, Navigation, ShieldCheck, Hospital, Phone, Radio, ExternalLink, MapPin, CheckCircle2 } from 'lucide-react-native';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { STATUS_LABELS, EmergencyStatus } from '@mediconnect/shared';
import { mapNavigationService } from '../../services/mapNavigationService';
import { distanceService } from '../../services/distanceService';
import { backgroundLocationService } from '../../services/backgroundLocationService';
import { LiveMapCard } from '../../components/common/LiveMapCard';

interface LiveTrackingScreenProps {
  emergencyId: string;
  userRole: 'NORMAL_USER' | 'EMERGENCY_CONTACT' | 'AMBULANCE_PERSONNEL';
  onBack: () => void;
}

export const LiveTrackingScreen: React.FC<LiveTrackingScreenProps> = ({ emergencyId, userRole, onBack }) => {
  const [currentStatus, setCurrentStatus] = useState<EmergencyStatus>('AMBULANCE_ON_THE_WAY');
  const [ambulanceSpeed, setAmbulanceSpeed] = useState(48);
  const [patientCoords, setPatientCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [ambulanceCoords, setAmbulanceCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [patientName, setPatientName] = useState('Citizen User');
  const [assignedCrewId, setAssignedCrewId] = useState<string | null>(null);

  const [hospitalInfo, setHospitalInfo] = useState({
    name: 'Apollo Hospitals Greams Road (Level 1 Trauma)',
    address: '21 Greams Lane, Thousand Lights, Chennai',
    phone: '+914428290200',
    beds: 12,
    coords: { latitude: 13.0604, longitude: 80.2505 }
  });

  // Calculate live geodesic distance using Haversine algorithm
  const distanceKm = patientCoords && ambulanceCoords
    ? distanceService.calculateDistanceKm(patientCoords, ambulanceCoords)
    : 0;
  const etaMinutes = distanceKm > 0
    ? distanceService.calculateEtaMinutes(distanceKm, ambulanceSpeed)
    : 0;

  // 1. Fetch active emergency details and real coordinates
  useEffect(() => {
    const fetchIncident = async () => {
      try {
        const { data, error } = await supabase
          .from('emergency_requests')
          .select(`
            *,
            patient:profiles!emergency_requests_user_id_fkey(full_name),
            hospital:hospitals!emergency_requests_selected_hospital_id_fkey(name, address, emergency_phone, icu_beds_available, location)
          `)
          .eq('id', emergencyId)
          .single();

        if (!error && data) {
          if (data.current_status) setCurrentStatus(data.current_status);
          if (data.patient?.full_name) setPatientName(data.patient.full_name);
          if (data.assigned_ambulance_id) setAssignedCrewId(data.assigned_ambulance_id);

          const parsedPatient = distanceService.parsePoint(data.user_location);
          if (parsedPatient) setPatientCoords(parsedPatient);

          if (data.hospital) {
            const parsedHosp = distanceService.parsePoint(data.hospital.location);
            setHospitalInfo({
              name: data.hospital.name || 'Apollo Hospitals Greams Road',
              address: data.hospital.address || '21 Greams Lane, Thousand Lights, Chennai',
              phone: data.hospital.emergency_phone || '+914428290200',
              beds: data.hospital.icu_beds_available ?? 12,
              coords: parsedHosp || { latitude: 13.0604, longitude: 80.2505 }
            });
          }

          // If ambulance accepted, fetch real ambulance coordinates
          if (data.assigned_ambulance_id && data.current_status !== 'SOS_ACTIVATED') {
            fetchAmbulanceLivePosition(data.assigned_ambulance_id, data.id);
          }
        }
      } catch (err) {
        console.warn('[LiveTrackingScreen] fetch incident error:', err);
      }
    };

    const fetchAmbulanceLivePosition = async (crewId: string, emgId: string) => {
      try {
        const { data: track } = await supabase
          .from('live_ambulance_tracking')
          .select('current_location, speed_kmh')
          .eq('emergency_id', emgId)
          .maybeSingle();

        if (track?.current_location) {
          const parsed = distanceService.parsePoint(track.current_location);
          if (parsed) setAmbulanceCoords(parsed);
          if (track.speed_kmh) setAmbulanceSpeed(Math.round(Number(track.speed_kmh)));
          return;
        }

        const { data: crew } = await supabase
          .from('ambulance_crews')
          .select('location')
          .eq('id', crewId)
          .single();

        if (crew?.location) {
          const parsed = distanceService.parsePoint(crew.location);
          if (parsed) setAmbulanceCoords(parsed);
        }
      } catch (err) {
        console.warn('[LiveTrackingScreen] fetch crew location error:', err);
      }
    };

    fetchIncident();

    // 2. Real-time updates subscription
    const emgSub = supabase
      .channel(`tracking_emg_${emergencyId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'emergency_requests',
        filter: `id=eq.${emergencyId}`
      }, (payload) => {
        if (payload.new) {
          if (payload.new.current_status) setCurrentStatus(payload.new.current_status);
          const pCoords = distanceService.parsePoint(payload.new.user_location);
          if (pCoords) setPatientCoords(pCoords);
          if (payload.new.assigned_ambulance_id) {
            setAssignedCrewId(payload.new.assigned_ambulance_id);
            if (payload.new.current_status !== 'SOS_ACTIVATED') {
              fetchAmbulanceLivePosition(payload.new.assigned_ambulance_id, emergencyId);
            }
          }
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_ambulance_tracking',
        filter: `emergency_id=eq.${emergencyId}`
      }, (payload: any) => {
        if (payload.new?.current_location) {
          const parsed = distanceService.parsePoint(payload.new.current_location);
          if (parsed) setAmbulanceCoords(parsed);
          if (payload.new.speed_kmh) setAmbulanceSpeed(Math.round(Number(payload.new.speed_kmh)));
        }
      })
      .subscribe();

    // 3. Continuous device GPS watcher for the local role
    let locationWatcher: any;
    backgroundLocationService.watchForegroundPosition((loc) => {
      const livePoint = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      if (userRole === 'AMBULANCE_PERSONNEL') {
        setAmbulanceCoords(livePoint);
        if (loc.coords.speed) setAmbulanceSpeed(Math.round(loc.coords.speed * 3.6));
      } else {
        setPatientCoords(livePoint);
      }
    }).then(sub => {
      locationWatcher = sub;
    }).catch(err => {
      console.warn('[LiveTrackingScreen] watchPosition error:', err);
    });

    return () => {
      supabase.removeChannel(emgSub);
      if (locationWatcher?.remove) locationWatcher.remove();
    };
  }, [emergencyId, userRole]);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle}>Google Maps Live Navigation</Text>
          <Text style={styles.headerSubtitle}>ID: {emergencyId} • Active Telemetry</Text>
        </View>
        <View style={styles.liveIndicator}>
          <Radio size={14} color="#16A34A" />
          <Text style={styles.liveText}>GPS LIVE</Text>
        </View>
      </View>

      {/* Live Precision Satellite Map Canvas */}
      <View style={{ paddingHorizontal: 16 }}>
        <LiveMapCard
          patientCoords={patientCoords}
          ambulanceCoords={ambulanceCoords}
          hospitalCoords={hospitalInfo.coords}
          patientName={patientName}
          ambulanceTitle="Ambulance Unit"
          hospitalName={hospitalInfo.name}
          statusLabel={STATUS_LABELS[currentStatus]}
          onNavigatePatient={() => {
            if (patientCoords) {
              mapNavigationService.openNavigation(patientCoords.latitude, patientCoords.longitude, patientName);
            }
          }}
          onNavigateHospital={() => {
            mapNavigationService.openNavigation(hospitalInfo.coords.latitude, hospitalInfo.coords.longitude, hospitalInfo.name);
          }}
        />
      </View>

      {/* Bottom Live Metrics & Progression Details */}
      <ScrollView style={styles.metricsContainer}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusHeading}>DISPATCH STATUS SEQUENCE</Text>
          <Text style={styles.statusTitle}>{STATUS_LABELS[currentStatus]}</Text>
          
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Distance</Text>
              <Text style={styles.metricValue}>{distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : 'Calculating...'}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Estimated Arrival</Text>
              <Text style={styles.metricValue}>{etaMinutes > 0 ? `${etaMinutes} min` : (ambulanceCoords ? '< 1 min' : 'Waiting...')}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Speed</Text>
              <Text style={styles.metricValue}>{ambulanceCoords ? `${ambulanceSpeed} km/h` : '0 km/h'}</Text>
            </View>
          </View>
        </View>

        {/* Destination Hospital Information */}
        <View style={styles.hospitalInfoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Hospital size={20} color="#0284C7" />
            <View style={{ flex: 1 }}>
              <Text style={styles.hospTitle}>{hospitalInfo.name}</Text>
              <Text style={styles.hospAddress}>{hospitalInfo.address} • {hospitalInfo.beds} ICU Beds</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.hospCallBtn}
            onPress={() => mapNavigationService.makePhoneCall(hospitalInfo.phone, hospitalInfo.name)}
          >
            <Phone size={14} color="#0369A1" style={{ marginRight: 6 }} />
            <Text style={styles.hospCallBtnText}>Call Trauma Bay ({hospitalInfo.phone})</Text>
          </TouchableOpacity>
        </View>

        {/* Role-Specific Direct Dialer Actions */}
        <View style={styles.actionSection}>
          <TouchableOpacity 
            style={styles.callHotlineBtn}
            onPress={() => mapNavigationService.makePhoneCall('108', 'Emergency Ambulance Dispatch')}
          >
            <Phone size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.callHotlineBtnText}>Call National Emergency (108 / 112)</Text>
          </TouchableOpacity>
        </View>

        {/* Privacy Guard Notice */}
        <View style={styles.privacyShield}>
          <ShieldCheck size={14} color="#0369A1" />
          <Text style={styles.privacyShieldText}>
            Google Maps live telemetry is cryptographically restricted to the assigned crew and pre-authorized family contacts during this active incident only.
          </Text>
        </View>
      </ScrollView>
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
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xl * 1.2,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  backBtn: {
    padding: theme.spacing.sm
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary
  },
  headerSubtitle: {
    fontSize: 11,
    color: theme.colors.textSecondary
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534'
  },
  mapArea: {
    height: 240,
    backgroundColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden'
  },
  mapImage: {
    width: '100%',
    height: '100%'
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
  floatingSpeedTag: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full
  },
  floatingSpeedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  quickNavRow: {
    flexDirection: 'row',
    gap: 8,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  googleNavButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    elevation: 2
  },
  googleNavButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  hospitalNavButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0369A1',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md
  },
  hospitalNavButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  metricsContainer: {
    flex: 1,
    padding: theme.spacing.md
  },
  statusCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md
  },
  statusHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 0.5
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: 2,
    marginBottom: theme.spacing.md
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md
  },
  metricItem: {
    flex: 1,
    alignItems: 'center'
  },
  metricLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginTop: 2
  },
  metricDivider: {
    width: 1,
    backgroundColor: theme.colors.border
  },
  hospitalInfoCard: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  hospTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1'
  },
  hospAddress: {
    fontSize: 11,
    color: '#0284C7',
    marginTop: 2
  },
  hospCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#BAE6FD'
  },
  hospCallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1'
  },
  actionSection: {
    marginBottom: theme.spacing.md
  },
  callHotlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803D',
    paddingVertical: 13,
    borderRadius: theme.borderRadius.md,
    elevation: 2
  },
  callHotlineBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13
  },
  privacyShield: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 40
  },
  privacyShieldText: {
    fontSize: 11,
    color: '#0369A1',
    flex: 1,
    lineHeight: 16
  }
});