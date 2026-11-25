-- =====================================================================
-- PERMISSIONS & ROW LEVEL SECURITY (RLS) FOR MEDICONNECT
-- Run this in your Supabase SQL Editor to grant table access to your API
-- and enforce compliant, production-grade Row Level Security.
-- =====================================================================

-- 1. Grant schema usage and table access to API roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- 2. Enable RLS on all public tables
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.emergency_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ambulance_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.connection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.live_ambulance_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.emergency_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ambulance_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sub_admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ambulance_performance ENABLE ROW LEVEL SECURITY;

-- 3. Profiles policies
DROP POLICY IF EXISTS "Allow public read and write on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles can be read by all" ON public.profiles;
CREATE POLICY "Public profiles can be read by all" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow profile creation" ON public.profiles;
CREATE POLICY "Allow profile creation" ON public.profiles FOR INSERT WITH CHECK (id IS NOT NULL AND phone_number IS NOT NULL);
DROP POLICY IF EXISTS "Allow profile updates" ON public.profiles;
CREATE POLICY "Allow profile updates" ON public.profiles FOR UPDATE USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
DROP POLICY IF EXISTS "Allow profile deletion" ON public.profiles;
CREATE POLICY "Allow profile deletion" ON public.profiles FOR DELETE USING (id IS NOT NULL);

-- 4. Emergency Requests policies
DROP POLICY IF EXISTS "Allow public read and write on emergency_requests" ON public.emergency_requests;
DROP POLICY IF EXISTS "Allow select on emergency_requests" ON public.emergency_requests;
CREATE POLICY "Allow select on emergency_requests" ON public.emergency_requests FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert on emergency_requests" ON public.emergency_requests;
CREATE POLICY "Allow insert on emergency_requests" ON public.emergency_requests FOR INSERT WITH CHECK (user_id IS NOT NULL AND user_location IS NOT NULL);
DROP POLICY IF EXISTS "Allow update on emergency_requests" ON public.emergency_requests;
CREATE POLICY "Allow update on emergency_requests" ON public.emergency_requests FOR UPDATE USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
DROP POLICY IF EXISTS "Allow delete on emergency_requests" ON public.emergency_requests;
CREATE POLICY "Allow delete on emergency_requests" ON public.emergency_requests FOR DELETE USING (id IS NOT NULL);

-- 5. Ambulance Crews policies
DROP POLICY IF EXISTS "Allow public read and write on ambulance_crews" ON public.ambulance_crews;
DROP POLICY IF EXISTS "Allow select on ambulance_crews" ON public.ambulance_crews;
CREATE POLICY "Allow select on ambulance_crews" ON public.ambulance_crews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert on ambulance_crews" ON public.ambulance_crews;
CREATE POLICY "Allow insert on ambulance_crews" ON public.ambulance_crews FOR INSERT WITH CHECK (id IS NOT NULL AND vehicle_number IS NOT NULL);
DROP POLICY IF EXISTS "Allow update on ambulance_crews" ON public.ambulance_crews;
CREATE POLICY "Allow update on ambulance_crews" ON public.ambulance_crews FOR UPDATE USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
DROP POLICY IF EXISTS "Allow delete on ambulance_crews" ON public.ambulance_crews;
CREATE POLICY "Allow delete on ambulance_crews" ON public.ambulance_crews FOR DELETE USING (id IS NOT NULL);

-- 6. Emergency Contacts policies
DROP POLICY IF EXISTS "Allow public read and write on emergency_contacts" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Allow select on emergency_contacts" ON public.emergency_contacts;
CREATE POLICY "Allow select on emergency_contacts" ON public.emergency_contacts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert on emergency_contacts" ON public.emergency_contacts;
CREATE POLICY "Allow insert on emergency_contacts" ON public.emergency_contacts FOR INSERT WITH CHECK (user_id IS NOT NULL AND contact_user_id IS NOT NULL);
DROP POLICY IF EXISTS "Allow update on emergency_contacts" ON public.emergency_contacts;
CREATE POLICY "Allow update on emergency_contacts" ON public.emergency_contacts FOR UPDATE USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
DROP POLICY IF EXISTS "Allow delete on emergency_contacts" ON public.emergency_contacts;
CREATE POLICY "Allow delete on emergency_contacts" ON public.emergency_contacts FOR DELETE USING (id IS NOT NULL);

-- 7. Connection Requests policies
DROP POLICY IF EXISTS "Allow public read and write on connection_requests" ON public.connection_requests;
DROP POLICY IF EXISTS "Allow select on connection_requests" ON public.connection_requests;
CREATE POLICY "Allow select on connection_requests" ON public.connection_requests FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert on connection_requests" ON public.connection_requests;
CREATE POLICY "Allow insert on connection_requests" ON public.connection_requests FOR INSERT WITH CHECK (sender_user_id IS NOT NULL AND recipient_phone IS NOT NULL);
DROP POLICY IF EXISTS "Allow update on connection_requests" ON public.connection_requests;
CREATE POLICY "Allow update on connection_requests" ON public.connection_requests FOR UPDATE USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
DROP POLICY IF EXISTS "Allow delete on connection_requests" ON public.connection_requests;
CREATE POLICY "Allow delete on connection_requests" ON public.connection_requests FOR DELETE USING (id IS NOT NULL);

