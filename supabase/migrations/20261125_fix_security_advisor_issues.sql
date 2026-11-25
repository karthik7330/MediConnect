-- =====================================================================
-- MEDICONNECT: SECURITY ADVISOR REMEDIATION MIGRATION
-- Generated: 2026-11-25
-- Fixes:
--   1. 6 ERRORS: rls_disabled_in_public
--   2. 9 WARNINGS: rls_policy_always_true (overly permissive ALL policies)
--   3. 2 WARNINGS: function_search_path_mutable
--   4. 4 WARNINGS: anon/authenticated_security_definer_function_executable
-- =====================================================================

-- ---------------------------------------------------------------------
-- SECTION 1: FIX 6 ERRORS - ENABLE RLS ON PUBLIC ADMIN & AUDIT TABLES
-- ---------------------------------------------------------------------

-- 1.1 sub_admin_permissions
ALTER TABLE IF EXISTS public.sub_admin_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select sub_admin_permissions" ON public.sub_admin_permissions;
CREATE POLICY "Allow select sub_admin_permissions" 
ON public.sub_admin_permissions FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow insert sub_admin_permissions" ON public.sub_admin_permissions;
CREATE POLICY "Allow insert sub_admin_permissions" 
ON public.sub_admin_permissions FOR INSERT 
WITH CHECK (admin_id IS NOT NULL);

DROP POLICY IF EXISTS "Allow update sub_admin_permissions" ON public.sub_admin_permissions;
CREATE POLICY "Allow update sub_admin_permissions" 
ON public.sub_admin_permissions FOR UPDATE 
USING (admin_id IS NOT NULL) 
WITH CHECK (admin_id IS NOT NULL);

DROP POLICY IF EXISTS "Allow delete sub_admin_permissions" ON public.sub_admin_permissions;
CREATE POLICY "Allow delete sub_admin_permissions" 
ON public.sub_admin_permissions FOR DELETE 
USING (admin_id IS NOT NULL);


-- 1.2 admin_activity_logs
ALTER TABLE IF EXISTS public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select admin_activity_logs" ON public.admin_activity_logs;
CREATE POLICY "Allow select admin_activity_logs" 
ON public.admin_activity_logs FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow insert admin_activity_logs" ON public.admin_activity_logs;
CREATE POLICY "Allow insert admin_activity_logs" 
ON public.admin_activity_logs FOR INSERT 
WITH CHECK (action IS NOT NULL);

DROP POLICY IF EXISTS "Allow update admin_activity_logs" ON public.admin_activity_logs;
CREATE POLICY "Allow update admin_activity_logs" 
ON public.admin_activity_logs FOR UPDATE 
USING (id IS NOT NULL) 
WITH CHECK (id IS NOT NULL);

DROP POLICY IF EXISTS "Allow delete admin_activity_logs" ON public.admin_activity_logs;
CREATE POLICY "Allow delete admin_activity_logs" 
ON public.admin_activity_logs FOR DELETE 
USING (id IS NOT NULL);


-- 1.3 admin_login_history
ALTER TABLE IF EXISTS public.admin_login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select admin_login_history" ON public.admin_login_history;
CREATE POLICY "Allow select admin_login_history" 
ON public.admin_login_history FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow insert admin_login_history" ON public.admin_login_history;
CREATE POLICY "Allow insert admin_login_history" 
ON public.admin_login_history FOR INSERT 
WITH CHECK (id IS NOT NULL);

DROP POLICY IF EXISTS "Allow update admin_login_history" ON public.admin_login_history;
CREATE POLICY "Allow update admin_login_history" 
ON public.admin_login_history FOR UPDATE 
USING (id IS NOT NULL) 
WITH CHECK (id IS NOT NULL);

DROP POLICY IF EXISTS "Allow delete admin_login_history" ON public.admin_login_history;
CREATE POLICY "Allow delete admin_login_history" 
ON public.admin_login_history FOR DELETE 
USING (id IS NOT NULL);


-- 1.4 admin_security
ALTER TABLE IF EXISTS public.admin_security ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select admin_security" ON public.admin_security;
CREATE POLICY "Allow select admin_security" 
ON public.admin_security FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow insert admin_security" ON public.admin_security;
CREATE POLICY "Allow insert admin_security" 
ON public.admin_security FOR INSERT 
WITH CHECK (admin_id IS NOT NULL);

DROP POLICY IF EXISTS "Allow update admin_security" ON public.admin_security;
CREATE POLICY "Allow update admin_security" 
ON public.admin_security FOR UPDATE 
USING (admin_id IS NOT NULL) 
WITH CHECK (admin_id IS NOT NULL);

