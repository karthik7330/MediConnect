-- =====================================================================
-- PERMISSIONS & ROW LEVEL SECURITY (RLS) FOR MEDICONNECT
-- Run this in your Supabase SQL Editor to grant table access to your API
-- =====================================================================

-- 1. Grant schema usage and table access to API roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- 2. Open RLS Policies for real-time mobile interaction
DO $$ BEGIN
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow public read and write on profiles" ON profiles;
  CREATE POLICY "Allow public read and write on profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);

  ALTER TABLE emergency_requests ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow public read and write on emergency_requests" ON emergency_requests;
  CREATE POLICY "Allow public read and write on emergency_requests" ON emergency_requests FOR ALL USING (true) WITH CHECK (true);

  ALTER TABLE ambulance_crews ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow public read and write on ambulance_crews" ON ambulance_crews;
  CREATE POLICY "Allow public read and write on ambulance_crews" ON ambulance_crews FOR ALL USING (true) WITH CHECK (true);

  ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow public read and write on emergency_contacts" ON emergency_contacts;
  CREATE POLICY "Allow public read and write on emergency_contacts" ON emergency_contacts FOR ALL USING (true) WITH CHECK (true);

  ALTER TABLE connection_requests ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow public read and write on connection_requests" ON connection_requests;
  CREATE POLICY "Allow public read and write on connection_requests" ON connection_requests FOR ALL USING (true) WITH CHECK (true);

  ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow public read on hospitals" ON hospitals;
  CREATE POLICY "Allow public read on hospitals" ON hospitals FOR SELECT USING (true);

  ALTER TABLE live_ambulance_tracking ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow public read and write on live_ambulance_tracking" ON live_ambulance_tracking;
  CREATE POLICY "Allow public read and write on live_ambulance_tracking" ON live_ambulance_tracking FOR ALL USING (true) WITH CHECK (true);

  ALTER TABLE emergency_status_history ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow public read and write on emergency_status_history" ON emergency_status_history;
  CREATE POLICY "Allow public read and write on emergency_status_history" ON emergency_status_history FOR ALL USING (true) WITH CHECK (true);

  ALTER TABLE ambulance_ratings ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow public read and write on ambulance_ratings" ON ambulance_ratings;
  CREATE POLICY "Allow public read and write on ambulance_ratings" ON ambulance_ratings FOR ALL USING (true) WITH CHECK (true);

  ALTER TABLE service_feedback ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow public read and write on service_feedback" ON service_feedback;
  CREATE POLICY "Allow public read and write on service_feedback" ON service_feedback FOR ALL USING (true) WITH CHECK (true);
END $$;