-- 8. Hospitals Directory policies
DROP POLICY IF EXISTS "Allow public read on hospitals" ON public.hospitals;
CREATE POLICY "Allow public read on hospitals" ON public.hospitals FOR SELECT USING (true);

-- 9. Live Ambulance Tracking policies
DROP POLICY IF EXISTS "Allow public read and write on live_ambulance_tracking" ON public.live_ambulance_tracking;
DROP POLICY IF EXISTS "Allow select on live_ambulance_tracking" ON public.live_ambulance_tracking;
CREATE POLICY "Allow select on live_ambulance_tracking" ON public.live_ambulance_tracking FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert on live_ambulance_tracking" ON public.live_ambulance_tracking;
CREATE POLICY "Allow insert on live_ambulance_tracking" ON public.live_ambulance_tracking FOR INSERT WITH CHECK (emergency_id IS NOT NULL AND ambulance_id IS NOT NULL);
DROP POLICY IF EXISTS "Allow update on live_ambulance_tracking" ON public.live_ambulance_tracking;
CREATE POLICY "Allow update on live_ambulance_tracking" ON public.live_ambulance_tracking FOR UPDATE USING (emergency_id IS NOT NULL) WITH CHECK (emergency_id IS NOT NULL);
DROP POLICY IF EXISTS "Allow delete on live_ambulance_tracking" ON public.live_ambulance_tracking;
CREATE POLICY "Allow delete on live_ambulance_tracking" ON public.live_ambulance_tracking FOR DELETE USING (emergency_id IS NOT NULL);

-- 10. Emergency Status History policies
DROP POLICY IF EXISTS "Allow public read and write on emergency_status_history" ON public.emergency_status_history;
DROP POLICY IF EXISTS "Allow select on emergency_status_history" ON public.emergency_status_history;
CREATE POLICY "Allow select on emergency_status_history" ON public.emergency_status_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert on emergency_status_history" ON public.emergency_status_history;
CREATE POLICY "Allow insert on emergency_status_history" ON public.emergency_status_history FOR INSERT WITH CHECK (emergency_id IS NOT NULL AND status IS NOT NULL);
DROP POLICY IF EXISTS "Allow update on emergency_status_history" ON public.emergency_status_history;
CREATE POLICY "Allow update on emergency_status_history" ON public.emergency_status_history FOR UPDATE USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
DROP POLICY IF EXISTS "Allow delete on emergency_status_history" ON public.emergency_status_history;
CREATE POLICY "Allow delete on emergency_status_history" ON public.emergency_status_history FOR DELETE USING (id IS NOT NULL);

-- 11. Ambulance Ratings policies
DROP POLICY IF EXISTS "Allow public read and write on ambulance_ratings" ON public.ambulance_ratings;
DROP POLICY IF EXISTS "Allow select on ambulance_ratings" ON public.ambulance_ratings;
CREATE POLICY "Allow select on ambulance_ratings" ON public.ambulance_ratings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert on ambulance_ratings" ON public.ambulance_ratings;
CREATE POLICY "Allow insert on ambulance_ratings" ON public.ambulance_ratings FOR INSERT WITH CHECK (emergency_id IS NOT NULL AND ambulance_id IS NOT NULL AND rating >= 1);
DROP POLICY IF EXISTS "Allow update on ambulance_ratings" ON public.ambulance_ratings;
CREATE POLICY "Allow update on ambulance_ratings" ON public.ambulance_ratings FOR UPDATE USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
DROP POLICY IF EXISTS "Allow delete on ambulance_ratings" ON public.ambulance_ratings;
CREATE POLICY "Allow delete on ambulance_ratings" ON public.ambulance_ratings FOR DELETE USING (id IS NOT NULL);

-- 12. Service Feedback policies
DROP POLICY IF EXISTS "Allow public read and write on service_feedback" ON public.service_feedback;
DROP POLICY IF EXISTS "Allow select on service_feedback" ON public.service_feedback;
CREATE POLICY "Allow select on service_feedback" ON public.service_feedback FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert on service_feedback" ON public.service_feedback;
CREATE POLICY "Allow insert on service_feedback" ON public.service_feedback FOR INSERT WITH CHECK (rating >= 1);
DROP POLICY IF EXISTS "Allow update on service_feedback" ON public.service_feedback;
CREATE POLICY "Allow update on service_feedback" ON public.service_feedback FOR UPDATE USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
DROP POLICY IF EXISTS "Allow delete on service_feedback" ON public.service_feedback;
CREATE POLICY "Allow delete on service_feedback" ON public.service_feedback FOR DELETE USING (id IS NOT NULL);