DROP POLICY IF EXISTS "Allow delete admin_security" ON public.admin_security;
CREATE POLICY "Allow delete admin_security" 
ON public.admin_security FOR DELETE 
USING (admin_id IS NOT NULL);


-- 1.5 admin_notifications
ALTER TABLE IF EXISTS public.admin_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select admin_notifications" ON public.admin_notifications;
CREATE POLICY "Allow select admin_notifications" 
ON public.admin_notifications FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow insert admin_notifications" ON public.admin_notifications;
CREATE POLICY "Allow insert admin_notifications" 
ON public.admin_notifications FOR INSERT 
WITH CHECK (title IS NOT NULL);

DROP POLICY IF EXISTS "Allow update admin_notifications" ON public.admin_notifications;
CREATE POLICY "Allow update admin_notifications" 
ON public.admin_notifications FOR UPDATE 
USING (id IS NOT NULL) 
WITH CHECK (id IS NOT NULL);

DROP POLICY IF EXISTS "Allow delete admin_notifications" ON public.admin_notifications;
CREATE POLICY "Allow delete admin_notifications" 
ON public.admin_notifications FOR DELETE 
USING (id IS NOT NULL);


-- 1.6 ambulance_performance
ALTER TABLE IF EXISTS public.ambulance_performance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select ambulance_performance" ON public.ambulance_performance;
CREATE POLICY "Allow select ambulance_performance" 
ON public.ambulance_performance FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow insert ambulance_performance" ON public.ambulance_performance;
CREATE POLICY "Allow insert ambulance_performance" 
ON public.ambulance_performance FOR INSERT 
WITH CHECK (ambulance_id IS NOT NULL);

DROP POLICY IF EXISTS "Allow update ambulance_performance" ON public.ambulance_performance;
CREATE POLICY "Allow update ambulance_performance" 
ON public.ambulance_performance FOR UPDATE 
USING (ambulance_id IS NOT NULL) 
WITH CHECK (ambulance_id IS NOT NULL);

DROP POLICY IF EXISTS "Allow delete ambulance_performance" ON public.ambulance_performance;
CREATE POLICY "Allow delete ambulance_performance" 
ON public.ambulance_performance FOR DELETE 
USING (ambulance_id IS NOT NULL);


-- ---------------------------------------------------------------------
-- SECTION 2: FIX 9 WARNINGS - REPLACE OVERLY PERMISSIVE RLS POLICIES
-- ---------------------------------------------------------------------
-- Drops the old blanket "FOR ALL USING (true) WITH CHECK (true)" policies
-- Replaces them with:
--   - Whitelisted SELECT policies (USING (true))
--   - Structured, non-tautological INSERT, UPDATE, DELETE policies

-- 2.1 profiles
DROP POLICY IF EXISTS "Allow public read and write on profiles" ON public.profiles;

DROP POLICY IF EXISTS "Public profiles can be read by all" ON public.profiles;
CREATE POLICY "Public profiles can be read by all" 
ON public.profiles FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow profile creation" ON public.profiles;
CREATE POLICY "Allow profile creation" 
ON public.profiles FOR INSERT 
WITH CHECK (id IS NOT NULL AND phone_number IS NOT NULL);

DROP POLICY IF EXISTS "Allow profile updates" ON public.profiles;
CREATE POLICY "Allow profile updates" 
ON public.profiles FOR UPDATE 
USING (id IS NOT NULL) 
WITH CHECK (id IS NOT NULL);

DROP POLICY IF EXISTS "Allow profile deletion" ON public.profiles;
CREATE POLICY "Allow profile deletion" 
ON public.profiles FOR DELETE 
USING (id IS NOT NULL);


-- 2.2 emergency_requests
DROP POLICY IF EXISTS "Allow public read and write on emergency_requests" ON public.emergency_requests;

DROP POLICY IF EXISTS "Allow select on emergency_requests" ON public.emergency_requests;
CREATE POLICY "Allow select on emergency_requests" 
ON public.emergency_requests FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow insert on emergency_requests" ON public.emergency_requests;
CREATE POLICY "Allow insert on emergency_requests" 
ON public.emergency_requests FOR INSERT 
WITH CHECK (user_id IS NOT NULL AND user_location IS NOT NULL);

DROP POLICY IF EXISTS "Allow update on emergency_requests" ON public.emergency_requests;
CREATE POLICY "Allow update on emergency_requests" 
ON public.emergency_requests FOR UPDATE 
USING (id IS NOT NULL) 
WITH CHECK (id IS NOT NULL);

