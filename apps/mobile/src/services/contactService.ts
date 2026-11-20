import { supabase } from '../lib/supabase';
import { ConnectionRequest, EmergencyContact } from '@mediconnect/shared';

// Helper to normalize phone numbers (compares last 10 digits to prevent formatting mismatches)
export const normalizePhone = (phone: string): string => {
  const digitsOnly = phone.replace(/[^0-9]/g, '');
  if (digitsOnly.length >= 10) {
    return digitsOnly.slice(-10);
  }
  return digitsOnly;
};

export const contactService = {
  // Send connection request from a Citizen to an Emergency Contact's phone
  async sendConnectionRequest(
    senderUserId: string,
    senderName: string,
    recipientPhone: string
  ): Promise<{ success: boolean; request?: ConnectionRequest; error?: string }> {
    try {
      const cleanPhone = recipientPhone.trim();

      const { data, error } = await supabase
        .from('connection_requests')
        .insert({
          sender_user_id: senderUserId,
          sender_name: senderName || 'Citizen User',
          recipient_phone: cleanPhone,
          status: 'PENDING'
        })
        .select()
        .single();

      if (error) {
        console.error('[contactService] Error sending request:', error.message);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        request: {
          id: data.id,
          senderUserId: data.sender_user_id,
          senderName: data.sender_name,
          recipientPhone: data.recipient_phone,
          status: data.status,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to send request' };
    }
  },

  // Query all sent requests by a Citizen to see status (PENDING / ACCEPTED / REJECTED)
  async getSentRequests(senderUserId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('sender_user_id', senderUserId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      return data;
    } catch {
      return [];
    }
  },

  // Query incoming pending requests for an Emergency Contact based on their phone number
  async getIncomingRequests(recipientPhone: string): Promise<any[]> {
    try {
      if (!recipientPhone) return [];
      const cleanInput = normalizePhone(recipientPhone);

      const { data, error } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      // Filter by comparing normalized last 10 digits or exact string match
      const matching = data.filter(req => {
        const reqNorm = normalizePhone(req.recipient_phone || '');
        return reqNorm === cleanInput || req.recipient_phone === recipientPhone;
      });

      return matching;
    } catch {
      return [];
    }
  },

  // Accept or reject connection request
  async respondToRequest(
    requestId: string,
    recipientUserId: string,
    status: 'ACCEPTED' | 'REJECTED'
  ): Promise<boolean> {
    try {
      const { data: request, error: updateError } = await supabase
        .from('connection_requests')
        .update({
          status,
          recipient_user_id: recipientUserId,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single();

      if (updateError || !request) {
        console.error('[contactService] Update error:', updateError?.message);
        return false;
      }

      // If accepted, establish reciprocal emergency contact link
      if (status === 'ACCEPTED') {
        const { error: insertErr } = await supabase.from('emergency_contacts').upsert([
          {
            user_id: request.sender_user_id,
            contact_user_id: recipientUserId,
            contact_name: request.sender_name,
            can_receive_alerts: true
          }
        ]);
        if (insertErr) {
          console.warn('[contactService] emergency_contacts link warning:', insertErr.message);
        }
      }

      return true;
    } catch (err) {
      console.error('[contactService] Response exception:', err);
      return false;
    }
  },

  // Query registered emergency contacts for user
  async getContacts(userId: string): Promise<EmergencyContact[]> {
    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', userId);

      if (error || !data) return [];

      return data.map((c: any) => ({
        id: c.id,
        userId: c.user_id,
        contactUserId: c.contact_user_id,
        contactName: c.contact_name,
        canReceiveAlerts: c.can_receive_alerts,
        createdAt: c.created_at
      }));
    } catch {
      return [];
    }
  },

  // Query connected citizens that this emergency contact is protecting
  async getConnectedCitizens(recipientPhone: string, contactUserId: string): Promise<any[]> {
    try {
      const cleanInput = normalizePhone(recipientPhone || '');

      const { data, error } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('status', 'ACCEPTED')
        .order('updated_at', { ascending: false });

      if (error || !data) return [];

      const matching = data.filter(req => {
        const reqNorm = normalizePhone(req.recipient_phone || '');
        return reqNorm === cleanInput || req.recipient_user_id === contactUserId || req.recipient_phone === recipientPhone;
      });

      return matching;
    } catch {
      return [];
    }
  }
};