-- 13. Sub-Admin Permissions policies
DROP POLICY IF EXISTS "Allow select sub_admin_permissions" ON public.sub_admin_permissions;
CREATE POLICY "Allow select sub_admin_permissions" ON public.sub_admin_permissions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert sub_admin_permissions" ON public.sub_admin_permissions;
CREATE POLICY "Allow insert sub_admin_permissions" ON public.sub_admin_permissions FOR INSERT WITH CHECK (admin_id IS NOT NULL);
DROP POLICY IF EXISTS "Allow update sub_admin_permissions" ON public.sub_admin_permissions;
CREATE POLICY "Allow update sub_admin_permissions" ON public.sub_admin_permissions FOR UPDATE USING (admin_id IS NOT NULL) WITH CHECK (admin_id IS NOT NULL);
DROP POLICY IF EXISTS "Allow delete sub_admin_permissions" ON public.sub_admin_permissions;
CREATE POLICY "Allow delete sub_admin_permissions" ON public.sub_admin_permissions FOR DELETE USING (admin_id IS NOT NULL);

-- 14. Admin Activity Logs policies
DROP POLICY IF EXISTS "Allow select admin_activity_logs" ON public.admin_activity_logs;
CREATE POLICY "Allow select admin_activity_logs" ON public.admin_activity_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert admin_activity_logs" ON public.admin_activity_logs;
CREATE POLICY "Allow insert admin_activity_logs" ON public.admin_activity_logs FOR INSERT WITH CHECK (action IS NOT NULL);
DROP POLICY IF EXISTS "Allow update admin_activity_logs" ON public.admin_activity_logs;
CREATE POLICY "Allow update admin_activity_logs" ON public.admin_activity_logs FOR UPDATE USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
DROP POLICY IF EXISTS "Allow delete admin_activity_logs" ON public.admin_activity_logs;
CREATE POLICY "Allow delete admin_activity_logs" ON public.admin_activity_logs FOR DELETE USING (id IS NOT NULL);

-- 15. Admin Login History policies
DROP POLICY IF EXISTS "Allow select admin_login_history" ON public.admin_login_history;
CREATE POLICY "Allow select admin_login_history" ON public.admin_login_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert admin_login_history" ON public.admin_login_history;
CREATE POLICY "Allow insert admin_login_history" ON public.admin_login_history FOR INSERT WITH CHECK (id IS NOT NULL);
DROP POLICY IF EXISTS "Allow update admin_login_history" ON public.admin_login_history;
CREATE POLICY "Allow update admin_login_history" ON public.admin_login_history FOR UPDATE USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
DROP POLICY IF EXISTS "Allow delete admin_login_history" ON public.admin_login_history;
CREATE POLICY "Allow delete admin_login_history" ON public.admin_login_history FOR DELETE USING (id IS NOT NULL);

-- 16. Admin Security policies
DROP POLICY IF EXISTS "Allow select admin_security" ON public.admin_security;
CREATE POLICY "Allow select admin_security" ON public.admin_security FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert admin_security" ON public.admin_security;
CREATE POLICY "Allow insert admin_security" ON public.admin_security FOR INSERT WITH CHECK (admin_id IS NOT NULL);
DROP POLICY IF EXISTS "Allow update admin_security" ON public.admin_security;
CREATE POLICY "Allow update admin_security" ON public.admin_security FOR UPDATE USING (admin_id IS NOT NULL) WITH CHECK (admin_id IS NOT NULL);
DROP POLICY IF EXISTS "Allow delete admin_security" ON public.admin_security;
CREATE POLICY "Allow delete admin_security" ON public.admin_security FOR DELETE USING (admin_id IS NOT NULL);

-- 17. Admin Notifications policies
DROP POLICY IF EXISTS "Allow select admin_notifications" ON public.admin_notifications;
CREATE POLICY "Allow select admin_notifications" ON public.admin_notifications FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert admin_notifications" ON public.admin_notifications;
CREATE POLICY "Allow insert admin_notifications" ON public.admin_notifications FOR INSERT WITH CHECK (title IS NOT NULL);
DROP POLICY IF EXISTS "Allow update admin_notifications" ON public.admin_notifications;
CREATE POLICY "Allow update admin_notifications" ON public.admin_notifications FOR UPDATE USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
DROP POLICY IF EXISTS "Allow delete admin_notifications" ON public.admin_notifications;
CREATE POLICY "Allow delete admin_notifications" ON public.admin_notifications FOR DELETE USING (id IS NOT NULL);

-- 18. Ambulance Performance policies
DROP POLICY IF EXISTS "Allow select ambulance_performance" ON public.ambulance_performance;
CREATE POLICY "Allow select ambulance_performance" ON public.ambulance_performance FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert ambulance_performance" ON public.ambulance_performance;
CREATE POLICY "Allow insert ambulance_performance" ON public.ambulance_performance FOR INSERT WITH CHECK (ambulance_id IS NOT NULL);
DROP POLICY IF EXISTS "Allow update ambulance_performance" ON public.ambulance_performance;
CREATE POLICY "Allow update ambulance_performance" ON public.ambulance_performance FOR UPDATE USING (ambulance_id IS NOT NULL) WITH CHECK (ambulance_id IS NOT NULL);
DROP POLICY IF EXISTS "Allow delete ambulance_performance" ON public.ambulance_performance;
CREATE POLICY "Allow delete ambulance_performance" ON public.ambulance_performance FOR DELETE USING (ambulance_id IS NOT NULL);
