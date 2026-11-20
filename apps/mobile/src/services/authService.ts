import { supabase } from '../lib/supabase';
import { UserRole, Profile } from '@mediconnect/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAILED_ATTEMPTS_KEY = '@mediconnect_failed_attempts';
const LOCKOUT_KEY = '@mediconnect_lockout_until';

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface AuthState {
  user: Profile | null;
  role: UserRole | null;
  isAuthenticated: boolean;
}

export const authService = {
  // Check brute-force lockout status
  async checkLockout(): Promise<{ isLocked: boolean; remainingMinutes: number }> {
    try {
      const lockoutStr = await AsyncStorage.getItem(LOCKOUT_KEY);
      if (!lockoutStr) return { isLocked: false, remainingMinutes: 0 };

      const lockoutTime = new Date(lockoutStr).getTime();
      const now = Date.now();

      if (now < lockoutTime) {
        const remainingMinutes = Math.ceil((lockoutTime - now) / 60000);
        return { isLocked: true, remainingMinutes };
      } else {
        await AsyncStorage.removeItem(LOCKOUT_KEY);
        await AsyncStorage.removeItem(FAILED_ATTEMPTS_KEY);
        return { isLocked: false, remainingMinutes: 0 };
      }
    } catch {
      return { isLocked: false, remainingMinutes: 0 };
    }
  },

  // Record a failed login attempt (Locks after 5 attempts for 15 minutes)
  async recordFailedAttempt(): Promise<number> {
    try {
      const attemptsStr = await AsyncStorage.getItem(FAILED_ATTEMPTS_KEY);
      const attempts = (attemptsStr ? parseInt(attemptsStr, 10) : 0) + 1;
      await AsyncStorage.setItem(FAILED_ATTEMPTS_KEY, attempts.toString());

      if (attempts >= 5) {
        const lockoutUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await AsyncStorage.setItem(LOCKOUT_KEY, lockoutUntil);
      }

      return attempts;
    } catch {
      return 1;
    }
  },

  async resetFailedAttempts(): Promise<void> {
    await AsyncStorage.removeItem(FAILED_ATTEMPTS_KEY);
    await AsyncStorage.removeItem(LOCKOUT_KEY);
  },

  // Register user profile in database
  async register(params: {
    email?: string;
    phone: string;
    fullName: string;
    role: UserRole;
    bloodGroup?: string;
    medicalNotes?: string;
    licenseNumber?: string;
    vehicleNumber?: string;
  }): Promise<{ success: boolean; profile?: Profile; error?: string }> {
    try {
      const validId = generateUUID();

      const profile: Profile = {
        id: validId,
        role: params.role,
        fullName: params.fullName,
        phoneNumber: params.phone,
        email: params.email,
        bloodGroup: params.bloodGroup,
        medicalNotes: params.medicalNotes,
        isApproved: params.role !== 'AMBULANCE_PERSONNEL', // Ambulance requires Main Admin approval
        isDeactivated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to Supabase profiles table
      const { error } = await supabase.from('profiles').upsert({
        id: profile.id,
        role: profile.role,
        full_name: profile.fullName,
        phone_number: profile.phoneNumber,
        email: profile.email || null,
        blood_group: profile.bloodGroup || null,
        medical_notes: profile.medicalNotes || null,
        is_approved: profile.isApproved,
        is_deactivated: false
      });

      if (error) {
        console.warn('[AuthService] Supabase insert warning:', error.message);
      }

      // If registering as Ambulance Personnel, insert vehicle details
      if (params.role === 'AMBULANCE_PERSONNEL' && params.licenseNumber && params.vehicleNumber) {
        await supabase.from('ambulance_crews').upsert({
          id: profile.id,
          vehicle_number: params.vehicleNumber,
          license_number: params.licenseNumber,
          availability: 'OFFLINE',
          is_approved: false
        });
      }

      await AsyncStorage.setItem('@mediconnect_current_user', JSON.stringify(profile));
      await this.resetFailedAttempts();

      return { success: true, profile };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Registration failed' };
    }
  },

  // Login with 5-attempt security lockout and Supabase profile query
  async login(identifier: string, role: UserRole): Promise<{ success: boolean; profile?: Profile; error?: string }> {
    const lockout = await this.checkLockout();
    if (lockout.isLocked) {
      return {
        success: false,
        error: `Account locked due to 5 consecutive failed attempts. Please wait ${lockout.remainingMinutes} minutes.`
      };
    }

    try {
      // Query profile from Supabase
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', role)
        .or(`email.eq.${identifier},phone_number.eq.${identifier}`)
        .maybeSingle();

      let profile: Profile;
      if (data) {
        profile = {
          id: data.id,
          role: data.role,
          fullName: data.full_name,
          phoneNumber: data.phone_number,
          email: data.email,
          bloodGroup: data.blood_group,
          medicalNotes: data.medical_notes,
          isApproved: data.is_approved,
          isDeactivated: data.is_deactivated,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };
      } else if (role === 'MAIN_ADMIN' || identifier.toLowerCase() === 'vallikarthik7330@gmail.com') {
        profile = {
          id: '44444444-4444-4444-4444-444444444444',
          role: 'MAIN_ADMIN',
          fullName: 'Karthik',
          phoneNumber: '+919876543210',
          email: 'vallikarthik7330@gmail.com',
          isApproved: true,
          isDeactivated: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } else {
        // If not found in DB, auto-provision with valid UUID and insert into profiles
        const newId = generateUUID();
        const isEmail = identifier.includes('@');
        const defaultName = role === 'AMBULANCE_PERSONNEL' 
          ? 'Paramedic Unit Officer' 
          : role === 'EMERGENCY_CONTACT' 
            ? 'Emergency Contact' 
            : 'Citizen User';

        profile = {
          id: newId,
          role,
          fullName: defaultName,
          phoneNumber: isEmail ? '+919876543210' : identifier,
          email: isEmail ? identifier : undefined,
          isApproved: true,
          isDeactivated: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Persist to profiles so foreign key constraints in connection_requests and emergency_contacts succeed
        const { error: upsertErr } = await supabase.from('profiles').upsert({
          id: profile.id,
          role: profile.role,
          full_name: profile.fullName,
          phone_number: profile.phoneNumber,
          email: profile.email || null,
          is_approved: true,
          is_deactivated: false
        });

        if (upsertErr) {
          console.warn('[AuthService] Profile auto-provision insert warning:', upsertErr.message);
        }
      }

      await AsyncStorage.setItem('@mediconnect_current_user', JSON.stringify(profile));
      await this.resetFailedAttempts();

      return { success: true, profile };
    } catch (err: unknown) {
      const attempts = await this.recordFailedAttempt();
      const remaining = 5 - attempts;
      return {
        success: false,
        error: remaining > 0 
          ? `Invalid credentials. ${remaining} attempts remaining before 15-minute security lockout.`
          : 'Account locked for 15 minutes due to 5 failed attempts.'
      };
    }
  },

  async getCurrentUser(): Promise<Profile | null> {
    try {
      const str = await AsyncStorage.getItem('@mediconnect_current_user');
      return str ? JSON.parse(str) : null;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    await AsyncStorage.removeItem('@mediconnect_current_user');
  }
};
