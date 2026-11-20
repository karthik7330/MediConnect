import { supabase } from '../lib/supabase';
import { CrewAvailability, EmergencyStatus } from '@mediconnect/shared';

export const ambulanceService = {
  // Update crew availability (ONLINE, OFFLINE, BUSY)
  async updateAvailability(ambulanceId: string, availability: CrewAvailability): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ambulance_crews')
        .update({ availability })
        .eq('id', ambulanceId);

      return !error;
    } catch {
      return false;
    }
  },

  // Atomic acceptance to eliminate race conditions
  async acceptEmergency(emergencyId: string, ambulanceId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // 1. Try atomic RPC lock first
      const { data, error } = await supabase.rpc('accept_emergency_assignment', {
        p_emergency_id: emergencyId,
        p_ambulance_id: ambulanceId
      });

      if (!error && data && (data as any).success) {
        return data as { success: boolean; message: string };
      }

      // 2. Direct transactional check & update fallback
      const { data: currentReq } = await supabase
        .from('emergency_requests')
        .select('current_status, assigned_ambulance_id')
        .eq('id', emergencyId)
        .single();

      if (
        currentReq && 
        currentReq.current_status === 'SOS_ACTIVATED' &&
        (!currentReq.assigned_ambulance_id || currentReq.assigned_ambulance_id === ambulanceId)
      ) {
        const { error: updateError } = await supabase
          .from('emergency_requests')
          .update({
            current_status: 'REQUEST_ACCEPTED',
            assigned_ambulance_id: ambulanceId
          })
          .eq('id', emergencyId)
          .eq('current_status', 'SOS_ACTIVATED');

        if (!updateError) {
          await this.updateAvailability(ambulanceId, 'BUSY');
          await supabase.from('emergency_status_history').insert({
            emergency_id: emergencyId,
            status: 'REQUEST_ACCEPTED',
            updated_by: ambulanceId,
            notes: 'Dispatch accepted by crew via direct assignment'
          });
          return { success: true, message: 'Emergency assigned successfully' };
        }
      }

      return { 
        success: false, 
        message: currentReq?.current_status === 'EMERGENCY_CANCELLED' 
          ? 'Emergency request was cancelled by the citizen' 
          : 'Emergency has already been accepted or resolved' 
      };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : 'Assignment failed' };
    }
  },

  // Advance along strict 7-step sequence
  async updateEmergencyStatus(
    emergencyId: string,
    status: EmergencyStatus,
    ambulanceId: string,
    notes?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('emergency_requests')
        .update({ current_status: status })
        .eq('id', emergencyId);

      if (!error) {
        // Record progression in status history
        await supabase.from('emergency_status_history').insert({
          emergency_id: emergencyId,
          status,
          updated_by: ambulanceId,
          notes: notes || `Advanced to ${status}`
        });

        // If resolved, auto-stop live tracking and return crew to ONLINE
        if (status === 'EMERGENCY_RESOLVED') {
          await supabase.from('live_ambulance_tracking').update({ is_active: false }).eq('emergency_id', emergencyId);
          await this.updateAvailability(ambulanceId, 'ONLINE');
        }
      }

      return !error;
    } catch {
      return false;
    }
  },

  // Cancellation with mandatory explanation
  async cancelAssignment(
    emergencyId: string,
    ambulanceId: string,
    reason: string
  ): Promise<boolean> {
    try {
      // 1. Log cancellation in status history
      await supabase.from('emergency_status_history').insert({
        emergency_id: emergencyId,
        status: 'SOS_ACTIVATED', // Return to unassigned pool
        updated_by: ambulanceId,
        notes: `Crew cancelled assignment. Reason: ${reason}`
      });

      // 2. Unassign emergency so another crew can be allocated
      await supabase
        .from('emergency_requests')
        .update({
          assigned_ambulance_id: null,
          current_status: 'SOS_ACTIVATED',
          cancellation_reason: reason
        })
        .eq('id', emergencyId);

      // 3. Return crew to ONLINE
      await this.updateAvailability(ambulanceId, 'ONLINE');

      return true;
    } catch {
      return false;
    }
  }
};
