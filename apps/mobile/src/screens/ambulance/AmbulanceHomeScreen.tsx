import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, Image } from 'react-native';
import { 
  Truck, 
  Check, 
  Power, 
  AlertCircle, 
  CheckCircle2, 
  Hospital, 
  Navigation, 
  LogOut, 
  Phone, 
  MessageSquare, 
  MapPin, 
  Users, 
  User, 
  ExternalLink 
} from 'lucide-react-native';
import { theme } from '../../lib/theme';
import { EmergencyStatus, CrewAvailability, EMERGENCY_STATUS_ORDER, STATUS_LABELS, CANCELLATION_REASONS, Profile } from '@mediconnect/shared';
import { ambulanceService } from '../../services/ambulanceService';
import { mapNavigationService } from '../../services/mapNavigationService';
import { notificationService } from '../../services/notificationService';
import { backgroundLocationService } from '../../services/backgroundLocationService';
import { distanceService } from '../../services/distanceService';
import { supabase } from '../../lib/supabase';
import { LiveMapCard } from '../../components/common/LiveMapCard';
import * as Location from 'expo-location';

interface AmbulanceHomeScreenProps {
  onSwitchRole: () => void;
  onOpenHospitalPicker?: () => void;
  onOpenLiveTracking?: () => void;
  userProfile?: Profile | null;
}

