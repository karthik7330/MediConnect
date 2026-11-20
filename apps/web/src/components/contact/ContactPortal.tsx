'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MapPin, 
  Clock, 
  Phone, 
  MessageSquare, 
  Hospital, 
  CheckCircle2, 
  Activity
} from 'lucide-react';
import { Profile } from '@mediconnect/shared';
import { supabase } from '../../lib/supabase';

interface ContactPortalProps {
  currentProfile: Profile;
  onLogout: () => void;
  userLocation?: { lat: number; lng: number; city: string };
}

export const ContactPortal: React.FC<ContactPortalProps> = ({ 
  currentProfile, 
  onLogout,
  userLocation = { lat: 13.0895, lng: 80.2739, city: 'Chennai, Tamil Nadu' }
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeEmergency, setActiveEmergency] = useState<any | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Listen to active emergencies in realtime
  useEffect(() => {
    const fetchActive = async () => {
      const { data } = await supabase
        .from('emergency_requests')
        .select('*')
        .neq('current_status', 'EMERGENCY_RESOLVED')
        .limit(1)
        .maybeSingle();

      if (data) {
        setActiveEmergency(data);
      }
    };

    fetchActive();

    const channel = supabase
      .channel('contact_family_stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_requests' }, () => {
        fetchActive();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCallParamedic = () => {
    showToast('Initiating masked proxy call to dispatched paramedic...');
  };

  const handleSendSms = () => {
    showToast('Dispatched emergency SMS alert: "Emergency contact is monitoring live status."');
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Emergency Contact Safety Portal
              </span>
              <span className="text-xs text-slate-500 font-medium">Family Safety Net</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              {currentProfile.fullName}
            </h1>
            <p className="text-xs text-slate-500 font-mono">Verified Contact: {currentProfile.phoneNumber}</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs"
        >
          Sign Out
        </button>
      </div>

      {/* Active Family Alert Card */}
      {activeEmergency ? (
        <div className="bg-gradient-to-br from-red-600 via-rose-600 to-red-700 text-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-red-900/20 mb-8 border border-red-500 animate-in fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-red-500/60">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider mb-2">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>LIVE INCIDENT TELEMETRY</span>
              </div>
              <h2 className="text-2xl font-black text-white">
                Emergency In Progress
              </h2>
              <p className="text-xs text-red-100 mt-1">
                Incident ID: <span className="font-mono font-bold text-white">{activeEmergency.id.slice(0, 16)}</span>
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 text-center shrink-0">
              <div className="text-[11px] uppercase tracking-wider text-red-100 font-bold">Status</div>
              <div className="text-xl font-black text-white">{activeEmergency.current_status}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/15">
              <div className="flex items-center gap-2 text-red-200 text-xs font-bold uppercase tracking-wider mb-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>Scene Location</span>
              </div>
              <div className="text-sm font-semibold text-white">{activeEmergency.address_text || userLocation.city}</div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/15">
              <div className="flex items-center gap-2 text-red-200 text-xs font-bold uppercase tracking-wider mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Dispatch Radius</span>
              </div>
              <div className="text-sm font-semibold text-white">{activeEmergency.search_radius_meters}m radial geofence</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-6 mt-6 border-t border-red-500/60">
            <button
              onClick={handleCallParamedic}
              className="px-5 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-red-50 font-bold text-xs flex items-center gap-2 shadow-md transition-all"
            >
              <Phone className="w-4 h-4 text-emerald-600" />
              <span>Call Dispatched Paramedic</span>
            </button>

            <button
              onClick={handleSendSms}
              className="px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center gap-2 border border-white/30 transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Send Quick Status SMS</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            All Monitored Family Members Are Safe
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            You will receive instant push notifications and phone alerts the moment an SOS is triggered by any connected member.
          </p>
        </div>
      )}
    </div>
  );
};
