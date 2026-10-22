-- Close the Supabase Data API on public.watson_knit_able_schedules.
-- Knit-able scheduling reads and writes this table only through server-side
-- Postgres (WATSON_DATABASE_URL / queryWatson). No policies are added, so the
-- anon and authenticated roles get no rows and cannot insert.
-- Do not use FORCE ROW LEVEL SECURITY. The postgres role used by Watson has
-- BYPASSRLS and must keep scheduling access. Grants stay as they are on the
-- other Watson public tables.
--
-- Do not apply to production until this change is reviewed.

ALTER TABLE public.watson_knit_able_schedules ENABLE ROW LEVEL SECURITY;