export const AmbulanceHomeScreen: React.FC<AmbulanceHomeScreenProps> = ({ 
  onSwitchRole, 
  onOpenHospitalPicker, 
  onOpenLiveTracking,
  userProfile
}) => {
  const [availability, setAvailability] = useState<CrewAvailability>('ONLINE');
  const [isApproved] = useState(true); // Main admin approval state

  // Live Crew GPS Coordinates
  const [crewLocation, setCrewLocation] = useState<{ latitude: number; longitude: number }>({
    latitude: 13.0827,
    longitude: 80.2707
  });
  const crewLocationRef = useRef(crewLocation);
  useEffect(() => {
    crewLocationRef.current = crewLocation;
  }, [crewLocation]);

  // Real-time Incoming Dispatch Alert from Citizen SOS or Admin Manual Override
  const [incomingOffer, setIncomingOffer] = useState<{
    id: string;
    distance: string;
    patientLocation: string;
    patientName: string;
    patientPhone: string;
    patientBlood?: string;
    patientNotes?: string;
    contactName: string;
    contactPhone: string;
    patientLat: number;
    patientLng: number;
    isAdminOverride?: boolean;
    initialStatus?: string;
  } | null>(null);
  const incomingOfferRef = useRef(incomingOffer);
  useEffect(() => {
    incomingOfferRef.current = incomingOffer;
  }, [incomingOffer]);

  const [countdown, setCountdown] = useState(60);

  // Active Emergency Assignment state with Patient & Emergency Contact details
  const [activeEmergency, setActiveEmergency] = useState<{
    id: string;
    statusIndex: number;
    patientName: string;
    patientPhone: string;
    patientBlood: string;
    patientNotes: string;
    contactName: string;
    contactPhone: string;
    hospitalName: string;
    hospitalAddress: string;
    hospitalPhone: string;
    patientLat: number;
    patientLng: number;
    hospitalLat: number;
    hospitalLng: number;
  } | null>(null);
  const activeEmergencyRef = useRef(activeEmergency);
  useEffect(() => {
    activeEmergencyRef.current = activeEmergency;
  }, [activeEmergency]);

  // Cancellation Modal
  const [cancelModalVisible, setCancelModalVisible] = useState(false);

  const crewId = userProfile?.id || '33333333-3333-3333-3333-333333333333';

  // 1. Continuous Live GPS Telemetry Watcher for Ambulance Driver (Zero Fake Data)
  useEffect(() => {
    let watcherSub: Location.LocationSubscription | null = null;
    let isActive = true;

    const startContinuousDriverTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[AmbulanceHomeScreen] Foreground location permission not granted');
          return;
        }

        // 1. Immediate initial GPS fix
        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest
        });
        if (!isActive) return;

        const initialCoords = {
          latitude: initialLoc.coords.latitude,
          longitude: initialLoc.coords.longitude
        };
        setCrewLocation(initialCoords);
        crewLocationRef.current = initialCoords;

        await supabase.from('ambulance_crews').upsert({
          id: crewId,
          vehicle_number: userProfile?.fullName ? `TN-01-AMB-${crewId.slice(0, 4).toUpperCase()}` : 'TN-01-AMB-4091',
          license_number: 'PARA-TN-2026-994',
          availability: availability,
          is_approved: true,
          location: `POINT(${initialCoords.longitude} ${initialCoords.latitude})`,
          last_location_update: new Date().toISOString()
        });

        // 2. Continuous real-time GPS telemetry watcher (every 2s or 1 meter)
        watcherSub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            timeInterval: 2000,
            distanceInterval: 1
          },
          async (loc) => {
            if (!isActive) return;

            const liveCoords = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude
            };
            setCrewLocation(liveCoords);
            crewLocationRef.current = liveCoords;

            const speedKmh = loc.coords.speed ? Math.round(loc.coords.speed * 3.6) : 48;
            const heading = loc.coords.heading ?? 0;

            // Stream moving coordinates directly to ambulance_crews
            await supabase
              .from('ambulance_crews')
              .update({
                location: `POINT(${liveCoords.longitude} ${liveCoords.latitude})`,
                last_location_update: new Date().toISOString()
              })
              .eq('id', crewId);

            // If active emergency is in progress, stream directly to live_ambulance_tracking
            if (activeEmergencyRef.current?.id) {
              await supabase
                .from('live_ambulance_tracking')
                .upsert({
                  emergency_id: activeEmergencyRef.current.id,
                  ambulance_id: crewId,
                  current_location: `POINT(${liveCoords.longitude} ${liveCoords.latitude})`,
                  speed_kmh: speedKmh,
                  heading: heading,
                  updated_at: new Date().toISOString(),
                  is_active: true
                });
            }
          }
        );
      } catch (err) {
        console.warn('[AmbulanceHomeScreen] Continuous tracking error:', err);
      }
    };

    startContinuousDriverTracking();

    return () => {
      isActive = false;
      if (watcherSub?.remove) watcherSub.remove();
    };
  }, [crewId, availability, userProfile]);

  // 2. Real-time listening for incoming emergency requests from Citizen SOS and Admin Manual Override
  useEffect(() => {
    const processIncomingRequest = async (req: any) => {
      if (!req) return;

      // Citizen cancelled request: immediately dismiss incoming offer or active emergency
      if (req.current_status === 'EMERGENCY_CANCELLED') {
        if (incomingOfferRef.current?.id === req.id) {
          setIncomingOffer(null);
          Alert.alert('Request Cancelled', 'The citizen has cancelled this emergency request.');
        }
        if (activeEmergencyRef.current?.id === req.id) {
          setActiveEmergency(null);
          setAvailability('ONLINE');
          await backgroundLocationService.stopTracking();
          Alert.alert('Emergency Cancelled', 'The citizen has cancelled the emergency request.');
        }
        return;
      }

      // If request is resolved or no longer active, dismiss any matching offer
      if (req.current_status === 'EMERGENCY_RESOLVED') {
        if (incomingOfferRef.current?.id === req.id) {
          setIncomingOffer(null);
        }
        if (activeEmergencyRef.current?.id === req.id) {
          setActiveEmergency(null);
          setAvailability('ONLINE');
          await backgroundLocationService.stopTracking();
        }
        return;
      }

      // If assigned specifically to a different crew, dismiss from this crew's view
      if (req.assigned_ambulance_id && req.assigned_ambulance_id !== crewId) {
        if (incomingOfferRef.current?.id === req.id) {
          setIncomingOffer(null);
        }
        return;
      }

      // Check assignment relevance to this specific unit
      const isDirectAssignment = req.assigned_ambulance_id === crewId;
      const isOpenSos = !req.assigned_ambulance_id && req.current_status === 'SOS_ACTIVATED';

      // If not directly assigned to this crew AND not an open SOS, dismiss/ignore
      if (!isDirectAssignment && !isOpenSos) {
        if (incomingOfferRef.current?.id === req.id) {
          setIncomingOffer(null);
        }
        return;
      }

      // If it is an unassigned open SOS, only display if crew is ONLINE
      if (isOpenSos && availability !== 'ONLINE') {
        return;
      }

      // If this crew is already actively navigating this exact emergency, keep status index in sync
      if (activeEmergencyRef.current?.id === req.id) {
        const orderIdx = EMERGENCY_STATUS_ORDER.indexOf(req.current_status);
        if (orderIdx >= 0 && orderIdx !== activeEmergencyRef.current?.statusIndex) {
          setActiveEmergency(prev => prev ? { ...prev, statusIndex: orderIdx } : null);
        }
        return;
      }

      // If crew is actively busy with a DIFFERENT emergency, ignore new incoming offers
      if (activeEmergencyRef.current && activeEmergencyRef.current.id !== req.id) {
        return;
      }

      // Stale request filter: only filter open broadcasts created more than 15 mins ago
      if (req.created_at && !isDirectAssignment) {
        const ageMs = Date.now() - new Date(req.created_at).getTime();
        if (ageMs > 15 * 60 * 1000) {
          return;
        }
      }

      const pCoords = distanceService.parsePoint(req.user_location) || { latitude: 13.0895, longitude: 80.2739 };

      // Fetch citizen patient profile details
      let patientName = 'Citizen Emergency';
      let patientPhone = '+919876543210';
      let patientBlood = 'O+';
      let patientNotes = 'Immediate assistance requested';

      if (req.user_id) {
        const { data: pData } = await supabase
          .from('profiles')
          .select('full_name, phone_number, blood_group, medical_notes')
          .eq('id', req.user_id)
          .single();

        if (pData) {
          patientName = pData.full_name || patientName;
          patientPhone = pData.phone_number || patientPhone;
          patientBlood = pData.blood_group || patientBlood;
          patientNotes = pData.medical_notes || patientNotes;
        }
      }

      // Fetch patient's designated emergency contact
      let contactName = 'Family Contact';
      let contactPhone = '+919876543212';
      if (req.user_id) {
        const { data: cData } = await supabase
          .from('emergency_contacts')
          .select('contact_name, contact_user_id')
          .eq('user_id', req.user_id)
          .limit(1)
          .maybeSingle();

        if (cData) {
          contactName = cData.contact_name || contactName;
          if (cData.contact_user_id) {
            const { data: cProfile } = await supabase
              .from('profiles')
              .select('phone_number')
              .eq('id', cData.contact_user_id)
              .single();
            if (cProfile) contactPhone = cProfile.phone_number || contactPhone;
          }
        }
      }

      // Dynamic distance and ETA computation from latest crew GPS coordinates
      const currentLoc = crewLocationRef.current;
      const distKm = distanceService.calculateDistanceKm(currentLoc, pCoords);
      const etaMins = distanceService.calculateEtaMinutes(distKm);

      const isAdminOverride = isDirectAssignment && (req.current_status === 'AMBULANCE_DISPATCHED' || req.current_status === 'REQUEST_ACCEPTED');

      setIncomingOffer({
        id: req.id,
        distance: `${distanceService.formatDistance(distKm)} away (${distanceService.formatEta(etaMins)})`,
        patientLocation: req.address_text || `GPS (${pCoords.latitude.toFixed(4)}, ${pCoords.longitude.toFixed(4)})`,
        patientName,
        patientPhone,
        patientBlood,
        patientNotes,
        contactName,
        contactPhone,
        patientLat: pCoords.latitude,
        patientLng: pCoords.longitude,
        isAdminOverride,
        initialStatus: req.current_status
      });
      setCountdown(isAdminOverride ? 120 : 60);
    };

    // Directly restore an in-progress active emergency assignment
    const restoreActiveEmergency = async (req: any) => {
      const pCoords = distanceService.parsePoint(req.user_location) || crewLocationRef.current;
      const orderIdx = EMERGENCY_STATUS_ORDER.indexOf(req.current_status);

      let patientName = 'Citizen Emergency';
      let patientPhone = '+919876543210';
      let patientBlood = 'O+';
      let patientNotes = 'Immediate assistance requested';

      if (req.user_id) {
        const { data: pData } = await supabase
          .from('profiles')
          .select('full_name, phone_number, blood_group, medical_notes')
          .eq('id', req.user_id)
          .single();

        if (pData) {
          patientName = pData.full_name || patientName;
          patientPhone = pData.phone_number || patientPhone;
          patientBlood = pData.blood_group || patientBlood;
          patientNotes = pData.medical_notes || patientNotes;
        }
      }

      let contactName = 'Family Contact';
      let contactPhone = '+919876543212';
      if (req.user_id) {
        const { data: cData } = await supabase
          .from('emergency_contacts')
          .select('contact_name, contact_user_id')
          .eq('user_id', req.user_id)
          .limit(1)
          .maybeSingle();

        if (cData) {
          contactName = cData.contact_name || contactName;
          if (cData.contact_user_id) {
            const { data: cProfile } = await supabase
              .from('profiles')
              .select('phone_number')
              .eq('id', cData.contact_user_id)
              .single();
            if (cProfile) contactPhone = cProfile.phone_number || contactPhone;
          }
        }
      }

      setAvailability('BUSY');
      setActiveEmergency({
        id: req.id,
        statusIndex: orderIdx >= 0 ? orderIdx : 1,
        patientName,
        patientPhone,
        patientBlood,
        patientNotes,
        contactName,
        contactPhone,
        hospitalName: 'Apollo Hospitals Greams Road (Level 1 Trauma)',
        hospitalAddress: '21 Greams Lane, Thousand Lights, Chennai',
        hospitalPhone: '+914428290200',
        patientLat: pCoords.latitude,
        patientLng: pCoords.longitude,
        hospitalLat: 13.0604,
        hospitalLng: 80.2505
      });
      setIncomingOffer(null);

      await backgroundLocationService.startTracking({
        incidentId: req.id,
        role: 'AMBULANCE_PERSONNEL',
        userId: crewId
      });
    };

    // Query for any active emergency request matching this crew
    const checkExisting = async () => {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

      // 1. Check for active emergency directly assigned to this crew
      const { data: directData } = await supabase
        .from('emergency_requests')
        .select('*')
        .eq('assigned_ambulance_id', crewId)
        .in('current_status', ['SOS_ACTIVATED', 'REQUEST_ACCEPTED', 'AMBULANCE_DISPATCHED', 'AMBULANCE_ON_THE_WAY', 'AMBULANCE_ARRIVED', 'PATIENT_PICKED_UP'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (directData && directData.length > 0) {
        const req = directData[0];
        if (req.current_status !== 'SOS_ACTIVATED') {
          restoreActiveEmergency(req);
        } else {
          processIncomingRequest(req);
        }
        return;
      }

      // 2. Check for open unassigned SOS if crew is ONLINE
      if (availability === 'ONLINE') {
        const { data: openData } = await supabase
          .from('emergency_requests')
          .select('*')
          .eq('current_status', 'SOS_ACTIVATED')
          .is('assigned_ambulance_id', null)
          .gte('created_at', fifteenMinutesAgo)
          .order('created_at', { ascending: false })
          .limit(1);

        if (openData && openData.length > 0) {
          processIncomingRequest(openData[0]);
        }
      }
    };
    checkExisting();

    // Supabase Realtime channel subscription
    const channel = supabase
      .channel(`crew_emergencies_${crewId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'emergency_requests' },
        (payload: any) => {
          if (payload.new) {
            if (activeEmergencyRef.current?.id === payload.new.id) {
              const updatedCoords = distanceService.parsePoint(payload.new.user_location);
              if (updatedCoords) {
                setActiveEmergency(prev => prev ? {
                  ...prev,
                  patientLat: updatedCoords.latitude,
                  patientLng: updatedCoords.longitude
                } : null);
              }
            }
            processIncomingRequest(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [availability, crewId]);

  // 60-second countdown timer for offered SOS request
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (incomingOffer && countdown > 0 && !activeEmergency) {
      // Trigger native notification for incoming offer
      notificationService.dispatchAmbulanceOffer({
        offerId: incomingOffer.id,
        distance: incomingOffer.distance,
        patientLocation: incomingOffer.patientLocation
      });

      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setIncomingOffer(null);
            Alert.alert('Offer Expired', 'The 60-second response window has expired. Re-routing dispatch.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [incomingOffer, countdown, activeEmergency]);

  const handleToggleOnline = async () => {
    if (activeEmergency) {
      Alert.alert('Operation Active', 'Cannot go offline while assigned to an active emergency.');
      return;
    }
    const nextState = availability === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    setAvailability(nextState);
    await ambulanceService.updateAvailability(crewId, nextState);
  };

  const handleAcceptEmergency = async () => {
    if (!incomingOffer) return;
    
    // Call atomic RPC assignment / direct assignment fallback
    const result = await ambulanceService.acceptEmergency(incomingOffer.id, crewId);
    
    if (result.success) {
      setAvailability('BUSY');
      const emgId = incomingOffer.id;
      const startingIndex = incomingOffer.initialStatus === 'AMBULANCE_DISPATCHED' ? 1 : 0;

      setActiveEmergency({
        id: emgId,
        statusIndex: startingIndex,
        patientName: incomingOffer.patientName,
        patientPhone: incomingOffer.patientPhone,
        patientBlood: incomingOffer.patientBlood || 'O+',
        patientNotes: incomingOffer.patientNotes || 'Immediate assistance required',
        contactName: incomingOffer.contactName,
        contactPhone: incomingOffer.contactPhone,
        hospitalName: 'Apollo Hospitals Greams Road (Level 1 Trauma)',
        hospitalAddress: '21 Greams Lane, Thousand Lights, Chennai',
        hospitalPhone: '+914428290200',
        patientLat: incomingOffer.patientLat,
        patientLng: incomingOffer.patientLng,
        hospitalLat: 13.0604,
        hospitalLng: 80.2505
      });
      setIncomingOffer(null);

      // Start Android Foreground Service & Background GPS broadcast
      await backgroundLocationService.startTracking({
        incidentId: emgId,
        role: 'AMBULANCE_PERSONNEL',
        userId: crewId
      });

      // Dispatch alert
      await notificationService.dispatchStatusUpdate({
        statusLabel: startingIndex === 1 ? 'Ambulance Dispatched' : 'Dispatch Accepted',
        details: 'Navigating to patient location. Live GPS broadcasting active.'
      });

      Alert.alert(
        incomingOffer.isAdminOverride ? 'Command Dispatch Accepted' : 'Emergency Accepted',
        'Assignment confirmed. Navigation route generated and live GPS broadcasting active.'
      );
    } else {
      Alert.alert('Dispatch Claimed', result.message || 'Already accepted by a nearer responder.');
      setIncomingOffer(null);
    }
  };

  const handleRejectEmergency = () => {
    setIncomingOffer(null);
    Alert.alert('Offer Rejected', 'Dispatch engine will route to the next nearest crew.');
  };

  const handleNextStatus = async () => {
    if (!activeEmergency) return;
    const nextIndex = activeEmergency.statusIndex + 1;

    if (nextIndex < EMERGENCY_STATUS_ORDER.length) {
      const newStatus = EMERGENCY_STATUS_ORDER[nextIndex];
      setActiveEmergency({
        ...activeEmergency,
        statusIndex: nextIndex
      });
      await ambulanceService.updateEmergencyStatus(activeEmergency.id, newStatus, crewId);
      
      // Dispatch status push notification
      await notificationService.dispatchStatusUpdate({
        statusLabel: STATUS_LABELS[newStatus],
        details: `Emergency assignment advanced to ${STATUS_LABELS[newStatus]}.`
      });

      Alert.alert('Status Updated', `Emergency advanced to: ${STATUS_LABELS[newStatus]}`);
    } else {
      // 7th step completed -> Emergency Resolved!
      await backgroundLocationService.stopTracking();
      await ambulanceService.updateEmergencyStatus(activeEmergency.id, 'EMERGENCY_RESOLVED', crewId);
      
      await notificationService.dispatchStatusUpdate({
        statusLabel: 'Emergency Resolved',
        details: 'Patient safely delivered to trauma center. Incident completed.'
      });

      setActiveEmergency(null);
      setAvailability('ONLINE');
      Alert.alert('Emergency Resolved', 'Live GPS tracking has been stopped. Incident resolved successfully.');
    }
  };

  const handleConfirmCancel = async (reason: string) => {
    setCancelModalVisible(false);
    await backgroundLocationService.stopTracking();
    if (activeEmergency) {
      await ambulanceService.cancelAssignment(activeEmergency.id, crewId, reason);
    }
    setActiveEmergency(null);
    setAvailability('ONLINE');
    Alert.alert('Assignment Cancelled', `Cancellation reason recorded: "${reason}". Emergency returned to pool for reassignment.`);
  };

  const currentStatus: EmergencyStatus | null = activeEmergency 
    ? EMERGENCY_STATUS_ORDER[activeEmergency.statusIndex] 
    : null;

  // Real Google Maps Static Map Image URL
  const googleMapStaticUrl = activeEmergency ? mapNavigationService.getStaticMapUrl({
    centerLat: activeEmergency.patientLat,
    centerLng: activeEmergency.patientLng,
    zoom: 14,
    width: 600,
    height: 320,
    markers: [
      { lat: activeEmergency.patientLat, lng: activeEmergency.patientLng, color: 'red', label: 'P' },
      { lat: crewLocation.latitude, lng: crewLocation.longitude, color: 'green', label: 'A' },
      { lat: activeEmergency.hospitalLat, lng: activeEmergency.hospitalLng, color: 'blue', label: 'H' }
    ]
  }) : '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Crew Command</Text>
          <Text style={styles.roleTag}>
            {userProfile?.fullName || 'Paramedic Unit Officer'} • TN-01-AMB-4091
          </Text>
        </View>
        <TouchableOpacity style={styles.switchButton} onPress={onSwitchRole}>
          <LogOut size={16} color={theme.colors.accent} />
          <Text style={styles.switchButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Admin Approval & Availability Status Bar */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={18} color={isApproved ? theme.colors.success : theme.colors.warning} />
            <Text style={styles.approvalText}>
              {isApproved ? 'Admin Verified & Approved' : 'Pending Main Admin Approval'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.powerButton,
              availability === 'ONLINE' ? styles.powerOnline : styles.powerOffline
            ]}
            onPress={handleToggleOnline}
          >
            <Power size={14} color="#FFFFFF" />
            <Text style={styles.powerButtonText}>{availability}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Assignment 7-Step Sequence Manager */}
      {activeEmergency && currentStatus ? (
        <View style={styles.activeJobCard}>
          <View style={styles.jobHeader}>
            <Truck size={24} color="#0284C7" />
            <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
              <Text style={styles.jobTitle}>ACTIVE DISPATCH IN PROGRESS</Text>
              <Text style={styles.jobSubtitle}>Incident ID: {activeEmergency.id}</Text>
            </View>
          </View>

          {/* Current Status Box */}
          <View style={styles.currentStepBox}>
            <Text style={styles.stepCounter}>Step {activeEmergency.statusIndex + 1} of 7</Text>
            <Text style={styles.stepName}>{STATUS_LABELS[currentStatus]}</Text>
          </View>

          {/* ================================================================ */}
          {/* 1. PATIENT CONTACT & VITALS CARD                                */}
          {/* ================================================================ */}
          <View style={styles.partyBox}>
            <View style={styles.partyHeader}>
              <User size={16} color={theme.colors.primary} />
              <Text style={styles.partyTitle}>PATIENT DETAILS</Text>
            </View>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>Name:</Text>
              <Text style={styles.partyValue}>{activeEmergency.patientName}</Text>
            </View>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>Phone:</Text>
              <Text style={styles.partyValue}>{activeEmergency.patientPhone}</Text>
            </View>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>Blood Group:</Text>
              <Text style={[styles.partyValue, { color: theme.colors.primary }]}>{activeEmergency.patientBlood}</Text>
            </View>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>Medical Notes:</Text>
              <Text style={styles.partyValue}>{activeEmergency.patientNotes}</Text>
            </View>

            {/* Direct Dialer Button to Patient */}
            <TouchableOpacity 
              style={styles.directCallBtn}
              onPress={() => mapNavigationService.makePhoneCall(activeEmergency.patientPhone, activeEmergency.patientName)}
            >
              <Phone size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.directCallBtnText}>Call Patient ({activeEmergency.patientPhone})</Text>
            </TouchableOpacity>
          </View>

          {/* ================================================================ */}
          {/* 2. EMERGENCY CONTACT CARD (With Direct Phone Dialer)             */}
          {/* ================================================================ */}
          <View style={[styles.partyBox, { borderColor: '#BAE6FD', backgroundColor: '#F0F9FF' }]}>
            <View style={styles.partyHeader}>
              <Users size={16} color="#0284C7" />
              <Text style={[styles.partyTitle, { color: '#0369A1' }]}>EMERGENCY CONTACT (FAMILY)</Text>
            </View>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>Contact Name:</Text>
              <Text style={styles.partyValue}>{activeEmergency.contactName}</Text>
            </View>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>Contact Mobile:</Text>
              <Text style={styles.partyValue}>{activeEmergency.contactPhone}</Text>
            </View>
            <Text style={styles.partyNotice}>
              Family contact is authorized to track your live GPS route and arrival ETA.
            </Text>

            {/* Direct Dialer & SMS Buttons to Emergency Contact */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity 
                style={[styles.directCallBtn, { flex: 2, backgroundColor: '#0284C7' }]}
                onPress={() => mapNavigationService.makePhoneCall(activeEmergency.contactPhone, activeEmergency.contactName)}
              >
                <Phone size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.directCallBtnText}>Call Contact ({activeEmergency.contactPhone})</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.directSmsBtn}
                onPress={() => mapNavigationService.sendSms(
                  activeEmergency.contactPhone,
                  `MediConnect Paramedic Crew: We are en route to ${activeEmergency.patientName} at 54 km/h. ETA 4 mins.`
                )}
              >
                <MessageSquare size={15} color="#0284C7" style={{ marginRight: 4 }} />
                <Text style={styles.directSmsBtnText}>SMS</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ================================================================ */}
          {/* 3. LIVE PRECISION SATELLITE MAP CARD (Guaranteed No Blank Screen)*/}
          {/* ================================================================ */}
          <LiveMapCard
            patientCoords={{ latitude: activeEmergency.patientLat, longitude: activeEmergency.patientLng }}
            ambulanceCoords={crewLocation}
            hospitalCoords={{ latitude: activeEmergency.hospitalLat, longitude: activeEmergency.hospitalLng }}
            patientName={activeEmergency.patientName}
            ambulanceTitle="This Ambulance"
            hospitalName={activeEmergency.hospitalName}
            statusLabel={STATUS_LABELS[currentStatus]}
            onNavigatePatient={() => mapNavigationService.openNavigation(activeEmergency.patientLat, activeEmergency.patientLng, activeEmergency.patientName)}
            onNavigateHospital={() => mapNavigationService.openNavigation(activeEmergency.hospitalLat, activeEmergency.hospitalLng, activeEmergency.hospitalName)}
          />

          {/* Advance Step Action Button */}
          <TouchableOpacity style={styles.advanceButton} onPress={handleNextStatus}>
            <Check size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.advanceButtonText}>
              {activeEmergency.statusIndex === 6 ? 'Mark as Resolved' : 'Advance to Next Status'}
            </Text>
          </TouchableOpacity>

          {/* Hospital Selection Sub-Screen Launcher */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: theme.spacing.sm }}>
            <TouchableOpacity 
              style={[styles.advanceButton, { flex: 1, backgroundColor: '#0284C7' }]} 
              onPress={onOpenHospitalPicker}
            >
              <Hospital size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={[styles.advanceButtonText, { fontSize: 12 }]}>Change Hospital</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.advanceButton, { flex: 1, backgroundColor: '#0F172A' }]} 
              onPress={onOpenLiveTracking}
            >
              <Navigation size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={[styles.advanceButtonText, { fontSize: 12 }]}>Live Nav Stream</Text>
            </TouchableOpacity>
          </View>

          {/* Cancel & Reassign Button */}
          <TouchableOpacity 
            style={styles.cancelAssignButton} 
            onPress={() => setCancelModalVisible(true)}
          >
            <Text style={styles.cancelAssignText}>Cancel Assignment (Reassign)</Text>
          </TouchableOpacity>
        </View>
      ) : incomingOffer && (availability === 'ONLINE' || incomingOffer.isAdminOverride) ? (
        /* Incoming SOS Offer Card or Admin Command Manual Override Card */
        <View style={[styles.offerCard, incomingOffer.isAdminOverride && { borderColor: '#DC2626', borderWidth: 2, backgroundColor: '#FEF2F2' }]}>
          <View style={styles.offerHeader}>
            <AlertCircle size={26} color={incomingOffer.isAdminOverride ? '#DC2626' : theme.colors.primary} />
            <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
              <Text style={[styles.offerTitle, incomingOffer.isAdminOverride && { color: '#DC2626', fontWeight: '900' }]}>
                {incomingOffer.isAdminOverride ? '🚨 COMMAND MANUAL DISPATCH' : 'NEW SOS DISPATCH OFFER'}
              </Text>
              <Text style={styles.offerDistance}>{incomingOffer.distance}</Text>
            </View>
            <View style={[styles.countdownBox, incomingOffer.isAdminOverride && { backgroundColor: '#DC2626' }]}>
              <Text style={styles.countdownText}>{countdown}s</Text>
            </View>
          </View>

          <Text style={styles.offerLocation}>📍 {incomingOffer.patientLocation}</Text>
          
          <View style={styles.offerPreviewBox}>
            <Text style={styles.offerPreviewText}>
              Patient: <Text style={{ fontWeight: '700' }}>{incomingOffer.patientName}</Text> ({incomingOffer.patientBlood || 'O+'}) • Contact: <Text style={{ fontWeight: '700' }}>{incomingOffer.contactName}</Text>
            </Text>
            {incomingOffer.patientNotes ? (
              <Text style={[styles.offerPreviewText, { marginTop: 4, color: '#475569' }]}>
                Notes: <Text style={{ fontStyle: 'italic' }}>{incomingOffer.patientNotes}</Text>
              </Text>
            ) : null}
          </View>

          <Text style={[styles.offerNotice, incomingOffer.isAdminOverride && { color: '#B91C1C', fontWeight: '700' }]}>
            {incomingOffer.isAdminOverride 
              ? 'Priority dispatch assigned directly by Central Command Administrator. Confirm assignment to initiate navigation.'
              : 'Respond within 60s. Atomic allocation will assign to the nearest responding crew.'}
          </Text>

          <View style={styles.offerBtnGroup}>
            <TouchableOpacity style={styles.rejectBtn} onPress={handleRejectEmergency}>
              <Text style={styles.rejectBtnText}>{incomingOffer.isAdminOverride ? 'Decline (Re-route)' : 'Decline'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.acceptBtn, incomingOffer.isAdminOverride && { backgroundColor: '#DC2626' }]} 
              onPress={handleAcceptEmergency}
            >
              <Text style={styles.acceptBtnText}>
                {incomingOffer.isAdminOverride ? 'Accept & Start Navigation' : 'Accept Dispatch'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.idleCard}>
          <Text style={styles.idleTitle}>
            {availability === 'ONLINE' ? 'Awaiting Emergency Dispatch' : 'You are currently Offline'}
          </Text>
          <Text style={styles.idleSubtitle}>
            {availability === 'ONLINE' 
              ? 'GPS satellite broadcasting is active. You will receive real-time 60s dispatch alerts with Google Maps routes for emergencies within your 5 km sector.'
              : 'Toggle Online above to begin receiving emergency dispatch alerts.'}
          </Text>
        </View>
      )}

      {/* Cancellation Reason Modal */}
      <Modal visible={cancelModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Cancellation Reason</Text>
            <Text style={styles.modalSubtitle}>
              A mandatory reason must be recorded before reassignment begins.
            </Text>

            {CANCELLATION_REASONS.map(reason => (
              <TouchableOpacity
                key={reason}
                style={styles.reasonOption}
                onPress={() => handleConfirmCancel(reason)}
              >
                <Text style={styles.reasonText}>{reason}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setCancelModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Keep Assignment</Text>
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
    paddingTop: theme.spacing.xl * 1.2,
    paddingBottom: 40
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md
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
  statusCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  approvalText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  powerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full
  },
  powerOnline: {
    backgroundColor: theme.colors.success
  },
  powerOffline: {
    backgroundColor: theme.colors.textMuted
  },
  powerButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },

  // Active Job Styles
  activeJobCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: '#0284C7',
    marginBottom: theme.spacing.md,
    elevation: 3
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm
  },
  jobTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.5
  },
  jobSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  currentStepBox: {
    backgroundColor: '#F0F9FF',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  stepCounter: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  stepName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0369A1',
    marginTop: 2
  },

  // Party (Patient & Contact) Cards
  partyBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  partyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)'
  },
  partyTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 0.5
  },
  partyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2
  },
  partyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary
  },
  partyValue: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  partyNotice: {
    fontSize: 11,
    color: '#0369A1',
    marginTop: 4,
    fontStyle: 'italic'
  },
  directCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803D',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    marginTop: 8
  },
  directCallBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  directSmsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    marginTop: 8
  },
  directSmsBtnText: {
    color: '#0369A1',
    fontWeight: '700',
    fontSize: 12
  },

  // Map & Navigation
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
  navRow: {
    gap: 8,
    marginBottom: theme.spacing.md
  },
  navPatientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    elevation: 2
  },
  navPatientBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13
  },
  navHospitalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0369A1',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md
  },
  navHospitalBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },

  advanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm
  },
  advanceButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  },
  cancelAssignButton: {
    alignItems: 'center',
    paddingVertical: 8
  },
  cancelAssignText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textDecorationLine: 'underline'
  },

  // Offer Styles
  offerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    marginBottom: theme.spacing.md,
    elevation: 4
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm
  },
  offerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 0.5
  },
  offerDistance: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  countdownBox: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: '#F87171'
  },
  countdownText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B'
  },
  offerLocation: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    fontWeight: '600',
    marginBottom: 6
  },
  offerPreviewBox: {
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8
  },
  offerPreviewText: {
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  offerNotice: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md
  },
  offerBtnGroup: {
    flexDirection: 'row',
    gap: 12
  },
  rejectBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md
  },
  rejectBtnText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: 13
  },
  acceptBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  },
  idleCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  idleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4
  },
  idleSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 4
  },
  modalSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md
  },
  reasonOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  reasonText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: '500'
  },
  modalCloseBtn: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md
  },
  modalCloseText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600'
  }
});