-- =====================================================================
-- MEDICONNECT: COMPLETE PRODUCTION DATABASE SCHEMA
-- Extensions, Roles, Tables, Spatial Indexes, Functions & RLS
-- =====================================================================

-- 1. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TYPES
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'NORMAL_USER', 
    'EMERGENCY_CONTACT', 
    'AMBULANCE_PERSONNEL', 
    'MAIN_ADMIN', 
    'SUB_ADMIN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE crew_availability AS ENUM ('ONLINE', 'OFFLINE', 'BUSY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE emergency_status AS ENUM (
    'SOS_ACTIVATED',
    'REQUEST_ACCEPTED',
    'AMBULANCE_DISPATCHED',
    'AMBULANCE_ON_THE_WAY',
    'AMBULANCE_ARRIVED',
    'PATIENT_PICKED_UP',
    'PATIENT_REACHED_HOSPITAL',
    'EMERGENCY_RESOLVED',
    'EMERGENCY_CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES TABLE (Linked with Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'NORMAL_USER',
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT,
  blood_group TEXT,
  medical_notes TEXT,
  is_approved BOOLEAN DEFAULT TRUE, -- Ambulance personnel requires Main Admin approval
  is_deactivated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SUB-ADMIN PERMISSIONS (Granular Role-Based Access Control)
CREATE TABLE IF NOT EXISTS sub_admin_permissions (
  admin_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  can_approve_ambulance BOOLEAN DEFAULT FALSE,
  can_manage_users BOOLEAN DEFAULT FALSE,
  can_manual_assign BOOLEAN DEFAULT FALSE,
  can_view_analytics BOOLEAN DEFAULT FALSE,
  can_view_logs BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. AMBULANCE CREW & VEHICLES TABLE
CREATE TABLE IF NOT EXISTS ambulance_crews (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_number TEXT NOT NULL,
  vehicle_model TEXT,
  license_number TEXT NOT NULL,
  availability crew_availability DEFAULT 'OFFLINE',
  location GEOGRAPHY(Point, 4326),
  last_location_update TIMESTAMPTZ,
  reliability_score NUMERIC(5,2) DEFAULT 100.0,
  is_approved BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_ambulance_crews_location 
ON ambulance_crews USING GIST (location);

-- 6. EMERGENCY CONTACTS & CONNECTION REQUESTS
CREATE TABLE IF NOT EXISTS connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_user_id UUID REFERENCES profiles(id),
  status TEXT CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  can_receive_alerts BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, contact_user_id)
);

-- 7. HOSPITALS DIRECTORY
CREATE TABLE IF NOT EXISTS hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  emergency_phone TEXT,
  icu_beds_available INT DEFAULT 5,
  is_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospitals_location 
ON hospitals USING GIST (location);

-- 8. EMERGENCY REQUESTS (The Core Incident Record)
CREATE TABLE IF NOT EXISTS emergency_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_location GEOGRAPHY(Point, 4326) NOT NULL,
  address_text TEXT,
  current_status emergency_status NOT NULL DEFAULT 'SOS_ACTIVATED',
  search_radius_meters INT DEFAULT 5000,
  assigned_ambulance_id UUID REFERENCES ambulance_crews(id),
  selected_hospital_id UUID REFERENCES hospitals(id),
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_emergency_requests_location 
ON emergency_requests USING GIST (user_location);

CREATE INDEX IF NOT EXISTS idx_emergency_requests_status 
ON emergency_requests(current_status);

-- 9. EMERGENCY STATUS HISTORY (Strict Audit Progression)
CREATE TABLE IF NOT EXISTS emergency_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_id UUID NOT NULL REFERENCES emergency_requests(id) ON DELETE CASCADE,
  status emergency_status NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. REAL-TIME AMBULANCE LIVE TRACKING (Zero-Trust Privacy)
CREATE TABLE IF NOT EXISTS live_ambulance_tracking (
  emergency_id UUID PRIMARY KEY REFERENCES emergency_requests(id) ON DELETE CASCADE,
  ambulance_id UUID NOT NULL REFERENCES ambulance_crews(id) ON DELETE CASCADE,
  current_location GEOGRAPHY(Point, 4326) NOT NULL,
  heading NUMERIC,
  speed_kmh NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- 11. AMBULANCE RATINGS (Anonymous to Crew, Viewable by Admin)
CREATE TABLE IF NOT EXISTS ambulance_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_id UUID NOT NULL REFERENCES emergency_requests(id) ON DELETE CASCADE,
  ambulance_id UUID NOT NULL REFERENCES ambulance_crews(id) ON DELETE CASCADE,
  rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  feedback_text TEXT,
  submitted_by UUID REFERENCES profiles(id), -- Protected: Admin only
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. OVERALL SERVICE FEEDBACK (Anonymous)
CREATE TABLE IF NOT EXISTS service_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  feedback_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. ADMIN AUDIT & ACTIVITY LOGS (Immutable)
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  target_entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES profiles(id),
  device_info TEXT,
  ip_address TEXT,
  login_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_security (
  admin_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ
);

-- 14. ADMIN NOTIFICATIONS
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. AMBULANCE PERFORMANCE RECORDS
CREATE TABLE IF NOT EXISTS ambulance_performance (
  ambulance_id UUID PRIMARY KEY REFERENCES ambulance_crews(id) ON DELETE CASCADE,
  total_requests_received INT DEFAULT 0,
  total_accepted INT DEFAULT 0,
  total_rejected INT DEFAULT 0,
  total_completed INT DEFAULT 0,
  total_cancelled INT DEFAULT 0,
  avg_response_time_seconds NUMERIC(8,2) DEFAULT 0,
  avg_arrival_time_seconds NUMERIC(8,2) DEFAULT 0,
  reassignment_count INT DEFAULT 0,
  reliability_score NUMERIC(5,2) DEFAULT 100.0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 16. ATOMIC POSTGIS FUNCTIONS FOR DISPATCH & ASSIGNMENT
-- =====================================================================

-- Query available nearby ambulances within search radius
CREATE OR REPLACE FUNCTION find_nearby_ambulances(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_radius_meters INT DEFAULT 5000
) 
RETURNS TABLE (
  ambulance_id UUID,
  vehicle_number TEXT,
  distance_meters DOUBLE PRECISION,
  reliability_score NUMERIC
) 
LANGUAGE plpgsql 
SECURITY INVOKER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ac.id AS ambulance_id,
    ac.vehicle_number,
    ST_Distance(ac.location, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography) AS distance_meters,
    ac.reliability_score
  FROM ambulance_crews ac
  WHERE ac.availability = 'ONLINE'
    AND ac.is_approved = TRUE
    AND ac.location IS NOT NULL
    AND ST_DWithin(
      ac.location, 
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography, 
      p_radius_meters
    )
  ORDER BY distance_meters ASC;
END;
$$;

-- Atomic Assignment Lock (Prevents Race Conditions)
CREATE OR REPLACE FUNCTION accept_emergency_assignment(
  p_emergency_id UUID,
  p_ambulance_id UUID
) 
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_current_status emergency_status;
  v_assigned UUID;
BEGIN
  -- Acquire row-level lock
  SELECT current_status, assigned_ambulance_id 
  INTO v_current_status, v_assigned
  FROM emergency_requests 
  WHERE id = p_emergency_id 
  FOR UPDATE;

  IF v_current_status = 'SOS_ACTIVATED' AND v_assigned IS NULL THEN
    -- Assign to this ambulance
    UPDATE emergency_requests
    SET assigned_ambulance_id = p_ambulance_id,
        current_status = 'REQUEST_ACCEPTED'
    WHERE id = p_emergency_id;

    -- Update crew status to BUSY
    UPDATE ambulance_crews
    SET availability = 'BUSY'
    WHERE id = p_ambulance_id;

    -- Update status history
    INSERT INTO emergency_status_history (emergency_id, status, updated_by, notes)
    VALUES (p_emergency_id, 'REQUEST_ACCEPTED', p_ambulance_id, 'Dispatch accepted by crew');

    RETURN jsonb_build_object('success', true, 'message', 'Emergency assigned successfully');
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Emergency has already been accepted or cancelled');
  END IF;
END;
$$;

-- Enable Realtime for live tracking & emergencies
ALTER PUBLICATION supabase_realtime ADD TABLE emergency_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE live_ambulance_tracking;
ALTER PUBLICATION supabase_realtime ADD TABLE emergency_status_history;
ALTER PUBLICATION supabase_realtime ADD TABLE admin_notifications;
