# Watson — Architecture

Watson bridges retired legacy ColdFusion data with ongoing customer support. Legacy history is imported once (and refreshed periodically until cutover); new support activity is stored natively in Postgres.

## High-level data flow

```
Legacy SQL Server
        ?
Periodic CSV exports
        ?
Import into Postgres
        ?
Read-only Legacy Support Admin
        ?
Editable Support Notes (Postgres)
```

## Components

### Legacy SQL Server (source of truth until retirement)

The existing ColdFusion application continues to own live legacy data until final cutover. Watson does not connect to SQL Server at runtime.

### Periodic CSV exports

Approved tables are exported from SQL Server to CSV on a schedule (see [import-plan.md](./import-plan.md)). Exports are the only bridge between legacy and Watson.

### Postgres (Watson database)

Postgres holds two distinct categories of data:

| Category | Mutability | Source |
|---|---|---|
| Legacy support tables | **Read-only** after import | CSV imports from SQL Server |
| Support notes (and related Watson-native tables) | **Editable** | Created and updated in Watson |

Imported legacy rows are treated as an immutable snapshot for support lookup. Corrections to legacy facts, if ever needed, happen outside Watson (e.g. a new import or a documented exception process)—not by editing imported rows in the admin UI.

### Read-only Legacy Support Admin (Astro application)

A modern Astro app (Netlify-hosted, consistent with knititnow-staging) provides:

- Member search
- Read-only views of imported legacy data (orders, courses, patterns, purchases, addresses, legacy admin notes from `Members.Notes`, etc.)
- Navigation structured around support workflows (see [ui-plan.md](./ui-plan.md))

No Bootstrap. Custom CSS. Sortable tables. Fast search as the primary entry point.

### Editable Support Notes (Postgres)

Support notes written in Watson are stored in Postgres tables designed for Watson—not in legacy import tables. They may reference member IDs from legacy data but are independent of CSV import cycles.

Future phases may add a **timeline** that merges legacy events (read-only) with Watson support notes (editable) for a single member view.

## Runtime boundaries

```
???????????????????????????????????????????????????????????
?                    Watson (Astro + API)                  ?
?  ????????????????    ????????????????????????????????   ?
?  ? Member search?    ? Read-only legacy views        ?   ?
?  ? & navigation ?????? (imported Postgres tables)    ?   ?
?  ????????????????    ????????????????????????????????   ?
?         ?                        ?                       ?
?         ?                        ? SELECT only           ?
?         ?                        ?                       ?
?  ????????????????    ????????????????????????????????   ?
?  ? Support notes?????? Postgres                      ?   ?
?  ? (CRUD)       ?    ? legacy_* + watson_notes       ?   ?
?  ????????????????    ????????????????????????????????   ?
???????????????????????????????????????????????????????????
         ? no connection to Legacy SQL Server at runtime
```

## Security and access (to be detailed in implementation)

- Admin-only access (align with existing admin gating patterns in knititnow-staging).
- Legacy data: read APIs only; no UPDATE/DELETE on imported tables from the application.
- Support notes: authenticated staff only; audit fields (created_at, updated_at, author) on Watson-native tables.

## Relationship to existing admin

Watson complements—not replaces—the ColdFusion admin and the newer Astro `/admin` reporting area documented in [admin-reporting-architecture.md](../admin-reporting-architecture.md). Watson is scoped to **legacy customer business history for support** after ColdFusion retirement.

## Technology choices (summary)

| Layer | Choice |
|---|---|
| UI | Astro |
| Styling | Custom CSS (no Bootstrap) |
| Database | Postgres |
| Legacy ingest | CSV files from SQL Server exports |
| Deployment | Netlify (consistent with staging site) |

Implementation details (schema naming, API routes, env vars) belong in Phase 2+ work; this document defines the architectural split between read-only legacy imports and editable Watson-native data.
