import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import Svg, { Rect, Circle, Line, Text as SvgText, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Navigation, MapPin, ExternalLink, Radio } from 'lucide-react-native';
import { theme } from '../../lib/theme';
import { mapNavigationService } from '../../services/mapNavigationService';
import { distanceService } from '../../services/distanceService';

interface LiveMapCardProps {
  patientCoords?: { latitude: number; longitude: number } | null;
  ambulanceCoords?: { latitude: number; longitude: number } | null;
  hospitalCoords?: { latitude: number; longitude: number } | null;
  patientName?: string;
  ambulanceTitle?: string;
  hospitalName?: string;
  statusLabel?: string;
  onNavigatePatient?: () => void;
  onNavigateHospital?: () => void;
}

export const LiveMapCard: React.FC<LiveMapCardProps> = ({
  patientCoords,
  ambulanceCoords,
  hospitalCoords,
  patientName = 'Patient',
  ambulanceTitle = 'Ambulance Unit',
  hospitalName = 'Trauma Center',
  statusLabel,
  onNavigatePatient,
  onNavigateHospital
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const centerLat = patientCoords?.latitude || ambulanceCoords?.latitude || 13.0604;
  const centerLng = patientCoords?.longitude || ambulanceCoords?.longitude || 80.2496;

  // Build markers list
  const markers = [];
  if (patientCoords) {
    markers.push({ lat: patientCoords.latitude, lng: patientCoords.longitude, color: 'red', label: 'P' });
  }
  if (ambulanceCoords) {
    markers.push({ lat: ambulanceCoords.latitude, lng: ambulanceCoords.longitude, color: 'green', label: 'A' });
  }
  if (hospitalCoords) {
    markers.push({ lat: hospitalCoords.latitude, lng: hospitalCoords.longitude, color: 'blue', label: 'H' });
  }

  const mapImageUrl = mapNavigationService.getStaticMapUrl({
    centerLat,
    centerLng,
    zoom: 14,
    width: 600,
    height: 320,
    markers
  });

  // Calculate distance between patient and ambulance if both exist
  const distanceKm = patientCoords && ambulanceCoords
    ? distanceService.calculateDistanceKm(patientCoords, ambulanceCoords)
    : null;

  // Render SVG fallback radar grid if static map image fails or key is missing
  const renderSvgMapFallback = () => {
    const width = 340;
    const height = 180;

    // Coordinate mapping into SVG box
    const pX = width * 0.5;
    const pY = height * 0.55;

    let aX = width * 0.25;
    let aY = height * 0.35;
    if (ambulanceCoords && patientCoords) {
      const dLng = ambulanceCoords.longitude - patientCoords.longitude;
      const dLat = ambulanceCoords.latitude - patientCoords.latitude;
      aX = Math.max(40, Math.min(width - 40, pX + dLng * 2500));
      aY = Math.max(30, Math.min(height - 30, pY - dLat * 2500));
    }

    const hX = width * 0.78;
    const hY = height * 0.25;

    return (
      <View style={styles.svgContainer}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <Defs>
            <RadialGradient id="patientGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#DC2626" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#DC2626" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="ambGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#16A34A" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Grid Background */}
          <Rect x="0" y="0" width={width} height={height} fill="#0F172A" rx="8" />
          
          {/* Subtle Grid Lines */}
          <Line x1="0" y1={height * 0.33} x2={width} y2={height * 0.33} stroke="#1E293B" strokeWidth="1" />
          <Line x1="0" y1={height * 0.66} x2={width} y2={height * 0.66} stroke="#1E293B" strokeWidth="1" />
          <Line x1={width * 0.33} y1="0" x2={width * 0.33} y2={height} stroke="#1E293B" strokeWidth="1" />
          <Line x1={width * 0.66} y1="0" x2={width * 0.66} y2={height} stroke="#1E293B" strokeWidth="1" />

          {/* Dynamic route line connecting ambulance to patient */}
          {ambulanceCoords && patientCoords && (
            <Line
              x1={aX}
              y1={aY}
              x2={pX}
              y2={pY}
              stroke="#38BDF8"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          )}

          {/* Hospital Marker (H) */}
          {hospitalCoords && (
            <>
              <Circle cx={hX} cy={hY} r="14" fill="#0284C7" />
              <SvgText x={hX} y={hY + 4} fill="#FFFFFF" fontSize="11" fontWeight="bold" textAnchor="middle">H</SvgText>
              <SvgText x={hX} y={hY + 18} fill="#94A3B8" fontSize="8" textAnchor="middle">Hospital</SvgText>
            </>
          )}

          {/* Ambulance Marker (A) */}
          {ambulanceCoords && (
            <>
              <Circle cx={aX} cy={aY} r="22" fill="url(#ambGlow)" />
              <Circle cx={aX} cy={aY} r="14" fill="#16A34A" />
              <SvgText x={aX} y={aY + 4} fill="#FFFFFF" fontSize="11" fontWeight="bold" textAnchor="middle">A</SvgText>
              <SvgText x={aX} y={aY + 18} fill="#86EFAC" fontSize="8" fontWeight="bold" textAnchor="middle">Ambulance</SvgText>
            </>
          )}

          {/* Patient Marker (P) */}
          {patientCoords && (
            <>
              <Circle cx={pX} cy={pY} r="24" fill="url(#patientGlow)" />
              <Circle cx={pX} cy={pY} r="15" fill="#DC2626" />
              <SvgText x={pX} y={pY + 4} fill="#FFFFFF" fontSize="12" fontWeight="bold" textAnchor="middle">P</SvgText>
              <SvgText x={pX} y={pY + 19} fill="#FCA5A5" fontSize="8" fontWeight="bold" textAnchor="middle">Patient SOS</SvgText>
            </>
          )}
        </Svg>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      {/* Telemetry Header */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <Radio size={14} color="#16A34A" />
          <Text style={styles.headerTitle}>SATELLITE GPS TELEMETRY</Text>
        </View>
        {distanceKm !== null && (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceBadgeText}>{distanceService.formatDistance(distanceKm)} away</Text>
          </View>
        )}
      </View>

      {/* Map Display View */}
      <View style={styles.mapContainer}>
        {!imageError && mapImageUrl ? (
          <>
            <Image
              source={{ uri: mapImageUrl }}
              style={styles.mapImage}
              resizeMode="cover"
              onLoadEnd={() => setImageLoading(false)}
              onError={() => setImageError(true)}
            />
            {imageLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color="#DC2626" />
                <Text style={styles.loadingText}>Syncing GPS feed...</Text>
              </View>
            )}
          </>
        ) : (
          renderSvgMapFallback()
        )}

        {/* Floating Coordinates Tag */}
        {patientCoords && (
          <View style={styles.coordsOverlay}>
            <MapPin size={11} color="#DC2626" />
            <Text style={styles.coordsText}>
              Patient GPS: {patientCoords.latitude.toFixed(5)}, {patientCoords.longitude.toFixed(5)}
            </Text>
          </View>
        )}
      </View>

      {/* Map Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
          <Text style={styles.legendText}>Patient (P)</Text>
        </View>

        {ambulanceCoords ? (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#16A34A' }]} />
            <Text style={styles.legendText}>Ambulance (A)</Text>
          </View>
        ) : (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#94A3B8' }]} />
            <Text style={[styles.legendText, { color: '#94A3B8' }]}>Ambulance (Searching...)</Text>
          </View>
        )}

        {hospitalCoords && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#0284C7' }]} />
            <Text style={styles.legendText}>Hospital (H)</Text>
          </View>
        )}
      </View>

      {/* One-Tap Google Maps Navigation Buttons */}
      <View style={styles.actionRow}>
        {patientCoords && (
          <TouchableOpacity
            style={styles.navPatientButton}
            onPress={onNavigatePatient || (() => mapNavigationService.openNavigation(patientCoords.latitude, patientCoords.longitude, patientName))}
          >
            <Navigation size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.navButtonText}>Turn-by-Turn to Patient</Text>
          </TouchableOpacity>
        )}

        {hospitalCoords && onNavigateHospital && (
          <TouchableOpacity
            style={styles.navHospitalButton}
            onPress={onNavigateHospital}
          >
            <ExternalLink size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.navButtonText}>Route to Hospital</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginVertical: theme.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.5
  },
  distanceBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12
  },
  distanceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534'
  },
  mapContainer: {
    height: 180,
    backgroundColor: '#0F172A',
    position: 'relative',
    overflow: 'hidden'
  },
  mapImage: {
    width: '100%',
    height: '100%'
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600'
  },
  svgContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  coordsOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  coordsText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '600'
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  navPatientButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.sm
  },
  navHospitalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.sm
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  }
});
