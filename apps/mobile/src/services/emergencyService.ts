import { supabase } from '../lib/supabase';
import { offlineQueueService } from './offlineQueue';
import { EmergencyStatus, EmergencyRequest } from '@mediconnect/shared';

export const emergencyService = {
  // Trigger instant SOS with offline fallback
  async triggerSos(userId: string, coords: { latitude: number; longitude: number }, addressText?: string): Promise<{
    success: boolean;
    emergencyId?: string;
    isOffline?: boolean;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('emergency_requests')
        .insert({
          user_id: userId,
          user_location: `POINT(${coords.longitude} ${coords.latitude})`,
          address_text: addressText || 'Live GPS Incident Location',
          current_status: 'SOS_ACTIVATED',
          search_radius_meters: 5000
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

      return { success: true, emergencyId: data.id, isOffline: false };
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
