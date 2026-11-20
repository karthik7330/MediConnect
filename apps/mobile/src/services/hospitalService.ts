import { supabase } from '../lib/supabase';
import { Hospital } from '@mediconnect/shared';

export const hospitalService = {
  // Query verified hospitals
  async getNearbyHospitals(): Promise<Hospital[]> {
    try {
      const { data, error } = await supabase
        .from('hospitals')
        .select('*')
        .eq('is_verified', true);

      if (error || !data) return [];

      return data.map((h: any) => ({
        id: h.id,
        name: h.name,
        address: h.address,
        location: { latitude: 37.7725, longitude: -122.4532 },
        emergencyPhone: h.emergency_phone,
        icuBedsAvailable: h.icu_beds_available || 5,
        isVerified: h.is_verified
      }));
    } catch {
      return [];
    }
  },

  // Assign hospital destination to active emergency
  async selectHospital(emergencyId: string, hospitalId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('emergency_requests')
        .update({ selected_hospital_id: hospitalId })
        .eq('id', emergencyId);

      return !error;
    } catch {
      return false;
    }
  }
};
