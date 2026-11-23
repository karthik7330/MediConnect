import { supabase, supabaseAdmin } from '../lib/supabase';
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

  // Atomic acceptance to eliminate race conditions & support admin manual override
  async acceptEmergency(emergencyId: string, ambulanceId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // 1. First check current request in Supabase
      const { data: currentReq } = await supabase
        .from('emergency_requests')
        .select('current_status, assigned_ambulance_id')
        .eq('id', emergencyId)
        .single();

      if (!currentReq) {
        return { success: false, message: 'Emergency request not found' };
      }

      if (currentReq.current_status === 'EMERGENCY_CANCELLED') {
        return { success: false, message: 'Emergency request was cancelled by the citizen' };
      }

      if (currentReq.current_status === 'EMERGENCY_RESOLVED') {
        return { success: false, message: 'Emergency has already been resolved' };
      }

      // Case A: Already assigned to THIS ambulance (e.g. by Admin Manual Dispatch Override)
      if (currentReq.assigned_ambulance_id === ambulanceId) {
        await this.updateAvailability(ambulanceId, 'BUSY');
        await supabase.from('emergency_status_history').insert({
          emergency_id: emergencyId,
          status: currentReq.current_status || 'REQUEST_ACCEPTED',
          updated_by: ambulanceId,
          notes: 'Ambulance crew confirmed assignment and initiated navigation'
        });
        return { success: true, message: 'Emergency assigned successfully' };
      }

      // Case B: Unassigned SOS - try atomic RPC lock first
      if (!currentReq.assigned_ambulance_id && currentReq.current_status === 'SOS_ACTIVATED') {
        const { data, error } = await supabase.rpc('accept_emergency_assignment', {
          p_emergency_id: emergencyId,
          p_ambulance_id: ambulanceId
        });

        if (!error && data && (data as any).success) {
          return data as { success: boolean; message: string };
        }

        // Direct transactional check & update fallback
        const { error: updateError } = await supabase
          .from('emergency_requests')
          .update({
            current_status: 'REQUEST_ACCEPTED',
            assigned_ambulance_id: ambulanceId
          })
          .eq('id', emergencyId)
          .eq('current_status', 'SOS_ACTIVATED')
          .is('assigned_ambulance_id', null);

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
        message: 'Emergency has already been accepted or resolved' 
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

        // If patient picked up, decrement ICU bed at destination hospital
        if (status === 'PATIENT_PICKED_UP') {
          try {
            const { data: reqData } = await supabaseAdmin
              .from('emergency_requests')
              .select('selected_hospital_id')
              .eq('id', emergencyId)
              .maybeSingle();

            const targetHospitalId = reqData?.selected_hospital_id || 'a1111111-1111-1111-1111-111111111111';

            if (!reqData?.selected_hospital_id) {
              await supabaseAdmin
                .from('emergency_requests')
                .update({ selected_hospital_id: targetHospitalId })
                .eq('id', emergencyId);
            }

            const { data: hosp } = await supabaseAdmin
              .from('hospitals')
              .select('id, name, icu_beds_available')
              .eq('id', targetHospitalId)
              .maybeSingle();

            if (hosp) {
              const newBeds = Math.max(0, (hosp.icu_beds_available ?? 1) - 1);
              await supabaseAdmin
                .from('hospitals')
                .update({ icu_beds_available: newBeds })
                .eq('id', targetHospitalId);
              console.log(`[AmbulanceService] Decremented ICU bed at ${hosp.name}. Remaining: ${newBeds}`);
            }
          } catch (bedErr) {
            console.warn('[AmbulanceService] Bed decrement warning:', bedErr);
          }
        }

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
