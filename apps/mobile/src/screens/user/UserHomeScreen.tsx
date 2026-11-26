import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Image } from 'react-native';
import * as Location from 'expo-location';
import { ShieldAlert, MapPin, XCircle, Clock, WifiOff, Users, ArrowLeftRight, Navigation, MessageSquare, LogOut, Phone, ExternalLink, Truck, User, History } from 'lucide-react-native';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { offlineQueueService } from '../../services/offlineQueue';
import { emergencyService } from '../../services/emergencyService';
import { mapNavigationService } from '../../services/mapNavigationService';
import { notificationService } from '../../services/notificationService';
import { backgroundLocationService } from '../../services/backgroundLocationService';
import { firebaseService } from '../../services/firebaseService';
import { distanceService } from '../../services/distanceService';
import { LiveMapCard } from '../../components/common/LiveMapCard';
import { Profile, STATUS_LABELS, EmergencyStatus } from '@mediconnect/shared';

interface UserHomeScreenProps {
  onSwitchRole: () => void;
  onOpenContacts?: () => void;
  onOpenLiveTracking?: (id: string) => void;
  onOpenFeedback?: (id: string) => void;
  onOpenProfile?: () => void;
  onOpenHistory?: () => void;
  userProfile?: Profile | null;
}

export const UserHomeScreen: React.FC<UserHomeScreenProps> = ({ 
  onSwitchRole, 
  onOpenContacts, 
  onOpenLiveTracking, 
  onOpenFeedback,
  onOpenProfile,
  onOpenHistory,
  userProfile
}) => {
  const [isActivating, setIsActivating] = useState(false);
  const [activeEmergencyId, setActiveEmergencyId] = useState<string | null>(null);
  const [emergencyStatus, setEmergencyStatus] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [lastCoords, setLastCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Assigned Ambulance Crew Telemetry
  const [assignedCrew, setAssignedCrew] = useState<{
    name: string;
    phone: string;
    vehicleNumber: string;
    distanceText: string;
    etaText: string;
    ambulanceLat?: number;
    ambulanceLng?: number;
  } | null>(null);
  const lastUserStatusRef = useRef<string | null>(null);

  // Synchronize live emergency status and assigned nearest ambulance crew
  useEffect(() => {
    if (!activeEmergencyId || isOfflineMode) return;

    const fetchCrewInfo = async (crewId: string) => {
      const crew = await emergencyService.getCrewDetails(crewId);
      if (crew) {
        let distText = 'En Route';
        let etaText = '3 mins';
        if (lastCoords && crew.location) {
          const distKm = distanceService.calculateDistanceKm(
            { latitude: lastCoords.lat, longitude: lastCoords.lng },
            crew.location
          );
          distText = distanceService.formatDistance(distKm);
          etaText = distanceService.formatEta(distanceService.calculateEtaMinutes(distKm));
        }
        setAssignedCrew({
          name: crew.name,
          phone: crew.phone,
          vehicleNumber: crew.vehicleNumber,
          distanceText: distText,
          etaText: etaText,
          ambulanceLat: crew.location?.latitude,
          ambulanceLng: crew.location?.longitude
        });
      }
    };

    // Check initial request status & assigned ambulance
    const checkInitial = async () => {
      const { data } = await supabase
        .from('emergency_requests')
        .select('*')
        .eq('id', activeEmergencyId)
        .single();

      if (data) {
        setEmergencyStatus(data.current_status);
        if (!lastUserStatusRef.current) {
          lastUserStatusRef.current = data.current_status;
        }
        if (data.assigned_ambulance_id) {
          fetchCrewInfo(data.assigned_ambulance_id);
        }
      }
    };
    checkInitial();

    // Subscribe to real-time status updates (REQUEST_ACCEPTED, AMBULANCE_ON_THE_WAY, etc.)
    const unsubscribe = emergencyService.subscribeToStatus(activeEmergencyId, async (newStatus, data) => {
      setEmergencyStatus(newStatus);

      // Trigger high-priority status notification on citizen phone for every advance step
      if (newStatus && newStatus !== lastUserStatusRef.current && newStatus !== 'SOS_ACTIVATED') {
        const label = STATUS_LABELS[newStatus as EmergencyStatus] || newStatus;
        let details = `Incident advanced to ${label}.`;
        if (newStatus === 'REQUEST_ACCEPTED') {
          details = 'Ambulance crew accepted your request and initiated GPS route.';
        } else if (newStatus === 'AMBULANCE_DISPATCHED') {
          details = 'Ambulance has been dispatched to your location.';
        } else if (newStatus === 'AMBULANCE_ON_THE_WAY') {
          details = 'Ambulance is en route with sirens active. Track live on your map.';
        } else if (newStatus === 'AMBULANCE_ARRIVED') {
          details = 'Ambulance has arrived at your location. Responders on site.';
        } else if (newStatus === 'PATIENT_PICKED_UP') {
          details = 'Patient onboard. Ambulance proceeding to trauma hospital.';
        } else if (newStatus === 'PATIENT_REACHED_HOSPITAL') {
          details = 'Ambulance arrived at the hospital trauma emergency department.';
        } else if (newStatus === 'EMERGENCY_RESOLVED') {
          details = 'Emergency resolved safely. Medical team notified.';
        } else if (newStatus === 'EMERGENCY_CANCELLED') {
          details = 'Emergency incident was cancelled.';
        }

        notificationService.dispatchStatusUpdate({
          statusLabel: label,
          details
        });
      }
      lastUserStatusRef.current = newStatus;

      if (data && data.assigned_ambulance_id) {
        fetchCrewInfo(data.assigned_ambulance_id);
      }

      if (newStatus === 'EMERGENCY_RESOLVED') {
        Alert.alert(
          'Emergency Resolved',
          'You have arrived safely at the trauma hospital. Medical team notified.'
        );
        await backgroundLocationService.stopTracking();
        setActiveEmergencyId(null);
        setEmergencyStatus(null);
        setAssignedCrew(null);
      } else if (newStatus === 'EMERGENCY_CANCELLED') {
        Alert.alert('Emergency Cancelled', 'The emergency incident has been cancelled.');
        await backgroundLocationService.stopTracking();
        setActiveEmergencyId(null);
        setEmergencyStatus(null);
        setAssignedCrew(null);
      }
    });

    // Auto-sync polling every 2.5s to ensure live status and responder movement updates
    const liveSyncTimer = setInterval(() => {
      checkInitial();
    }, 2500);

    return () => {
      clearInterval(liveSyncTimer);
      unsubscribe();
    };
  }, [activeEmergencyId, isOfflineMode, lastCoords]);

  // Requirement: SOS MUST activate immediately without a confirmation screen
  const handleImmediateSosTrigger = async () => {
    setIsActivating(true);
    try {
      // 1. Capture High Accuracy GPS Telemetry
      const { status } = await Location.requestForegroundPermissionsAsync();
      let coords = { latitude: 13.0895, longitude: 80.2739 }; // Real Chennai default fallback coords

      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest
        });
        coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        };
      }

      setLastCoords({ lat: coords.latitude, lng: coords.longitude });

      // 2. Perform Real High-Precision Reverse Geocoding
      let detectedAddress = `GPS (${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)})`;
      try {
        const geocoded = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude
        });
        if (geocoded && geocoded.length > 0) {
          const place = geocoded[0];
          const parts = [
            place.name,
            place.street,
            place.subregion || place.district,
            place.city,
            place.region,
            place.postalCode
          ].filter(Boolean);
          if (parts.length > 0) {
            detectedAddress = parts.join(', ');
          }
        }
      } catch (geoErr) {
        console.warn('[UserHomeScreen] Reverse geocode fallback:', geoErr);
      }

      // 3. Trigger SOS via live API with automatic offline queue fallback
      const activeUserId = userProfile?.id || '44444444-4444-4444-4444-444444444444';
      const result = await emergencyService.triggerSos(activeUserId, coords, detectedAddress);

      if (result.success && result.emergencyId) {
        setIsOfflineMode(result.isOffline || false);
        setActiveEmergencyId(result.emergencyId);
        setEmergencyStatus(result.isOffline ? 'QUEUED_OFFLINE' : 'SOS_ACTIVATED');

        // 4. Dispatch High-Priority SOS Push Notification with Real Address
        await notificationService.dispatchSosAlert({
          emergencyId: result.emergencyId,
          patientName: userProfile?.fullName || 'Citizen User',
          locationText: detectedAddress
        });

        // 4. Start Android Foreground Service & Background Continuous GPS Tracking
        await backgroundLocationService.startTracking({
          incidentId: result.emergencyId,
          role: 'NORMAL_USER',
          userId: activeUserId
        });

        // 5. Dual-Cloud Redundancy: Sync to Firebase backup channel
        await firebaseService.syncEmergencyBackup(result.emergencyId, {
          userId: activeUserId,
          latitude: coords.latitude,
          longitude: coords.longitude,
          status: 'SOS_ACTIVATED',
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: unknown) {
      console.error('[UserHomeScreen] Unexpected SOS failure:', err);
      setIsOfflineMode(true);
      setEmergencyStatus('QUEUED_OFFLINE');
    } finally {
      setIsActivating(false);
    }
  };

  const handleCancelSos = async () => {
    if (!activeEmergencyId) return;

    // Stop background location updates & foreground service
    await backgroundLocationService.stopTracking();

    if (!isOfflineMode) {
      await supabase
        .from('emergency_requests')
        .update({
          current_status: 'EMERGENCY_CANCELLED',
          cancellation_reason: 'User cancelled request'
        })
        .eq('id', activeEmergencyId);
    } else {
      await offlineQueueService.clearEmergency(activeEmergencyId);
    }

    setActiveEmergencyId(null);
    setEmergencyStatus(null);
    setAssignedCrew(null);
    setIsOfflineMode(false);
    Alert.alert('SOS Cancelled', 'Your emergency request has been safely cancelled.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Welcome, {userProfile?.fullName || 'Citizen'}</Text>
          <Text style={styles.roleTag}>Citizen Safety Dashboard</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {onOpenHistory && (
            <TouchableOpacity 
              style={[styles.switchButton, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]} 
              onPress={onOpenHistory}
            >
              <History size={14} color="#0F172A" />
              <Text style={[styles.switchButtonText, { color: '#0F172A' }]}>History</Text>
            </TouchableOpacity>
          )}
          {onOpenProfile && (
            <TouchableOpacity 
              style={[styles.switchButton, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]} 
              onPress={onOpenProfile}
            >
              <User size={14} color="#0F172A" />
              <Text style={[styles.switchButtonText, { color: '#0F172A' }]}>Profile</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.switchButton} onPress={onSwitchRole}>
            <LogOut size={14} color={theme.colors.accent} />
            <Text style={styles.switchButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Offline Mode Banner */}
      {isOfflineMode && (
        <View style={styles.offlineBanner}>
          <WifiOff size={18} color="#991B1B" />
          <Text style={styles.offlineBannerText}>
            Operating in Offline Mode. Request queued locally and will sync once internet returns.
          </Text>
        </View>
      )}

      {/* Active Emergency Status Card */}
      {activeEmergencyId ? (
        <View style={styles.activeAlertCard}>
          <View style={styles.alertHeader}>
            <ShieldAlert size={28} color={theme.colors.primary} />
            <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
              <Text style={styles.alertTitle}>EMERGENCY ACTIVE</Text>
              <Text style={styles.alertSubtitle}>
                Status: {emergencyStatus ? emergencyStatus.replace(/_/g, ' ') : 'SEARCHING CLOSEST RESPONDERS'}
              </Text>
            </View>
          </View>

          {/* Assigned Ambulance Crew Telemetry Card */}
          {assignedCrew ? (
            <View style={styles.assignedCrewCard}>
              <View style={styles.crewCardHeader}>
                <View style={styles.crewBadge}>
                  <Truck size={14} color="#FFFFFF" />
                  <Text style={styles.crewBadgeText}>NEAREST CREW ALLOCATED</Text>
                </View>
                <View style={styles.etaChip}>
                  <Clock size={11} color="#065F46" />
                  <Text style={styles.etaChipText}>{assignedCrew.distanceText} • ETA {assignedCrew.etaText}</Text>
                </View>
              </View>

              <View style={styles.crewDetailsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.crewVehicle}>{assignedCrew.vehicleNumber}</Text>
                  <Text style={styles.crewOfficer}>Officer: {assignedCrew.name}</Text>
                </View>
                <TouchableOpacity
                  style={styles.callCrewBtn}
                  onPress={() => mapNavigationService.makePhoneCall(assignedCrew.phone, assignedCrew.name)}
                >
                  <Phone size={15} color="#FFFFFF" />
                  <Text style={styles.callCrewBtnText}>Call Crew</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.searchingCard}>
              <ActivityIndicator size="small" color="#DC2626" />
              <Text style={styles.searchingText}>
                Matching nearest emergency crew based on geodesic distance...
              </Text>
            </View>
          )}

          {/* Live Precision Satellite Map Card */}
          {lastCoords && (
            <LiveMapCard
              patientCoords={{ latitude: lastCoords.lat, longitude: lastCoords.lng }}
              ambulanceCoords={assignedCrew?.ambulanceLat && assignedCrew?.ambulanceLng ? {
                latitude: assignedCrew.ambulanceLat,
                longitude: assignedCrew.ambulanceLng
              } : null}
              hospitalCoords={{ latitude: 13.0604, longitude: 80.2505 }}
              patientName="My Emergency Location"
              ambulanceTitle={assignedCrew ? assignedCrew.vehicleNumber : undefined}
              hospitalName="Apollo Hospitals Greams Road"
              statusLabel={emergencyStatus || 'SOS_ACTIVATED'}
              onNavigatePatient={() => mapNavigationService.openNavigation(lastCoords.lat, lastCoords.lng, 'My Emergency Location')}
              onNavigateHospital={() => mapNavigationService.openNavigation(13.0604, 80.2505, 'Apollo Trauma Center')}
            />
          )}

          {/* Quick Action Navigation & Dialer Buttons */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: theme.spacing.sm }}>
            {lastCoords && (
              <TouchableOpacity
                style={styles.googleNavBtn}
                onPress={() => mapNavigationService.openNavigation(lastCoords.lat, lastCoords.lng, 'My Incident Location')}
              >
                <ExternalLink size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.googleNavBtnText}>Open in Google Maps</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.emergencyCallBtn}
              onPress={() => mapNavigationService.makePhoneCall('108', 'National Emergency Ambulance Service')}
            >
              <Phone size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.emergencyCallBtnText}>Call 108 Hotline</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.mapButton}
            onPress={() => onOpenLiveTracking?.(activeEmergencyId)}
            activeOpacity={0.8}
          >
            <Navigation size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.mapButtonText}>View Live Responder Telemetry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelSos}
            activeOpacity={0.8}
          >
            <XCircle size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.cancelButtonText}>Cancel Emergency Request</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Instant Zero-Click SOS Button */
        <View style={styles.sosContainer}>
          <Text style={styles.sosInstructions}>
            Press the button below in any life-threatening situation.
            {'\n'}SOS triggers immediately without extra confirmation.
          </Text>

          <TouchableOpacity
            style={[styles.sosButton, isActivating && styles.sosButtonDisabled]}
            activeOpacity={0.85}
            onPress={handleImmediateSosTrigger}
            disabled={isActivating}
          >
            {isActivating ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : (
              <View style={styles.sosInner}>
                <ShieldAlert size={56} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.sosText}>SOS</Text>
                <Text style={styles.sosSubtext}>TAP FOR EMERGENCY</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.locationNotice}>
            <MapPin size={14} color={theme.colors.textMuted} />
            <Text style={styles.locationNoticeText}>High-precision GPS automatically captured</Text>
          </View>
        </View>
      )}

      {/* Quick Navigation Cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Emergency Network</Text>
        <View style={styles.grid}>
          <TouchableOpacity 
            style={styles.actionCard} 
            onPress={onOpenContacts}
            activeOpacity={0.8}
          >
            <Users size={22} color={theme.colors.accent} />
            <Text style={styles.actionCardTitle}>Emergency Contacts</Text>
            <Text style={styles.actionCardSubtitle}>Manage family net & requests</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard} 
            onPress={() => onOpenFeedback?.(activeEmergencyId || 'EMG-PREV')}
            activeOpacity={0.8}
          >
            <MessageSquare size={22} color={theme.colors.success} />
            <Text style={styles.actionCardTitle}>Ratings & Feedback</Text>
            <Text style={styles.actionCardSubtitle}>Anonymous crew review</Text>
          </TouchableOpacity>
        </View>
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
    paddingTop: theme.spacing.xl * 1.2
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
    fontWeight: '500'
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
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm
  },
  offlineBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 16,
    fontWeight: '600'
  },
  sosContainer: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xl,
    elevation: 3
  },
  sosInstructions: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: theme.spacing.lg
  },
  sosButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16
  },
  sosButtonDisabled: {
    opacity: 0.7
  },
  sosInner: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  sosText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginTop: 4
  },
  sosSubtext: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 1,
    marginTop: 2
  },
  locationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    gap: 4
  },
  locationNoticeText: {
    fontSize: 11,
    color: theme.colors.textMuted
  },
  activeAlertCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    marginBottom: theme.spacing.xl
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary
  },
  alertSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2
  },
  googleMapBox: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
    backgroundColor: '#E2E8F0',
    position: 'relative'
  },
  googleMapImage: {
    width: '100%',
    height: 160
  },
  mapLegendOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  legendText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155'
  },
  googleNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md
  },
  googleNavBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  emergencyCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803D',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md
  },
  emergencyCallBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  telemetryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
    gap: 6
  },
  telemetryText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: 'monospace'
  },
  mapButton: {
    flexDirection: 'row',
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm
  },
  mapButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  cancelButton: {
    flexDirection: 'row',
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  section: {
    marginTop: theme.spacing.sm
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md
  },
  grid: {
    flexDirection: 'row',
    gap: theme.spacing.md
  },
  actionCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.sm
  },
  actionCardSubtitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2
  },
  assignedCrewCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  crewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  crewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    gap: 4
  },
  crewBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800'
  },
  etaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    gap: 4
  },
  etaChipText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '700'
  },
  crewDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4
  },
  crewVehicle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A'
  },
  crewOfficer: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2
  },
  callCrewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    gap: 6
  },
  callCrewBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  searchingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: 8
  },
  searchingText: {
    flex: 1,
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '600'
  }
});
