-- Enable Row Level Security on Watson public tables that are accessed only
-- via server-side Postgres (WATSON_DATABASE_URL / queryWatson).
-- No policies are added: anon and authenticated PostgREST roles get no access.
-- Do not use FORCE ROW LEVEL SECURITY (table owners / bypass roles keep access).

ALTER TABLE public.watson_whats_new_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watson_whats_new_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watson_legacy_renewal_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watson_tip_of_the_week ENABLE ROW LEVEL SECURITY;
