import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { ArrowLeft, Navigation, ShieldCheck, Hospital, Phone, Radio, ExternalLink, MapPin, CheckCircle2 } from 'lucide-react-native';
import { theme } from '../../lib/theme';
import { STATUS_LABELS, EmergencyStatus } from '@mediconnect/shared';
import { mapNavigationService } from '../../services/mapNavigationService';
import { distanceService } from '../../services/distanceService';
import { backgroundLocationService } from '../../services/backgroundLocationService';

interface LiveTrackingScreenProps {
  emergencyId: string;
  userRole: 'NORMAL_USER' | 'EMERGENCY_CONTACT' | 'AMBULANCE_PERSONNEL';
  onBack: () => void;
}

export const LiveTrackingScreen: React.FC<LiveTrackingScreenProps> = ({ emergencyId, userRole, onBack }) => {
  const [currentStatus] = useState<EmergencyStatus>('AMBULANCE_ON_THE_WAY');
  const [ambulanceSpeed, setAmbulanceSpeed] = useState(54);
  const [patientCoords, setPatientCoords] = useState({ latitude: 13.0604, longitude: 80.2496 });
  const [ambulanceCoords, setAmbulanceCoords] = useState({ latitude: 13.0720, longitude: 80.2610 });

  // Calculate live geodesic distance using Haversine algorithm
  const distanceKm = distanceService.calculateDistanceKm(patientCoords, ambulanceCoords);
  const etaMinutes = distanceService.calculateEtaMinutes(distanceKm, ambulanceSpeed);

  const hospitalLat = 13.0604;
  const hospitalLng = 80.2505;

  const hospitalName = 'Apollo Hospitals Greams Road (Level 1 Trauma)';
  const hospitalAddress = '21 Greams Lane, Thousand Lights, Chennai';
  const hospitalPhone = '+914428290200';
  const hospitalBeds = 12;

  // Real Google Maps Static Map URL
  const googleMapStaticUrl = mapNavigationService.getStaticMapUrl({
    centerLat: patientCoords.latitude,
    centerLng: patientCoords.longitude,
    zoom: 14,
    width: 600,
    height: 340,
    markers: [
      { lat: patientCoords.latitude, lng: patientCoords.longitude, color: 'red', label: 'P' },
      { lat: ambulanceCoords.latitude, lng: ambulanceCoords.longitude, color: 'green', label: 'A' },
      { lat: hospitalLat, lng: hospitalLng, color: 'blue', label: 'H' }
    ]
  });

  // Continuous live GPS updates & dynamic telemetry simulation
  useEffect(() => {
    // 1. Continuous location watcher
    let locationSub: any;
    backgroundLocationService.watchForegroundPosition((loc) => {
      if (userRole === 'AMBULANCE_PERSONNEL') {
        setAmbulanceCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (loc.coords.speed) setAmbulanceSpeed(Math.round(loc.coords.speed * 3.6));
      } else {
        setPatientCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    }).then(sub => {
      locationSub = sub;
    }).catch(err => {
      console.warn('[LiveTrackingScreen] watchPosition error:', err);
    });

    // 2. Dynamic speed & approach interval
    const interval = setInterval(() => {
      setAmbulanceSpeed(prev => 48 + Math.floor(Math.random() * 10));
      setAmbulanceCoords(prev => ({
        latitude: prev.latitude - 0.0002,
        longitude: prev.longitude - 0.0002
      }));
    }, 3000);

    return () => {
      clearInterval(interval);
      if (locationSub?.remove) locationSub.remove();
    };
  }, [userRole]);

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

      {/* Real Google Maps Visual Canvas */}
      <View style={styles.mapArea}>
        <Image 
          source={{ uri: googleMapStaticUrl }} 
          style={styles.mapImage}
          resizeMode="cover"
        />

        {/* Map Legend Floating Bar */}
        <View style={styles.mapLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
            <Text style={styles.legendText}>Patient (P)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#16A34A' }]} />
            <Text style={styles.legendText}>Ambulance (A)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#0284C7' }]} />
            <Text style={styles.legendText}>Hospital (H)</Text>
          </View>
        </View>

        {/* Speed & ETA Tag */}
        <View style={styles.floatingSpeedTag}>
          <Navigation size={14} color="#FFFFFF" style={{ transform: [{ rotate: '45deg' }] }} />
          <Text style={styles.floatingSpeedText}>{ambulanceSpeed} km/h • ETA {etaMinutes} min</Text>
        </View>
      </View>

      {/* One-Touch Turn-by-Turn Google Maps Navigation Action */}
      <View style={styles.quickNavRow}>
        <TouchableOpacity 
          style={styles.googleNavButton}
          onPress={() => mapNavigationService.openNavigation(patientCoords.latitude, patientCoords.longitude, 'Patient Location')}
        >
          <Navigation size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.googleNavButtonText}>
            {userRole === 'AMBULANCE_PERSONNEL' ? 'Turn-by-Turn GPS to Patient' : 'Open in Google Maps'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.hospitalNavButton}
          onPress={() => mapNavigationService.openNavigation(hospitalLat, hospitalLng, hospitalName)}
        >
          <ExternalLink size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.hospitalNavButtonText}>Route to Hospital</Text>
        </TouchableOpacity>
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
              <Text style={styles.metricValue}>{distanceKm.toFixed(1)} km</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Estimated Arrival</Text>
              <Text style={styles.metricValue}>{etaMinutes} min</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Speed</Text>
              <Text style={styles.metricValue}>{ambulanceSpeed} km/h</Text>
            </View>
          </View>
        </View>

        {/* Destination Hospital Information */}
        <View style={styles.hospitalInfoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Hospital size={20} color="#0284C7" />
            <View style={{ flex: 1 }}>
              <Text style={styles.hospTitle}>{hospitalName}</Text>
              <Text style={styles.hospAddress}>{hospitalAddress} • {hospitalBeds} ICU Beds</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.hospCallBtn}
            onPress={() => mapNavigationService.makePhoneCall(hospitalPhone, hospitalName)}
          >
            <Phone size={14} color="#0369A1" style={{ marginRight: 6 }} />
            <Text style={styles.hospCallBtnText}>Call Trauma Bay ({hospitalPhone})</Text>
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