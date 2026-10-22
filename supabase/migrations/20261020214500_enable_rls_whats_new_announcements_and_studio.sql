-- Close the Supabase Data API on three server-only public tables.
--
-- The app reads and writes them only through WATSON_DATABASE_URL (the postgres
-- owner, which has BYPASSRLS). Watson admin pages check the watson_session
-- cookie. Announcement activity verifies a Memberstack token in the API route
-- before the server inserts a row. Neither path uses Supabase Auth, so there
-- is no auth.uid() policy that matches the real check.
--
-- No policies are added. anon and authenticated therefore receive no rows and
-- cannot insert. service_role bypasses row level security, so its grants are
-- revoked as well. Do not use FORCE ROW LEVEL SECURITY: the postgres role
-- Watson uses must keep access.
--
-- Do not add USING (true) policies. That would reopen the Data API.

ALTER TABLE public.watson_whats_new_announcement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watson_studio_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watson_whats_new_popup_announcement ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.watson_whats_new_announcement_events FROM anon, authenticated, service_role;
REVOKE ALL ON TABLE public.watson_studio_sessions FROM anon, authenticated, service_role;
REVOKE ALL ON TABLE public.watson_whats_new_popup_announcement FROM anon, authenticated, service_role;
