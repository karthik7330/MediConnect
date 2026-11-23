import { supabase, supabaseAdmin } from '../lib/supabase';
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

  // Register user profile in database (Checks for duplicates)
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
      const cleanPhone = params.phone.trim();
      const cleanEmail = params.email?.trim().toLowerCase();

      // Check if user already exists with this phone or email
      let duplicateQuery = supabaseAdmin.from('profiles').select('id, role, phone_number, email');
      if (cleanEmail) {
        duplicateQuery = duplicateQuery.or(`phone_number.eq.${cleanPhone},email.eq.${cleanEmail}`);
      } else {
        duplicateQuery = duplicateQuery.eq('phone_number', cleanPhone);
      }

      const { data: existingUser } = await duplicateQuery.maybeSingle();
      if (existingUser) {
        const roleLabel = this.getRoleDisplayName(existingUser.role as UserRole);
        return {
          success: false,
          error: `An account is already registered with this phone number or email as a ${roleLabel}. Please log in instead.`
        };
      }

      const validId = generateUUID();
      const profile: Profile = {
        id: validId,
        role: params.role,
        fullName: params.fullName.trim(),
        phoneNumber: cleanPhone,
        email: cleanEmail || undefined,
        bloodGroup: params.bloodGroup?.trim() || undefined,
        medicalNotes: params.medicalNotes?.trim() || undefined,
        isApproved: params.role !== 'AMBULANCE_PERSONNEL', // Ambulance requires Main Admin approval
        isDeactivated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to Supabase profiles table using admin client to ensure persistence
      const { error } = await supabaseAdmin.from('profiles').insert({
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
        console.error('[AuthService] Profile registration error:', error.message);
        throw error;
      }

      // If registering as Ambulance Personnel, insert vehicle details into ambulance_crews
      if (params.role === 'AMBULANCE_PERSONNEL' && params.licenseNumber && params.vehicleNumber) {
        await supabaseAdmin.from('ambulance_crews').upsert({
          id: profile.id,
          vehicle_number: params.vehicleNumber.trim().toUpperCase(),
          license_number: params.licenseNumber.trim().toUpperCase(),
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

  // Strict Login: ONLY allows registered credentials & enforces the exact role
  async login(identifier: string, role: UserRole): Promise<{ success: boolean; profile?: Profile; error?: string }> {
    const lockout = await this.checkLockout();
    if (lockout.isLocked) {
      return {
        success: false,
        error: `Account locked due to 5 consecutive failed attempts. Please wait ${lockout.remainingMinutes} minutes.`
      };
    }

    const cleanId = identifier.trim();
    if (!cleanId) {
      return { success: false, error: 'Please enter your registered phone number or email.' };
    }

    const isEmail = cleanId.includes('@');
    const lowerId = cleanId.toLowerCase();

    try {
      // 1. Check for Root Main Administrator
      if (role === 'MAIN_ADMIN' && lowerId === 'vallikarthik7330@gmail.com') {
        const rootAdmin: Profile = {
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
        await AsyncStorage.setItem('@mediconnect_current_user', JSON.stringify(rootAdmin));
        await this.resetFailedAttempts();
        return { success: true, profile: rootAdmin };
      }

      // 2. Query Supabase profiles table strictly for this identifier
      let query = supabaseAdmin.from('profiles').select('*');
      if (isEmail) {
        query = query.ilike('email', lowerId);
      } else {
        // Build phone number matching variants (e.g. 9876543210, +919876543210)
        const digitsOnly = cleanId.replace(/\D/g, '');
        const phoneVariants = [cleanId];
        if (digitsOnly.length === 10) {
          phoneVariants.push(digitsOnly, `+91${digitsOnly}`);
        } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
          phoneVariants.push(digitsOnly.slice(2), `+${digitsOnly}`);
        }
        const orConditions = phoneVariants.map(p => `phone_number.eq.${p}`).join(',');
        query = query.or(orConditions);
      }

      const { data: matchedUsers, error: queryErr } = await query;

      if (queryErr) {
        console.warn('[AuthService] Profile query warning:', queryErr.message);
      }

      // 3. User NOT FOUND -> REJECT (Zero auto-provisioning)
      if (!matchedUsers || matchedUsers.length === 0) {
        const attempts = await this.recordFailedAttempt();
        const remaining = 5 - attempts;
        return {
          success: false,
          error: remaining > 0
            ? `No registered account found with "${cleanId}". Please register first or verify your credentials. (${remaining} attempts remaining)`
            : 'Account locked for 15 minutes due to 5 consecutive failed attempts.'
        };
      }

      // 4. Role check: Find the profile matching the selected role
      const matchedUser = matchedUsers.find(p => p.role === role);

      if (!matchedUser) {
        await this.recordFailedAttempt();
        const registeredRole = this.getRoleDisplayName(matchedUsers[0].role as UserRole);
        const selectedRole = this.getRoleDisplayName(role);

        return {
          success: false,
          error: `Role Mismatch: This account is registered as a "${registeredRole}". You cannot log in under the "${selectedRole}" tab. Please switch to the "${registeredRole}" tab to authenticate.`
        };
      }

      // 5. Account Deactivated check
      if (matchedUser.is_deactivated) {
        await this.recordFailedAttempt();
        return {
          success: false,
          error: 'This account has been deactivated. Please contact emergency administration support.'
        };
      }

      // 6. Ambulance Personnel approval check
      if (role === 'AMBULANCE_PERSONNEL' && matchedUser.is_approved === false) {
        await this.recordFailedAttempt();
        return {
          success: false,
          error: 'Paramedic Verification Pending: Your ambulance crew credentials are awaiting approval by the Main Administrator.'
        };
      }

      // 7. Successful authentication
      const profile: Profile = {
        id: matchedUser.id,
        role: matchedUser.role,
        fullName: matchedUser.full_name,
        phoneNumber: matchedUser.phone_number,
        email: matchedUser.email,
        bloodGroup: matchedUser.blood_group,
        medicalNotes: matchedUser.medical_notes,
        isApproved: matchedUser.is_approved,
        isDeactivated: matchedUser.is_deactivated,
        createdAt: matchedUser.created_at,
        updatedAt: matchedUser.updated_at
      };

      await AsyncStorage.setItem('@mediconnect_current_user', JSON.stringify(profile));
      await this.resetFailedAttempts();

      return { success: true, profile };
    } catch (err: unknown) {
      const attempts = await this.recordFailedAttempt();
      const remaining = 5 - attempts;
      return {
        success: false,
        error: remaining > 0 
          ? `Authentication failed. ${remaining} attempts remaining before 15-minute security lockout.`
          : 'Account locked for 15 minutes due to 5 failed attempts.'
      };
    }
  },

  // Helper: Friendly display names for user roles
  getRoleDisplayName(role: UserRole): string {
    switch (role) {
      case 'NORMAL_USER':
        return 'Citizen User';
      case 'EMERGENCY_CONTACT':
        return 'Emergency Contact';
      case 'AMBULANCE_PERSONNEL':
        return 'Ambulance Personnel';
      case 'MAIN_ADMIN':
        return 'Main Administrator';
      case 'SUB_ADMIN':
        return 'Sub-Administrator';
      default:
        return String(role);
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
