'use client';

import React, { useState, useEffect } from 'react';
import { UserRole, Profile } from '@mediconnect/shared';
import { RoleBasedLogin } from '../components/auth/RoleBasedLogin';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { ShieldAlert, LogOut, MapPin } from 'lucide-react';

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; city: string }>({
    lat: 13.0895,
    lng: 80.2739,
    city: 'Chennai, Tamil Nadu'
  });

  // Detect live browser geolocation
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            city: `Current Location (${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)})`
          });
        },
        () => {
          // Defaults to Chennai, Tamil Nadu
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      {/* Universal Top Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/30">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="font-black text-slate-900 text-sm tracking-tight flex items-center gap-2">
              <span>MediConnect</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded border border-emerald-200">
                ACTIVE
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Intelligent Emergency Assistance Architecture
            </div>
          </div>
        </div>

        {currentUser ? (
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 font-medium bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <MapPin className="w-3.5 h-3.5 text-red-500" />
              <span>{userLocation.city}</span>
            </div>

            <div className="text-right">
              <div className="text-xs font-bold text-slate-900">{currentUser.fullName}</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{currentUser.role.replace('_', ' ')}</div>
            </div>

            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="hidden sm:inline">System Ready • {userLocation.city}</span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        )}
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {!currentUser ? (
          <RoleBasedLogin
            onLoginSuccess={profile => setCurrentUser(profile)}
          />
        ) : (
          <AdminDashboard
            currentProfile={currentUser}
            onLogout={handleLogout}
            userLocation={userLocation}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-400">
        MediConnect Autonomous Emergency System • Connected to Supabase PostGIS & Resend 2FA
      </footer>
    </main>
  );
}
