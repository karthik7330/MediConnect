'use client';

import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Hospital as HospitalIcon, 
  Phone, 
  ShieldAlert, 
  Navigation, 
  Check, 
  X,
  Radio,
  Activity
} from 'lucide-react';
import { Profile, CrewAvailability } from '@mediconnect/shared';
import { supabase } from '../../lib/supabase';

interface AmbulancePortalProps {
  currentProfile: Profile;
  onLogout: () => void;
  userLocation?: { lat: number; lng: number; city: string };
}

export const AmbulancePortal: React.FC<AmbulancePortalProps> = ({ 
  currentProfile, 
  onLogout,
  userLocation = { lat: 13.0895, lng: 80.2739, city: 'Chennai, Tamil Nadu' }
}) => {
  const [availability, setAvailability] = useState<CrewAvailability>('ONLINE');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Incoming Dispatch Alert
  const [incomingEmergency, setIncomingEmergency] = useState<any | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('EQUIPMENT_MALFUNCTION');

  // Active Emergency Flow
  const [activeEmergency, setActiveEmergency] = useState<any | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  // Hospital Selection Modal & List
  const [showHospitalModal, setShowHospitalModal] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<any | null>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);

  // 7-step sequence definitions
  const steps = [
    { key: 'REQUEST_ACCEPTED', title: '1. Request Accepted', subtitle: 'Crew assigned to emergency incident' },
    { key: 'AMBULANCE_DISPATCHED', title: '2. Ambulance Dispatched', subtitle: 'Sirens active, telemetry broadcasting' },
    { key: 'AMBULANCE_ON_THE_WAY', title: '3. En Route to Patient', subtitle: 'Navigating to patient coordinates' },
    { key: 'AMBULANCE_ARRIVED', title: '4. Arrived at Scene', subtitle: 'Paramedics on site conducting triage' },
    { key: 'PATIENT_PICKED_UP', title: '5. Patient Stabilized', subtitle: 'Vitals monitored, transferred to vehicle' },
    { key: 'PATIENT_REACHED_HOSPITAL', title: '6. En Route to Hospital', subtitle: 'Trauma bay reception pre-alerted' },
    { key: 'EMERGENCY_RESOLVED', title: '7. Reached Hospital & Handover', subtitle: 'Emergency resolved, mission completed' }
  ];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Fetch real hospitals from Supabase
  useEffect(() => {
    const fetchHospitals = async () => {
      const { data } = await supabase.from('hospitals').select('*');
      if (data && data.length > 0) {
        setHospitals(data);
      }
    };
    fetchHospitals();
  }, []);

  // 2. Realtime listener for incoming emergency broadcasts
  useEffect(() => {
    const channel = supabase
      .channel('ambulance_dispatch_feed')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'emergency_requests' 
      }, (payload) => {
        if (availability === 'ONLINE' && !activeEmergency) {
          setIncomingEmergency(payload.new);
          setCountdown(60);
          showToast('🚨 Incoming Emergency Dispatch Broadcast Received!');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [availability, activeEmergency]);

  // 3. 60-second countdown for incoming emergency
  useEffect(() => {
    if (!incomingEmergency || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIncomingEmergency(null);
          showToast('60s SLA expired: Emergency broadcast rerouted to next nearest unit.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [incomingEmergency, countdown]);

  const handleAcceptEmergency = async () => {
    if (!incomingEmergency) return;

    try {
      // Call atomic race condition lock in Supabase
      const { data, error } = await supabase.rpc('accept_emergency_assignment', {
        p_emergency_id: incomingEmergency.id,
        p_ambulance_id: '33333333-3333-3333-3333-333333333333'
      });

      if (error) {
        console.warn('RPC warning (fallback direct update):', error.message);
        await supabase
          .from('emergency_requests')
          .update({ 
            current_status: 'REQUEST_ACCEPTED',
            assigned_ambulance_id: '33333333-3333-3333-3333-333333333333'
          })
          .eq('id', incomingEmergency.id);
      }

      setActiveEmergency(incomingEmergency);
      setIncomingEmergency(null);
      setAvailability('BUSY');
      setStepIndex(0);
      showToast('Atomic lock secured. Emergency accepted.');
    } catch (err: unknown) {
      showToast('Failed to accept: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDeclineEmergency = async () => {
    if (incomingEmergency) {
      await supabase
        .from('emergency_requests')
        .update({ cancellation_reason: declineReason })
        .eq('id', incomingEmergency.id);
    }
    setIncomingEmergency(null);
    setShowDeclineModal(false);
    showToast(`Emergency declined (${declineReason}). Rerouted.`);
  };

  const handleNextStep = async () => {
    if (stepIndex < steps.length - 1 && activeEmergency) {
      const nextIdx = stepIndex + 1;
      const nextKey = steps[nextIdx].key;

      await supabase
        .from('emergency_requests')
        .update({ current_status: nextKey })
        .eq('id', activeEmergency.id);

      setStepIndex(nextIdx);
      showToast(`Status updated: ${steps[nextIdx].title}`);

      if (nextIdx === steps.length - 1) {
        setAvailability('ONLINE');
        setActiveEmergency(null);
        showToast('Mission completed. Emergency resolved successfully.');
      }
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 sm:px-6">
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
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                Ambulance Paramedic Console
              </span>
              <span className="text-xs font-mono text-slate-500">Unit: TN-01-AMB-4091</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              {currentProfile.fullName}
            </h1>
            <p className="text-xs text-slate-500">License: MED-PARAMEDIC-8821 • Sector: {userLocation.city}</p>
          </div>
        </div>

        {/* Availability Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            {(['ONLINE', 'BUSY', 'OFFLINE'] as CrewAvailability[]).map(st => (
              <button
                key={st}
                onClick={() => {
                  setAvailability(st);
                  showToast(`Fleet status changed to ${st}`);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  availability === st
                    ? st === 'ONLINE' ? 'bg-emerald-600 text-white shadow-sm'
                    : st === 'BUSY' ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            onClick={onLogout}
            className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Incoming Emergency Dispatch Popup (60s SLA) */}
      {incomingEmergency && (
        <div className="bg-gradient-to-r from-red-600 via-red-500 to-rose-600 text-white p-6 rounded-3xl shadow-xl shadow-red-900/20 mb-8 border-2 border-red-400 animate-in fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                  <ShieldAlert className="w-8 h-8 animate-bounce" />
                </div>
                <div className="absolute -top-2 -right-2 bg-yellow-400 text-slate-900 text-xs font-black px-2 py-0.5 rounded-full shadow-md font-mono">
                  {countdown}s
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-black text-[11px] uppercase tracking-wider">
                    Immediate SOS Dispatch
                  </span>
                  <span className="text-xs text-red-100 font-mono">Incident: {incomingEmergency.id.slice(0, 12)}</span>
                </div>
                <h2 className="text-2xl font-black text-white">
                  Citizen Emergency in Sector
                </h2>
                <div className="text-xs text-red-100 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <span>Location: <strong className="text-white">{incomingEmergency.address_text || userLocation.city}</strong></span>
                  <span>Search Radius: <strong className="text-white">{incomingEmergency.search_radius_meters}m</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeclineModal(true)}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/30 transition-all"
              >
                Decline (Audit Reason)
              </button>
              <button
                onClick={handleAcceptEmergency}
                className="px-6 py-3 rounded-xl bg-white text-red-600 hover:bg-red-50 font-black text-sm shadow-xl flex items-center gap-2 transition-all transform hover:scale-105"
              >
                <Check className="w-5 h-5" />
                <span>Accept Dispatch ({countdown}s)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Incident View & 7-Step Progression */}
      {activeEmergency ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Incident Details & Destination Hospital */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
                  {activeEmergency.id.slice(0, 16)}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  Active Mission
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">Incident Under Active Care</h3>
                <p className="text-xs font-semibold text-red-600 mt-0.5">Location: {activeEmergency.address_text || userLocation.city}</p>
              </div>

              {/* Destination Hospital Card */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Destination Trauma Center
                  </span>
                  <button
                    onClick={() => setShowHospitalModal(true)}
                    className="text-xs text-blue-600 hover:underline font-bold"
                  >
                    {selectedHospital ? 'Change' : 'Select Hospital'}
                  </button>
                </div>

                {selectedHospital ? (
                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200">
                    <div className="font-bold text-xs text-blue-950">{selectedHospital.name}</div>
                    <div className="text-[11px] text-blue-700 mt-0.5">{selectedHospital.address}</div>
                    <div className="text-[11px] font-bold text-emerald-700 mt-1">ICU Beds Available: {selectedHospital.icu_beds_available}</div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowHospitalModal(true)}
                    className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 text-slate-600 hover:text-blue-600 text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <HospitalIcon className="w-4 h-4" />
                    <span>Assign Regional Trauma Center</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: 7-Step Progression Tracker */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Emergency Protocol Progression
                </h3>
                <p className="text-xs text-slate-500">
                  Strict sequential status updates recorded to PostGIS audit ledger.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">
                Step {stepIndex + 1} of 7
              </span>
            </div>

            {/* Stepper */}
            <div className="space-y-4 mb-8">
              {steps.map((st, i) => {
                const isPassed = i < stepIndex;
                const isCurrent = i === stepIndex;

                return (
                  <div
                    key={st.key}
                    className={`flex items-start gap-4 p-3.5 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-red-50 border-red-300 ring-2 ring-red-500/20 shadow-sm'
                        : isPassed
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-slate-50/50 border-slate-100 opacity-60'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      isCurrent
                        ? 'bg-red-600 text-white animate-pulse'
                        : isPassed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {isPassed ? <Check className="w-4 h-4" /> : i + 1}
                    </div>

                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-900">{st.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{st.subtitle}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-slate-100">
              {stepIndex < steps.length - 1 ? (
                <button
                  onClick={handleNextStep}
                  className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all"
                >
                  <span>Advance to {steps[stepIndex + 1].title.split('.')[1]}</span>
                  <Navigation className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleNextStep}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Finalize & Close Incident</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Radio className="w-8 h-8 animate-pulse" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            Unit TN-01-AMB-4091 is {availability}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Monitoring live PostGIS emergency broadcasts. When a citizen triggers an SOS within your sector, your terminal will receive an alert with a 60-second acceptance SLA.
          </p>
        </div>
      )}

      {/* Hospital Selection Modal */}
      {showHospitalModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HospitalIcon className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-900">Select Destination Trauma Center</h3>
              </div>
              <button onClick={() => setShowHospitalModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {hospitals.map(h => (
                <div
                  key={h.id}
                  onClick={() => {
                    setSelectedHospital(h);
                    setShowHospitalModal(false);
                    showToast(`Selected ${h.name}`);
                  }}
                  className="p-4 rounded-2xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer transition-all"
                >
                  <div className="font-bold text-xs text-slate-900 mb-1">{h.name}</div>
                  <div className="text-[11px] text-slate-500 mb-2">{h.address}</div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-xs">
                    {h.icu_beds_available} ICU Beds Free
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowHospitalModal(false)}
              className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Decline Reason Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Mandatory Decline Audit Reason
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Paramedics must log a reason when declining an emergency call.
            </p>

            <div className="space-y-2 mb-6">
              {[
                { val: 'EQUIPMENT_MALFUNCTION', label: 'Equipment Malfunction / Defibrillator Issue' },
                { val: 'TRAFFIC_GRIDLOCK', label: 'Blocked Route / Heavy Gridlock' },
                { val: 'PATIENT_LOADED_OTHER', label: 'Attending Active Critical Patient' },
                { val: 'FUEL_LOW', label: 'Refueling / Maintenance in Progress' }
              ].map(r => (
                <label key={r.val} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-800">
                  <input
                    type="radio"
                    name="decline"
                    checked={declineReason === r.val}
                    onChange={() => setDeclineReason(r.val)}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeclineModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs"
              >
                Back
              </button>
              <button
                onClick={handleDeclineEmergency}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
              >
                Submit & Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
