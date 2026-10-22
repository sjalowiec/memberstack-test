# Postgres public-schema privileges — maintenance task

Status: not started. Do not treat this as permission to edit SQL, migrations, runtime schema helpers, or production grants. The rule for tables created from here on is in `.cursor/rules/server-only-postgres-tables.mdc`.

Reviewed 20 October 2026 against the Supabase change that, on 30 October 2026, stops automatic `SELECT` / `INSERT` / `UPDATE` / `DELETE` grants to `anon`, `authenticated`, and `service_role` on new `public` tables. Existing grants stay in place. This app connects as the table owner through `WATSON_DATABASE_URL`, so that change does not remove the access the app uses.

## Schema rebuild inconsistencies

Replaying the schema as the owner keeps current app queries working. It does not rebuild the privilege or row-level-security state of the live database.

- [ ] `src/lib/watson/schema.sql` is behind `src/lib/watson/schema.ts`. The SQL file has no `ENABLE ROW LEVEL SECURITY`, and it does not create `pattern_errata`, `watson_knit_able_schedules`, or `watson_complimentary_access`. The importer documents `schema.sql` as the schema source.
- [ ] `getWatsonNativeSchemaStatements()` enables row level security only for `watson_knit_able_schedules` and `watson_complimentary_access`.
- [ ] Help Hub, glossary, lessons, video posters, studio sessions, and What's New announcement tables are created only from `supabase/migrations` or `scripts/sql`. A schema replay does not create them.
- [ ] `supabase/migrations` is not a full database. It does not create the legacy import tables or most Watson tables.
- [ ] Several tables enable row level security only in a later migration (`What's New`, tip of the week, renewal reminders, legacy history, vendors, contact messages, home-study plans, errata, Help Hub, glossary, lessons, video posters, ebook entitlements). A replay of the create statements alone omits that step.
- [ ] These create paths have no row level security statement at all: `watson_notes`, `watson_store_fulfillments`, `watson_shopify_orders`, `watson_shopify_order_items`, `watson_shopify_sync_runs`, `watson_dak_licenses`, `watson_email_signups`, `watson_legacy_garments`, `watson_import_runs`, `watson_import_run_tables`, the `legacy_*` tables, `watson_studio_sessions`, `watson_whats_new_announcement_events`, `watson_whats_new_popup_announcement`, and `legacy_homestudy_credit_evidence`.

## Existing-table security questions

No `GRANT` statements exist. The only privilege statement is `REVOKE ALL` on `public.watson_ebook_entitlements` from `anon` and `authenticated`. Until 30 October 2026, Supabase default privileges still grant Data API roles on new tables. `service_role` bypasses row level security.

- [ ] Decide whether existing server-only tables should have `anon`, `authenticated`, and `service_role` revoked. Doing so changes production permissions. `service_role` is not covered by the ebook revoke.
- [ ] Decide whether tables that have no row level security should have it enabled, without `FORCE`, and without policies.
- [ ] Keep runtime helpers (`applyWatsonNativeSchema` and the other ensure-table paths) free of new `GRANT` or `REVOKE` statements. Those helpers run against the live database.
- [ ] Confirm `watson_import_runs` (`BIGSERIAL`) needs no sequence grant. The owner connection does not. The Data API is unused.
