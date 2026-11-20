import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { Hospital, ArrowLeft, Navigation, Search, CheckCircle2, BedDouble } from 'lucide-react-native';
import { theme } from '../../lib/theme';
import { hospitalService } from '../../services/hospitalService';

interface HospitalItem {
  id: string;
  name: string;
  address: string;
  distanceKm: number;
  routeMinutes: number;
  icuBedsAvailable: number;
  emergencyPhone: string;
}

interface HospitalSelectionScreenProps {
  onSelectHospital: (hospital: HospitalItem) => void;
  onBack: () => void;
}

export const HospitalSelectionScreen: React.FC<HospitalSelectionScreenProps> = ({ onSelectHospital, onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState('h1');

  const [hospitals] = useState<HospitalItem[]>([
    {
      id: 'a1111111-1111-1111-1111-111111111111',
      name: 'Apollo Hospitals - Greams Road (Level 1 Trauma Center)',
      address: '21 Greams Lane, Thousand Lights, Chennai',
      distanceKm: 2.1,
      routeMinutes: 6,
      icuBedsAvailable: 12,
      emergencyPhone: '+91 44 2829 0200'
    },
    {
      id: 'a2222222-2222-2222-2222-222222222222',
      name: 'Rajiv Gandhi Government General Hospital (RGGGH)',
      address: 'EVR Periyar Salai, Park Town, Chennai',
      distanceKm: 3.4,
      routeMinutes: 9,
      icuBedsAvailable: 18,
      emergencyPhone: '+91 44 2530 5000'
    },
    {
      id: 'a3333333-3333-3333-3333-333333333333',
      name: 'Fortis Malar Hospital Trauma Care',
      address: '52 1st Main Rd, Gandhi Nagar, Adyar, Chennai',
      distanceKm: 4.8,
      routeMinutes: 12,
      icuBedsAvailable: 7,
      emergencyPhone: '+91 44 4289 2222'
    }
  ]);

  const filtered = hospitals.filter(h => 
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConfirm = async () => {
    const chosen = hospitals.find(h => h.id === selectedId);
    if (chosen) {
      await hospitalService.selectHospital('17b505f7-c4f5-487e-81ee-9924847b7789', chosen.id);
      onSelectHospital(chosen);
      Alert.alert(
        'Hospital Destination Confirmed',
        `Destination set to ${chosen.name}. Authorized emergency contacts have been notified with distance (${chosen.distanceKm} km).`
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Select Destination Hospital</Text>
          <Text style={styles.headerSubtitle}>GPS-ranked nearby emergency centers</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search hospital or trauma center..."
          placeholderTextColor={theme.colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Recommended Nearby Centers</Text>

        <View style={styles.list}>
          {filtered.map(item => {
            const isSelected = item.id === selectedId;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelectedId(item.id)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.iconBox}>
                    <Hospital size={22} color={isSelected ? '#0284C7' : theme.colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                    <Text style={styles.hospitalName}>{item.name}</Text>
                    <Text style={styles.hospitalAddress}>{item.address}</Text>
                  </View>
                  {isSelected && (
                    <CheckCircle2 size={20} color="#0284C7" />
                  )}
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaBadge}>
                    <Navigation size={12} color="#0369A1" />
                    <Text style={styles.metaBadgeText}>{item.distanceKm} km • ~{item.routeMinutes} min</Text>
                  </View>

                  <View style={[styles.metaBadge, { backgroundColor: '#DCFCE7' }]}>
                    <BedDouble size={12} color="#16A34A" />
                    <Text style={[styles.metaBadgeText, { color: '#16A34A' }]}>{item.icuBedsAvailable} ICU Beds</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Confirm Selection Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
          <Text style={styles.confirmBtnText}>Confirm Hospital Destination</Text>
        </TouchableOpacity>
      </View>
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
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl * 1.4,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderColor: theme.colors.border
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textPrimary
  },
  content: {
    padding: theme.spacing.lg
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md
  },
  list: {
    gap: theme.spacing.md
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border
  },
  cardSelected: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center'
  },
  hospitalName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  hospitalAddress: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: theme.spacing.md
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1'
  },
  footer: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderColor: theme.colors.border
  },
  confirmBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center'
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  }
});
