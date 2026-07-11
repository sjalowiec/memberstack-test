# Watson — Import Plan

Legacy customer history enters Watson through **CSV exports** from SQL Server and **batch import** into Postgres. Watson never reads SQL Server at runtime.

## End-to-end flow

```
Legacy SQL Server
        ?
CSV exports
        ?
Postgres import
        ?
Repeat refreshes until final cutover
        ?
Final production import
```

## Phase A — Export from SQL Server

### Approved tables

Exports must include only the tables listed in [data-model.md](./data-model.md):

- Members
- Subscriptions
- Store_Transactions
- Store_Transactions_items
- HomeStudy_Course_member_library
- Member_pattern_details
- Pattern_Library
- Pattern_Library_purchases

### Export format

- **CSV** (UTF-8), one file per table.
- Include column headers matching source column names (document any renames in import scripts).
- Preserve primary keys and foreign-key columns for joins.
- Date/datetime columns: consistent ISO-friendly format in export scripts; document timezone (legacy server local vs UTC).

### Export location and naming

Convention (to be finalized in Phase 1):

```
exports/
  YYYY-MM-DD/
    Members.csv
    Subscriptions.csv
    Store_Transactions.csv
    ...
```

Each run gets a **batch ID** (date stamp or explicit version) stored in Postgres import metadata.

### Who runs exports

During transition: ops or dev with SQL Server access, on a agreed schedule (e.g. weekly staging refresh, daily near cutover). Exact schedule is an operational decision, not fixed in this doc.

## Phase B — Import into Postgres

### Principles

- Imported legacy tables are **read-only** in the application layer after load.
- Import is **idempotent per batch**: re-running the same batch should not duplicate rows (use truncate-and-load per table, or upsert on legacy primary keys—pick one strategy and document it).
- Validate after each import:
  - Row counts per table vs CSV line counts (minus header)
  - Spot-check join integrity (e.g. orphan transaction items)
  - Log warnings for NULL keys on required relationships

### Suggested steps (per batch)

1. Receive CSV files for batch `YYYY-MM-DD`.
2. Record batch start in `import_batches` (or equivalent metadata table).
3. Load each table in dependency order (e.g. Members and Pattern_Library before child tables).
4. Rebuild or refresh search indexes (member email, name, ID).
5. Record batch completion, row counts, errors.
6. Smoke test: search one known member in staging Watson.

### Staging vs production

- **Staging Postgres** receives repeated refreshes during development and UAT.
- **Production Postgres** receives refreshes on the same process until cutover; the **final production import** is the last full export taken before or at ColdFusion retirement.

## Phase C — Repeat refreshes until final cutover

While ColdFusion remains live:

```
???????????????     periodic      ???????????????
? SQL Server  ? ??? exports ????  ?    CSV      ?
???????????????                   ???????????????
                                         ?
                                         ?
                                  ???????????????
                                  ?  Postgres   ? ??? Watson reads here
                                  ?  (staging)  ?
                                  ???????????????
```

- Refresh frequency increases as cutover approaches (weekly ? daily ? final).
- Watson support notes in Postgres **persist across legacy refreshes**; only legacy snapshot tables are replaced/upserted.
- Communicate to support: “as of {batch date}” for legacy snapshot data if UI does not already show import timestamp.

## Phase D — Final production import

1. **Freeze** legacy exports: final CSV set from SQL Server after last acceptable data window (define cutover window with stakeholders).
2. Run import against **production** Postgres using the same tooling as staging.
3. Verify row counts, critical member spot checks, and that Watson support notes (if any pre-cutover testing notes exist in prod) remain intact.
4. Mark batch as `production_final` in metadata.
5. Decommission SQL Server export dependency for ongoing ops; Watson legacy data is now the archival source unless a emergency re-import is explicitly approved.

## What is never imported via “edit”

- Support must not “fix” bad legacy rows in Postgres by hand except through a **new documented import** or controlled DBA script outside normal app operation.
- The application must not expose UPDATE/DELETE on legacy tables.

## Tooling (to be built in Phase 1)

- CLI or script: `import-watson-batch --dir exports/YYYY-MM-DD --database $DATABASE_URL`
- Optional: Netlify/admin trigger for staging-only imports (production imports likely remain CLI/CI for safety).

## Security and storage

- CSV files contain PII; restrict file share access; do not commit exports to git.
- Encrypt backups of Postgres containing legacy PII per org policy.
- Document retention: how long CSV files are kept on disk after successful import.

## Failure handling

| Failure | Action |
|---|---|
| Partial table load | Roll back batch or mark batch failed; do not serve mixed stale/new without flag |
| Row count mismatch | Block promotion to production Watson until investigated |
| Missing table in export | Fail batch; Watson may show stale previous batch with warning banner |
| Charset/encoding issues | Normalize to UTF-8 at export; log replacement characters |

## Checklist before first staging import

- [ ] Postgres instance provisioned (staging)
- [ ] Schema migrations for legacy tables + import metadata
- [ ] Sample export CSV set from SQL Server (sanitized subset acceptable for dev)
- [ ] Import script with validation report
- [ ] Documented column mapping per approved table
