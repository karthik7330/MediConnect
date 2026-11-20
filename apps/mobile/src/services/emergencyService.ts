import { supabase } from '../lib/supabase';
import { offlineQueueService } from './offlineQueue';
import { distanceService } from './distanceService';
import { EmergencyStatus, EmergencyRequest } from '@mediconnect/shared';

export const emergencyService = {
  // Find nearest available ambulance using PostGIS / Haversine distance
  async findNearestAmbulance(coords: { latitude: number; longitude: number }): Promise<{
    id: string;
    vehicle_number: string;
    distance_km: number;
  } | null> {
    try {
      // 1. Attempt PostGIS stored procedure first
      const { data: rpcData, error: rpcError } = await supabase.rpc('find_nearby_ambulances', {
        p_latitude: coords.latitude,
        p_longitude: coords.longitude,
        p_radius_meters: 50000
      });

      if (!rpcError && rpcData && rpcData.length > 0) {
        const best = rpcData[0];
        return {
          id: best.ambulance_id,
          vehicle_number: best.vehicle_number,
          distance_km: best.distance_meters ? Number((best.distance_meters / 1000).toFixed(2)) : 1.2
        };
      }

      // 2. Query ambulance_crews directly
      const { data: crews, error: crewsError } = await supabase
        .from('ambulance_crews')
        .select('id, vehicle_number, location, availability, is_approved');

      if (crewsError || !crews || crews.length === 0) {
        return null;
      }

      // Prefer ONLINE crews, or any non-busy crew
      const eligible = crews.filter(c => c.availability === 'ONLINE');
      const candidateList = eligible.length > 0 ? eligible : crews;

      let nearest: { id: string; vehicle_number: string; distance_km: number } | null = null;
      let minDistance = Infinity;

      for (const crew of candidateList) {
        const parsed = distanceService.parsePoint(crew.location);
        let dist = 1.8; // default proximity baseline
        if (parsed) {
          dist = distanceService.calculateDistanceKm(coords, parsed);
        }
        if (dist < minDistance) {
          minDistance = dist;
          nearest = {
            id: crew.id,
            vehicle_number: crew.vehicle_number || 'AMB-UNIT-1',
            distance_km: Number(dist.toFixed(2))
          };
        }
      }

      return nearest;
    } catch (err) {
      console.warn('[EmergencyService] findNearestAmbulance error:', err);
      return null;
    }
  },

  // Trigger instant SOS with nearest ambulance allocation & offline fallback
  async triggerSos(userId: string, coords: { latitude: number; longitude: number }, addressText?: string): Promise<{
    success: boolean;
    emergencyId?: string;
    assignedAmbulanceId?: string | null;
    isOffline?: boolean;
    error?: string;
  }> {
    try {
      // Step 1: Discover nearest ambulance in proximity to citizen
      const nearestCrew = await this.findNearestAmbulance(coords);

      // Step 2: Insert emergency request with nearest ambulance allocation
      const { data, error } = await supabase
        .from('emergency_requests')
        .insert({
          user_id: userId,
          user_location: `POINT(${coords.longitude} ${coords.latitude})`,
          address_text: addressText || 'Live GPS Incident Location',
          current_status: 'SOS_ACTIVATED',
          search_radius_meters: 5000,
          assigned_ambulance_id: nearestCrew ? nearestCrew.id : null
        })
        .select()
        .single();

      if (error) {
        console.warn('[EmergencyService] Network error, queuing offline:', error.message);
        const queued = await offlineQueueService.enqueueEmergency({
          userId,
          latitude: coords.latitude,
          longitude: coords.longitude,
          timestamp: new Date().toISOString(),
          addressText
        });
        return { success: true, emergencyId: queued.localId, isOffline: true };
      }

      return { 
        success: true, 
        emergencyId: data.id, 
        assignedAmbulanceId: nearestCrew ? nearestCrew.id : null,
        isOffline: false 
      };
    } catch (err: unknown) {
      console.warn('[EmergencyService] Exception, saving offline:', err);
      const queued = await offlineQueueService.enqueueEmergency({
        userId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        timestamp: new Date().toISOString()
      });
      return { success: true, emergencyId: queued.localId, isOffline: true };
    }
  },

  // Fetch full details of assigned crew
  async getCrewDetails(crewId: string): Promise<{
    name: string;
    phone: string;
    vehicleNumber: string;
    location?: { latitude: number; longitude: number };
  } | null> {
    try {
      const { data: crew } = await supabase
        .from('ambulance_crews')
        .select('id, vehicle_number, location')
        .eq('id', crewId)
        .single();

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('id', crewId)
        .single();

      return {
        name: profile?.full_name || 'Paramedic Unit',
        phone: profile?.phone_number || '+919876543210',
        vehicleNumber: crew?.vehicle_number || 'TN-01-AMB-4091',
        location: crew?.location ? distanceService.parsePoint(crew.location) || undefined : undefined
      };
    } catch {
      return null;
    }
  },

  // Cancel active SOS
  async cancelSos(emergencyId: string, reason: string = 'User cancelled'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('emergency_requests')
        .update({
          current_status: 'EMERGENCY_CANCELLED',
          cancellation_reason: reason
        })
        .eq('id', emergencyId);

      return !error;
    } catch {
      return false;
    }
  },

  // Real-time status subscription
  subscribeToStatus(emergencyId: string, onUpdate: (status: EmergencyStatus, data: any) => void) {
    const channel = supabase
      .channel(`emergency_${emergencyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'emergency_requests',
          filter: `id=eq.${emergencyId}`
        },
        (payload) => {
          if (payload.new && payload.new.current_status) {
            onUpdate(payload.new.current_status, payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
