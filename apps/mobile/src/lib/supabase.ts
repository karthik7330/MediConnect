import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://hrhpenogpldpfzbpvdpy.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_PSpURRdirjj1ydSf5jgqgA_ULNmKKn2';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// Admin Supabase client (bypasses RLS for hospital bed updates and authoritative sync)
const serviceRoleKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_CNuRvsuCKQ_eiadXgJUUVA_ofjbMFNh';
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

