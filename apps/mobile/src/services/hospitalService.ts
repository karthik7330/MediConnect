import { supabase, supabaseAdmin } from '../lib/supabase';
import { Hospital } from '@mediconnect/shared';

export const hospitalService = {
  // Query verified hospitals
  async getNearbyHospitals(): Promise<Hospital[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('hospitals')
        .select('*')
        .eq('is_verified', true);

      if (error || !data) return [];

      return data.map((h: any) => ({
        id: h.id,
        name: h.name,
        address: h.address,
        location: { latitude: 13.0604, longitude: 80.2496 },
        emergencyPhone: h.emergency_phone,
        icuBedsAvailable: h.icu_beds_available || 0,
        isVerified: h.is_verified
      }));
    } catch {
      return [];
    }
  },

  // Assign hospital destination to active emergency
  async selectHospital(emergencyId: string, hospitalId: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('emergency_requests')
        .update({ selected_hospital_id: hospitalId })
        .eq('id', emergencyId);

      return !error;
    } catch {
      return false;
    }
  },

  // Adjust hospital ICU beds directly
  async updateIcuBeds(hospitalId: string, delta: number): Promise<number | null> {
    try {
      const { data: hosp } = await supabaseAdmin
        .from('hospitals')
        .select('icu_beds_available')
        .eq('id', hospitalId)
        .single();

      if (!hosp) return null;

      const newBeds = Math.max(0, (hosp.icu_beds_available || 0) + delta);
      await supabaseAdmin
        .from('hospitals')
        .update({ icu_beds_available: newBeds })
        .eq('id', hospitalId);

      return newBeds;
    } catch {
      return null;
    }
  }
};
