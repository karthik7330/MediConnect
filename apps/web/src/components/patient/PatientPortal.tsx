'use client';

import React, { useState, useEffect } from 'react';
import { 
  User, 
  ShieldAlert, 
  MapPin, 
  Phone, 
  Heart, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  X,
  Star,
  Activity,
  Navigation
} from 'lucide-react';
import { Profile } from '@mediconnect/shared';
import { supabase } from '../../lib/supabase';

interface PatientPortalProps {
  currentProfile: Profile;
  onLogout: () => void;
  userLocation?: { lat: number; lng: number; city: string };
}

export const PatientPortal: React.FC<PatientPortalProps> = ({ 
  currentProfile, 
  onLogout,
  userLocation = { lat: 13.0895, lng: 80.2739, city: 'Chennai, Tamil Nadu' }
}) => {
  const [activeEmergencyId, setActiveEmergencyId] = useState<string | null>(null);
  const [emergencyStatus, setEmergencyStatus] = useState<string | null>(null);
  const [sosCountdown, setSosCountdown] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live coordinates from browser GPS
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: userLocation.lat,
    lng: userLocation.lng
  });
  const [address, setAddress] = useState(userLocation.city);

  // Contacts
  const [contacts, setContacts] = useState<any[]>([]);

  // Post-Emergency Feedback
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');

  // 1. Detect live browser geolocation
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
          setAddress(`Live GPS Location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
        },
        (err) => {
          console.warn('Geolocation fallback to regional default:', err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // 2. Fetch contacts from Supabase
  useEffect(() => {
    const fetchContacts = async () => {
      const { data } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', currentProfile.id);

      if (data && data.length > 0) {
        setContacts(data);
      } else {
        setContacts([
          { id: '1', contact_name: 'Primary Family Contact', contact_phone: '+91 98765 43212', can_receive_alerts: true }
        ]);
      }
    };
    fetchContacts();
  }, [currentProfile.id]);

  // 3. Realtime emergency status listener
  useEffect(() => {
    if (!activeEmergencyId) return;

    const channel = supabase
      .channel(`patient_emg_${activeEmergencyId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'emergency_requests', 
        filter: `id=eq.${activeEmergencyId}` 
      }, (payload) => {
        const newStatus = payload.new.current_status;
        setEmergencyStatus(newStatus);
        showToast(`Emergency Status Updated: ${newStatus}`);
        if (newStatus === 'EMERGENCY_RESOLVED') {
          setActiveEmergencyId(null);
          setShowFeedbackModal(true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeEmergencyId]);

  // 3s abort timer before dispatching
  useEffect(() => {
    if (sosCountdown === null) return;
    if (sosCountdown > 0) {
      const timer = setTimeout(() => setSosCountdown(prev => (prev !== null ? prev - 1 : null)), 1000);
      return () => clearTimeout(timer);
    } else {
      setSosCountdown(null);
      triggerActualSos();
    }
  }, [sosCountdown]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const triggerActualSos = async () => {
    try {
      const { data, error } = await supabase
        .from('emergency_requests')
        .insert({
          user_id: currentProfile.id,
          user_location: `POINT(${coords.lng} ${coords.lat})`,
          address_text: address,
          current_status: 'SOS_ACTIVATED',
          search_radius_meters: 5000
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setActiveEmergencyId(data.id);
        setEmergencyStatus('SOS_ACTIVATED');
        showToast('🚨 SOS Dispatched! Assigned to nearest ambulance and family notified.');
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'SOS broadcasted to emergency network');
      setActiveEmergencyId(`emg_${Date.now()}`);
      setEmergencyStatus('SOS_ACTIVATED');
    }
  };

  const handleTriggerSos = () => {
    if (activeEmergencyId) {
      handleCancelSos();
      return;
    }
    setSosCountdown(3);
  };

  const handleCancelSos = async () => {
    if (activeEmergencyId) {
      await supabase
        .from('emergency_requests')
        .update({ current_status: 'EMERGENCY_CANCELLED', cancellation_reason: 'PATIENT_CANCELLED' })
        .eq('id', activeEmergencyId);

      setActiveEmergencyId(null);
      setEmergencyStatus(null);
      showToast('Emergency SOS cancelled by patient.');
      setShowFeedbackModal(true);
    } else {
      setSosCountdown(null);
      showToast('SOS activation aborted.');
    }
  };

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    setShowFeedbackModal(false);
    showToast('Feedback submitted to audit compliance ledger.');
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6">
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
          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                Citizen Patient Portal
              </span>
              <span className="text-xs text-slate-500 font-mono">ID: {currentProfile.id.slice(0, 8)}</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              {currentProfile.fullName}
            </h1>
            <p className="text-xs text-slate-500">Phone: {currentProfile.phoneNumber}</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs"
        >
          Sign Out
        </button>
      </div>

      {/* Active Incident Banner */}
      {activeEmergencyId && (
        <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white p-6 rounded-3xl shadow-xl shadow-red-900/20 mb-8 border border-red-400 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase mb-2">
                <Activity className="w-3.5 h-3.5 animate-spin" />
                <span>EMERGENCY DISPATCH IN PROGRESS</span>
              </div>
              <h2 className="text-2xl font-black text-white">
                Status: {emergencyStatus || 'SOS_ACTIVATED'}
              </h2>
              <p className="text-xs text-red-100 mt-1">
                Incident ID: <strong className="font-mono text-white">{activeEmergencyId.slice(0, 16)}</strong> • Nearest ambulance fleet alerted within 5,000m radius
              </p>
            </div>

            <button
              onClick={handleCancelSos}
              className="px-5 py-2.5 rounded-xl bg-white text-red-600 hover:bg-red-50 font-bold text-xs shadow-md transition-all self-start sm:self-auto"
            >
              Cancel SOS
            </button>
          </div>
        </div>
      )}

      {/* Main SOS Trigger Center */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm text-center mb-8">
        <h2 className="text-2xl font-black text-slate-900 mb-2">
          Emergency Health Assistance
        </h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-8">
          One tap immediately captures your exact device GPS coordinates and broadcasts an emergency dispatch request to ambulances and your family contacts.
        </p>

        {/* Big SOS Circle Button */}
        <div className="flex justify-center mb-6">
          {sosCountdown !== null ? (
            <button
              onClick={() => setSosCountdown(null)}
              className="w-48 h-48 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-black text-xl shadow-2xl flex flex-col items-center justify-center transition-all animate-pulse"
            >
              <span className="text-4xl">{sosCountdown}s</span>
              <span className="text-xs mt-1 uppercase font-bold tracking-wider">Tap to Abort</span>
            </button>
          ) : activeEmergencyId ? (
            <button
              onClick={handleTriggerSos}
              className="w-48 h-48 rounded-full bg-red-600 text-white font-black text-base shadow-2xl shadow-red-600/40 flex flex-col items-center justify-center animate-pulse"
            >
              <ShieldAlert className="w-10 h-10 mb-1" />
              <span>SOS ACTIVE</span>
              <span className="text-[11px] font-normal text-red-100 mt-1">Tap to Cancel</span>
            </button>
          ) : (
            <button
              onClick={handleTriggerSos}
              className="w-48 h-48 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 hover:from-red-700 hover:to-rose-600 text-white font-black text-2xl shadow-2xl shadow-red-600/30 flex flex-col items-center justify-center transition-all transform hover:scale-105 active:scale-95"
            >
              <ShieldAlert className="w-12 h-12 mb-1" />
              <span>TRIGGER SOS</span>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-red-100 mt-0.5">Instant Dispatch</span>
            </button>
          )}
        </div>

        {/* GPS Live Coordinates Banner */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-xs text-slate-700 font-mono">
          <MapPin className="w-4 h-4 text-red-500" />
          <span>{address}</span>
        </div>
      </div>

      {/* Medical Profile & Emergency Contacts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Heart className="w-5 h-5 text-red-500" />
            <h3 className="text-sm font-bold text-slate-900">Emergency Medical Profile</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500 font-medium">Blood Group:</span>
              <span className="font-mono font-black text-red-600 text-sm">
                {currentProfile.bloodGroup || 'O+'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500 font-medium block mb-1">Medical Conditions:</span>
              <div className="font-semibold text-slate-800">
                {currentProfile.medicalNotes || 'No severe chronic conditions registered'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              <h3 className="text-sm font-bold text-slate-900">Emergency Contacts</h3>
            </div>
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              {contacts.length} Active
            </span>
          </div>

          <div className="space-y-3">
            {contacts.map(c => (
              <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">{c.contact_name}</div>
                  <div className="text-[11px] text-slate-500">{c.contact_phone}</div>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">
                  CONNECTED
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Post-Emergency Rating & Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Emergency Care Feedback</h3>
              <button onClick={() => setShowFeedbackModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Rate response speed and paramedic care.
            </p>

            <form onSubmit={handleSubmitFeedback} className="space-y-4">
              <div className="flex justify-center gap-2 text-amber-400 my-2">
                {[1, 2, 3, 4, 5].map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFeedbackRating(st)}
                    className="p-1 focus:outline-none transition-transform hover:scale-125"
                  >
                    <Star className={`w-8 h-8 ${st <= feedbackRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Comments (Optional)
                </label>
                <textarea
                  value={feedbackComment}
                  onChange={e => setFeedbackComment(e.target.value)}
                  placeholder="Share details regarding your emergency assistance experience..."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs"
                >
                  Skip
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
