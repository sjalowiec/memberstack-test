# Watson ù Data Model

This document defines the **approved export tables** from legacy SQL Server and the **business rules** support staff and implementers must respect. Watson imports these tables into Postgres as read-only legacy data.

## Approved export tables

Only the following tables are in scope for Watson v1 imports:

| Table | Purpose (support context) |
|---|---|
| **Members** | Core member profile, contact info, mailing addresses, legacy private admin notes |
| **Subscriptions** | Historical subscription records |
| **Store_Transactions** | Store order headers |
| **Store_Transactions_items** | Line items for store orders |
| **HomeStudy_Course_member_library** | Course enrollments / member course library |
| **Member_pattern_details** | Member-saved pattern details |
| **Pattern_Library** | Pattern catalog metadata referenced by member patterns and purchases |
| **Pattern_Library_purchases** | Legacy PDF / pattern library purchases |

Tables not on this list are out of scope unless explicitly approved and documented here.

## Import rules

- Imported legacy data is **never edited** in Watson or in Postgres by the application.
- Each import run replaces or upserts snapshot data according to the process in [import-plan.md](./import-plan.md); the UI always reflects the latest successful import.
- Primary keys and foreign keys from legacy exports should be preserved where possible to join related rows (member ? subscriptions, transactions ? items, patterns ? purchases).

## Entity relationships (conceptual)

```
Members
  ??? Subscriptions
  ??? Store_Transactions ? Store_Transactions_items
  ??? HomeStudy_Course_member_library
  ??? Member_pattern_details ? Pattern_Library (reference)
  ??? Pattern_Library_purchases ? Pattern_Library (reference)
```

Exact column lists and Postgres table naming are defined in [importer.md](./importer.md) and `src/lib/watson/schema.sql`.

## Postgres table mappings

| Legacy export | Postgres table | Primary key |
|---|---|---|
| Members | `legacy_members` | `memberid` |
| Subscriptions | `legacy_subscriptions` | `subscriptionid` |
| Store_Transactions | `legacy_store_transactions` | `storetransactionid` |
| Store_Transactions_items | `legacy_store_transaction_items` | `storetransactionid`, `transactionid` |
| HomeStudy_Course_member_library | `legacy_course_member_library` | `homestudy_libraryid` |
| Member_pattern_details | `legacy_member_pattern_details` | `detailid` |
| Pattern_Library | `legacy_pattern_library` | `patternlibarry_id` |
| Pattern_Library_purchases | `legacy_pattern_library_purchases` | `pattern_library_purchases` |

## Business rules

These rules reflect legacy ColdFusion behavior and data quality quirks. Implementers and support staff should not treat certain fields as live or authoritative without understanding these constraints.

### Subscriptions

- **`CurrentSubscriber` is unreliable.** Do not use it as the sole indicator of active membership. Prefer `SubscriptionDate`, `SubscriptionExpiring`, and related fields for historical context; cross-check with current Memberstack/Stripe data outside Watson when answering whether a member is active today.
- **`SubscriptionDate` and `SubscriptionExpiring` are historical.** They describe legacy subscription records at export time, not necessarily current billing state on the new site.
- **Legacy ?current members? report rule** (Matthew / ColdFusion list screens): `betaactive = 0` and `subscriptionexpiring::date >= CURRENT_DATE` on `legacy_members`. See [membership-reports.md](./membership-reports.md). Do not use `legacy_subscriptions` alone to decide current status.
- **`Single Payment` is not synonymous with annual membership.** It mixes monthly ($19.99) and one-time/annual purchases.

### Members ù dates and notes

- **`BirthDayInfo` uses year 1900 and stores only month/day.** The year is a placeholder, not the memberùs birth year. Display and search should treat it as month/day only (e.g. ùMarch 15ù), not a full date of birth.
- **`Members.Notes` are private admin notes and must be preserved.** These are legacy staff notes from ColdFusion admin. They must be imported and shown in Watson (read-only). They are not the same as new Watson support notes (editable, Postgres-native).

### Addresses

- **Mailing addresses must be preserved.** Full mailing address fields from `Members` (and any related address columns in the export) are required for support (shipping issues, tax/regional questions, account verification). Do not drop or truncate address data during import.

## Watson-native data (not from CSV)

The following are **not** legacy exports; they are created in Watson and stored in Postgres:

| Concept | Description |
|---|---|
| **Support notes** | New notes added by support staff in Watson; editable, with audit metadata |
| **(Future) Timeline entries** | May combine imported legacy events with support notes for a unified member chronology |

Legacy `Members.Notes` remain read-only imported data and must be visually distinct from Watson support notes in the UI.

## Data quality expectations

- Legacy exports may contain NULLs, inconsistent casing, and obsolete status flags.
- Import validation should log row counts and key join failures; support UI should degrade gracefully (missing related row ? show what exists, flag gaps).
- Search indexes should cover common support lookups: email, member ID, name, transaction IDs where applicable.

## Open items (Phase 1)

- [x] Confirm exact column lists per approved table from SQL Server schema
- [x] Define Postgres schema names (`legacy_*`) and import metadata tables
- [ ] Confirm PII handling and retention policy for exports at rest
