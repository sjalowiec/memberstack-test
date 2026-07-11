# Watson Legacy Importer

CLI tooling to load approved ColdFusion CSV exports into Postgres for the Watson read-only legacy support system.

## Prerequisites

- Node.js and npm (same versions as knititnow-staging)
- Postgres database for Watson (local or hosted)
- CSV exports under `legacy-data/exports/{batch-id}/` (gitignored; contains customer PII)

Install importer dependencies:

```bash
npm install --save-dev pg @types/pg
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `WATSON_DATABASE_URL` | Yes (import + validate) | Postgres connection string. Never commit real credentials. Copy `.env.example` to `.env`. |

Example:

```env
WATSON_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/watson
```

## Approved CSV exports

Each batch folder must include all eight approved exports. Files are matched by **table-name prefix**, not exact filename:

- `{ExportName}.csv`
- `{ExportName}_{snapshot-date}.csv` (for example `Members_2026-07-11.csv`)

Matching is case-insensitive (`pattern_library_2026-07-11.csv` maps to `Pattern_Library`).

When multiple files match the same export, the importer automatically selects the **newest** file using the snapshot date in the filename when present, otherwise the file modified time. The import report lists the selected file and any skipped matches.

| Legacy export | Postgres table | Example filenames |
|---|---|---|
| Members | `legacy_members` | `Members.csv`, `Members_2026-07-11.csv` |
| Subscriptions | `legacy_subscriptions` | `Subscriptions_2026-07-11.csv` |
| Store_Transactions | `legacy_store_transactions` | `Store_Transactions_2026-07-11.csv` |
| Store_Transactions_items | `legacy_store_transaction_items` | `Store_Transactions_items_2026-07-11.csv` |
| HomeStudy_Course_member_library | `legacy_course_member_library` | `HomeStudy_Course_member_library_2026-07-11.csv` |
| Member_pattern_details | `legacy_member_pattern_details` | `Member_pattern_details_2026-07-11.csv` |
| Pattern_Library | `legacy_pattern_library` | `pattern_library_2026-07-11.csv` |
| Pattern_Library_purchases | `legacy_pattern_library_purchases` | `pattern_library_purchases_2026-07-11.csv` |

The importer **fails clearly** if any required CSV is missing.

## Commands

### Dry-run (no database)

Parse CSVs, count rows, and report missing files without connecting to Postgres:

```bash
npm run watson:import -- --dry-run --dir=legacy-data/exports/2026-07-11
```

### Import batch

Apply schema (if needed), truncate legacy tables, and load the full snapshot:

```bash
npm run watson:import -- --dir=legacy-data/exports/2026-07-11
```

Optional batch override:

```bash
npm run watson:import -- --dir=legacy-data/exports/2026-07-11 --batch=2026-07-11
```

### Validate import

Compare Postgres row counts to the latest successful import metadata (and CSV counts for reference):

```bash
npm run watson:validate -- --dir=legacy-data/exports/2026-07-11
```

### Analyze CSV exports

Quick header and row-count report for a batch folder:

```bash
npm run watson:analyze-csv
```

## How reruns are handled

Each import run is **idempotent**:

1. Starts a Postgres transaction
2. Ensures schema exists (`schema.sql`)
3. **Truncates all `legacy_*` tables** (full snapshot replace)
4. Inserts all rows from the CSV batch
5. Records counts in `watson_import_runs` and `watson_import_run_tables`
6. Commits on success; rolls back on failure

Re-running the same batch replaces the prior snapshot. No duplicate legacy rows accumulate.

Watson support notes (future editable tables) are **not** truncated by this importer.

## Rejected rows

Rows rejected during parse or coercion are written under:

```
legacy-data/import-errors/{batch-id}/
  {pg_table}.rejected.csv
  {pg_table}.parse-rejected.csv
```

This folder is gitignored. Each reject file includes line number, reason, and row content.

## Import report fields

Per table the importer reports:

- **csv** ù data rows in the CSV (excluding header)
- **inserted** ù rows written to Postgres
- **skipped** ù duplicate primary keys within the same CSV
- **rejected** ù rows that failed parse/coercion validation
- **failed** ù rows that failed at insert time (causes rollback)

## Schema and metadata tables

Legacy snapshot tables (read-only after import):

- `legacy_members`
- `legacy_subscriptions`
- `legacy_store_transactions`
- `legacy_store_transaction_items`
- `legacy_course_member_library`
- `legacy_member_pattern_details`
- `legacy_pattern_library`
- `legacy_pattern_library_purchases`

Import metadata:

- `watson_import_runs`
- `watson_import_run_tables`

Source of truth for DDL: `src/lib/watson/schema.sql`

Regenerate after changing `tableDefinitions.ts`:

```bash
npm run watson:generate-schema
```

## Assumptions (2026-07-11 export batch)

- CSV encoding is UTF-8 with BOM (Windows SQL export)
- Column headers preserve legacy spelling (including typos such as `Fristname`, `PatternLibarry_id`)
- Empty strings and literal `NULL` become SQL `NULL`
- `BirthDayInfo` is stored as `DATE` (year 1900 placeholder preserved)
- `Member_pattern_details` is the lightweight saved-pattern export only (no large XML / pattern-generation fields)
- Legacy primary keys are preserved; duplicate keys within a CSV are skipped (second and later occurrences)
- Imported legacy rows are never updated by Watson application code

See also [data-model.md](./data-model.md) and [import-plan.md](./import-plan.md).

## Known export issues (2026-07-11)

Inspect before importing to production:

1. **`Store_Transactions` CSV is missing** from `legacy-data/exports/2026-07-11/` ù import will fail until this file is exported.
2. **`Store_Transactions_items` file content appears to be order/transaction header data** (billing, shipping, totals), not line-item rows. Confirm the SQL export script with Sue and re-export if needed.
3. **Last CSV header column includes a trailing `\r`** on some files ù normalized automatically by the importer.
4. **`Subscriptions.Monthlypaymentwddx`** contains WDDX XML ù stored as `TEXT`.