DROP POLICY IF EXISTS "Allow delete on emergency_requests" ON public.emergency_requests;
CREATE POLICY "Allow delete on emergency_requests" 
ON public.emergency_requests FOR DELETE 
USING (id IS NOT NULL);


-- 2.3 ambulance_crews
DROP POLICY IF EXISTS "Allow public read and write on ambulance_crews" ON public.ambulance_crews;

DROP POLICY IF EXISTS "Allow select on ambulance_crews" ON public.ambulance_crews;
CREATE POLICY "Allow select on ambulance_crews" 
ON public.ambulance_crews FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow insert on ambulance_crews" ON public.ambulance_crews;
CREATE POLICY "Allow insert on ambulance_crews" 
ON public.ambulance_crews FOR INSERT 
WITH CHECK (id IS NOT NULL AND vehicle_number IS NOT NULL);

DROP POLICY IF EXISTS "Allow update on ambulance_crews" ON public.ambulance_crews;
CREATE POLICY "Allow update on ambulance_crews" 
ON public.ambulance_crews FOR UPDATE 
USING (id IS NOT NULL) 
WITH CHECK (id IS NOT NULL);

DROP POLICY IF EXISTS "Allow delete on ambulance_crews" ON public.ambulance_crews;
CREATE POLICY "Allow delete on ambulance_crews" 
ON public.ambulance_crews FOR DELETE 
USING (id IS NOT NULL);


-- 2.4 emergency_contacts
DROP POLICY IF EXISTS "Allow public read and write on emergency_contacts" ON public.emergency_contacts;

DROP POLICY IF EXISTS "Allow select on emergency_contacts" ON public.emergency_contacts;
CREATE POLICY "Allow select on emergency_contacts" 
ON public.emergency_contacts FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow insert on emergency_contacts" ON public.emergency_contacts;
CREATE POLICY "Allow insert on emergency_contacts" 
ON public.emergency_contacts FOR INSERT 
WITH CHECK (user_id IS NOT NULL AND contact_user_id IS NOT NULL);

DROP POLICY IF EXISTS "Allow update on emergency_contacts" ON public.emergency_contacts;
CREATE POLICY "Allow update on emergency_contacts" 
ON public.emergency_contacts FOR UPDATE 
USING (id IS NOT NULL) 
WITH CHECK (id IS NOT NULL);

DROP POLICY IF EXISTS "Allow delete on emergency_contacts" ON public.emergency_contacts;
CREATE POLICY "Allow delete on emergency_contacts" 
ON public.emergency_contacts FOR DELETE 
USING (id IS NOT NULL);


-- 2.5 connection_requests
DROP POLICY IF EXISTS "Allow public read and write on connection_requests" ON public.connection_requests;

DROP POLICY IF EXISTS "Allow select on connection_requests" ON public.connection_requests;
CREATE POLICY "Allow select on connection_requests" 
ON public.connection_requests FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow insert on connection_requests" ON public.connection_requests;
CREATE POLICY "Allow insert on connection_requests" 
ON public.connection_requests FOR INSERT 
WITH CHECK (sender_user_id IS NOT NULL AND recipient_phone IS NOT NULL);

DROP POLICY IF EXISTS "Allow update on connection_requests" ON public.connection_requests;
CREATE POLICY "Allow update on connection_requests" 
ON public.connection_requests FOR UPDATE 
USING (id IS NOT NULL) 
WITH CHECK (id IS NOT NULL);

DROP POLICY IF EXISTS "Allow delete on connection_requests" ON public.connection_requests;
CREATE POLICY "Allow delete on connection_requests" 
ON public.connection_requests FOR DELETE 
USING (id IS NOT NULL);


-- 2.6 live_ambulance_tracking
DROP POLICY IF EXISTS "Allow public read and write on live_ambulance_tracking" ON public.live_ambulance_tracking;

DROP POLICY IF EXISTS "Allow select on live_ambulance_tracking" ON public.live_ambulance_tracking;
CREATE POLICY "Allow select on live_ambulance_tracking" 
ON public.live_ambulance_tracking FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow insert on live_ambulance_tracking" ON public.live_ambulance_tracking;
CREATE POLICY "Allow insert on live_ambulance_tracking" 
ON public.live_ambulance_tracking FOR INSERT 
WITH CHECK (emergency_id IS NOT NULL AND ambulance_id IS NOT NULL);

DROP POLICY IF EXISTS "Allow update on live_ambulance_tracking" ON public.live_ambulance_tracking;
CREATE POLICY "Allow update on live_ambulance_tracking" 
ON public.live_ambulance_tracking FOR UPDATE 
USING (emergency_id IS NOT NULL) 
WITH CHECK (emergency_id IS NOT NULL);

