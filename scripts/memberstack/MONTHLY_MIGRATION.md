# Monthly Memberstack migration

Approved reconciliation for the monthly Premium cohort. **Do not run `--execute` until final approval.**

| Cohort | Count | Treatment |
|---|---:|---|
| Existing Memberstack members | 46 | Update in place: keep Beta/DAK/other plans; set `legacyMemberID` if missing; attach Stripe so Premium plan syncs |
| New Memberstack members | 285 | Create with import fields + `legacyMemberID`; attach Stripe so Premium plan syncs |
| Manual review | 20 | Excluded (logged only; never created/updated) |

## Live API note (dry-run)

**Dry-run, `--preflight-only`, and `--verify` call the live Memberstack Admin API with GET only** (list/get members). They do not create, update, delete, or assign plans. Offline simulation is intentionally avoided so duplicate protection stays accurate.

## Local TLS (Windows / SSL inspection)

If Node fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` / `unable to verify the first certificate`:

```powershell
$env:MEMBERSTACK_TLS_INSECURE="1"
node scripts/memberstack/run-monthly-migration.mjs --preflight-only
```

Or add `MEMBERSTACK_TLS_INSECURE=1` to `.env` (local only).

## Exact execution (after approval)

Requires `MEMBERSTACK_SECRET_KEY` in `.env` (live app).

### Step 0 - Preflight + dry-run (GET only; safe to repeat)

```powershell
$env:MEMBERSTACK_TLS_INSECURE="1"
node scripts/memberstack/run-monthly-migration.mjs --preflight-only
node scripts/memberstack/run-monthly-migration.mjs
```

Review:

- `tmp/memberstack-import/output/updated-members.csv` (46)
- `tmp/memberstack-import/output/created-members.csv` (285)
- `tmp/memberstack-import/output/skipped-members.csv` (20)
- `tmp/memberstack-import/output/migration-summary.md`

### Step 1 - Pre-flight (manual)

Confirm in Stripe/Memberstack that product `KIN_Monthly_SUB_2023` / $19.99 monthly maps to price `prc_monthly-subscription-to-knititnow-webw0nzy` on plan `pln_kin-membership-annual-premium-tn5b0cxj`.

### Step 2 - API create/update (after approval only)

Passwords shorter than 8 characters are **skipped** into `skipped-members.csv` (`skipped_password_too_short`); the batch continues. Already-created emails take the idempotent update path (no duplicate create).

```powershell
$env:MEMBERSTACK_TLS_INSECURE="1"
node scripts/memberstack/run-monthly-migration.mjs --execute --i-understand-this-writes-to-memberstack
```

If a prior execute partially completed, see `tmp/memberstack-import/output/partial-execution-report.md` and `restart-safe-new-members.csv` before re-running.

### Step 3 - Attach Stripe customers (blocked — Admin API cannot set this field)

Source (validated, 319 rows): `tmp/memberstack-import/output/memberstack-stripe-attach.csv`

**Investigation (2026-07-17):** `PATCH /members/{id}` with `{ "stripeCustomerId": "cus_..." }` returns HTTP 2xx but does **not** persist the field. Official Admin REST docs list updatable PATCH fields as: `email`, `customFields`, `metaData`, `json`, `loginRedirect`, `verified`, `profileImage` — **not** `stripeCustomerId`. GET responses include `stripeCustomerId` as a read-only field (Betty: property present, value `null` after 319 “successful” PATCHes). Dashboard **Import Members** is create-only and rejects duplicate emails, so it also cannot attach Stripe to existing members.

The attach script still exists for investigation / future use, but execute must treat HTTP 2xx as failure unless a follow-up GET confirms persistence:

```powershell
$env:MEMBERSTACK_TLS_INSECURE="1"
node scripts/memberstack/attach-monthly-stripe-customers.mjs --preflight-only
node scripts/memberstack/attach-monthly-stripe-customers.mjs
# Do not bulk --execute until a supported attach method is confirmed.
```

**Next step (not automated):** confirm with Memberstack support the supported path for linking an existing `mem_` to an existing Stripe `cus_` / `sub_` (MCP lists `createStripeCustomer` / `importMembers`, but public Admin REST/Node docs do not document attaching an existing Stripe customer ID to an existing member).

Behavior of the attach script:

- Default is dry-run (GET only): classifies already correct / missing / conflicting
- Conflicts are never overwritten; they are logged for manual review
- Restart-safe and idempotent (already-correct rows are skipped)
- Execute requires follow-up GET confirmation; HTTP 2xx alone is not success
- Never creates/deletes members or changes email, password, legacyMemberID, plans, or other fields

### Step 4 - Verify

Member create/update verify:

```powershell
$env:MEMBERSTACK_TLS_INSECURE="1"
node scripts/memberstack/run-monthly-migration.mjs --verify
```

Stripe attach verify (after Step 3 execute; allow time for Stripe sync):

```powershell
$env:MEMBERSTACK_TLS_INSECURE="1"
node scripts/memberstack/attach-monthly-stripe-customers.mjs --verify
```

## Outputs

| File | Purpose |
|---|---|
| `updated-members.csv` | Per-member update decisions / results |
| `created-members.csv` | Per-member create decisions / results |
| `skipped-members.csv` | Manual-review + hard skips |
| `migration-summary.md` | Human-readable summary |
| `memberstack-stripe-attach.csv` | Validated Stripe attach queue (input to Step 3) |
| `stripe-attach-updated.csv` | Missing ? attached (or would attach in dry-run) |
| `stripe-attach-already-correct.csv` | Already had expected `stripeCustomerId` |
| `stripe-attach-conflicts.csv` | Live customer differs; not overwritten |
| `stripe-attach-errors.csv` | Per-row failures |
| `stripe-attach-summary.md` | Human-readable attach summary |
| `stripe-attach-verify.json` | Attach verification report |

Logs never include passwords.