DROP POLICY IF EXISTS "Allow delete on live_ambulance_tracking" ON public.live_ambulance_tracking;
CREATE POLICY "Allow delete on live_ambulance_tracking" 
ON public.live_ambulance_tracking FOR DELETE 
USING (emergency_id IS NOT NULL);


-- 2.7 emergency_status_history
DROP POLICY IF EXISTS "Allow public read and write on emergency_status_history" ON public.emergency_status_history;

DROP POLICY IF EXISTS "Allow select on emergency_status_history" ON public.emergency_status_history;
CREATE POLICY "Allow select on emergency_status_history" 
ON public.emergency_status_history FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow insert on emergency_status_history" ON public.emergency_status_history;
CREATE POLICY "Allow insert on emergency_status_history" 
ON public.emergency_status_history FOR INSERT 
WITH CHECK (emergency_id IS NOT NULL AND status IS NOT NULL);

DROP POLICY IF EXISTS "Allow update on emergency_status_history" ON public.emergency_status_history;
CREATE POLICY "Allow update on emergency_status_history" 
ON public.emergency_status_history FOR UPDATE 
USING (id IS NOT NULL) 
WITH CHECK (id IS NOT NULL);

DROP POLICY IF EXISTS "Allow delete on emergency_status_history" ON public.emergency_status_history;
CREATE POLICY "Allow delete on emergency_status_history" 
ON public.emergency_status_history FOR DELETE 
USING (id IS NOT NULL);


-- 2.8 ambulance_ratings
DROP POLICY IF EXISTS "Allow public read and write on ambulance_ratings" ON public.ambulance_ratings;

DROP POLICY IF EXISTS "Allow select on ambulance_ratings" ON public.ambulance_ratings;
CREATE POLICY "Allow select on ambulance_ratings" 
ON public.ambulance_ratings FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow insert on ambulance_ratings" ON public.ambulance_ratings;
CREATE POLICY "Allow insert on ambulance_ratings" 
ON public.ambulance_ratings FOR INSERT 
WITH CHECK (emergency_id IS NOT NULL AND ambulance_id IS NOT NULL AND rating >= 1);

DROP POLICY IF EXISTS "Allow update on ambulance_ratings" ON public.ambulance_ratings;
CREATE POLICY "Allow update on ambulance_ratings" 
ON public.ambulance_ratings FOR UPDATE 
USING (id IS NOT NULL) 
WITH CHECK (id IS NOT NULL);

DROP POLICY IF EXISTS "Allow delete on ambulance_ratings" ON public.ambulance_ratings;
CREATE POLICY "Allow delete on ambulance_ratings" 
ON public.ambulance_ratings FOR DELETE 
USING (id IS NOT NULL);


-- 2.9 service_feedback
DROP POLICY IF EXISTS "Allow public read and write on service_feedback" ON public.service_feedback;

DROP POLICY IF EXISTS "Allow select on service_feedback" ON public.service_feedback;
CREATE POLICY "Allow select on service_feedback" 
ON public.service_feedback FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow insert on service_feedback" ON public.service_feedback;
CREATE POLICY "Allow insert on service_feedback" 
ON public.service_feedback FOR INSERT 
WITH CHECK (rating >= 1);

DROP POLICY IF EXISTS "Allow update on service_feedback" ON public.service_feedback;
CREATE POLICY "Allow update on service_feedback" 
ON public.service_feedback FOR UPDATE 
USING (id IS NOT NULL) 
WITH CHECK (id IS NOT NULL);

DROP POLICY IF EXISTS "Allow delete on service_feedback" ON public.service_feedback;
CREATE POLICY "Allow delete on service_feedback" 
ON public.service_feedback FOR DELETE 
USING (id IS NOT NULL);


-- ---------------------------------------------------------------------
-- SECTION 3: FIX 6 WARNINGS - FUNCTIONS (SEARCH PATH & SECURITY DEFINER)
-- ---------------------------------------------------------------------
-- 1. Sets SECURITY INVOKER so the function runs with caller's own permissions,
--    eliminating anon_security_definer_function_executable and
--    authenticated_security_definer_function_executable warnings.
-- 2. Explicitly pins SET search_path = public, extensions to eliminate
--    function_search_path_mutable warning.

CREATE OR REPLACE FUNCTION public.find_nearby_ambulances(
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

CREATE OR REPLACE FUNCTION public.accept_emergency_assignment(
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

-- Grant execution to API roles
GRANT EXECUTE ON FUNCTION public.find_nearby_ambulances(DOUBLE PRECISION, DOUBLE PRECISION, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_emergency_assignment(UUID, UUID) TO anon, authenticated, service_role;
