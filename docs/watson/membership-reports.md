# Watson membership reports

Read-only reports under `/watson/reports` that help support and migration work using imported legacy Postgres data.

These reports are **not** live Memberstack/Stripe status. They use the Watson legacy import snapshot.

## Public membership status (related)

The member-facing endpoint `GET /.netlify/functions/membership-status` is **not** a Watson staff report. It reuses Watson identity/legacy-link helpers plus live Memberstack Admin lookup to show a small summary on `/membership`.

Rules that also apply here:

- Memberstack remains authoritative for live membership.
- Unique email-linked legacy rows may supply `legacyExpirationDate` / previous plan labels as history only.
- Ambiguous shared emails never auto-link another customer?s history.
- Legacy expiration never grants current access and must not be worded as current access.
- Future/today legacy paid-through (America/Los_Angeles calendar compare) ? contact support before purchase; past ? ?ended on? + purchase allowed.
- Checkout protection on the sales page stays independent of this summary.

## Current Legacy Members

**Route:** `/watson/reports/current-legacy-members`

### Purpose

Reproduce the current-membership universe used by Matthew?s legacy ColdFusion active-subscriptions screens.

### Universe (legacy current-state fields)

```sql
COALESCE(betaactive, 0) = 0
AND subscriptionexpiring IS NOT NULL
AND subscriptionexpiring::date >= CURRENT_DATE
```

This matches `Sub_details_list.cfm` (`>= now()`).  
`Sub_details.cfm` used a stricter `> now()` comparison; Watson documents that difference and uses `>=`.

One row per `legacy_members` row. Active status is **not** taken from `legacy_subscriptions`.

### Display notes

- Null/blank `subscriptiontype` is shown as **Membership, legacy type blank**.
- Latest subscription amount, processor, rate ID, and expiration are enrichment from the member?s latest `legacy_subscriptions` row (`ORDER BY datebought DESC`). They are not what the legacy screen used to decide ?active.?
- This report reflects imported current-state fields. It does **not** claim perfect accuracy.

### Summary cards

- Total current members
- Counts by exact displayed subscription type
- Expiring within 30 / 60 / 90 days
- Monthly vs non-monthly (`monthlysubscriber`)
- With vs without legacy Stripe customer ID (`stripcustomerid`)

## Remaining Annual Access

**Route:** `/watson/reports/remaining-annual-access`

### Purpose

Identify every **current** member who appears to have annual or installment paid-through access and may need special migration handling.

Annual memberships **did not automatically renew**. The report never describes them as auto-renewing. It shows paid-through date, access category, processor, and whether migration may need manual handling.

### Universe

Same current-member rule as above, then exclude obvious monthly members when:

- `monthlysubscriber = 1`, or
- latest subscription `monthlybilling = 1`, or
- latest amount is a monthly price (`9.99`, `13.99`, `15.99`, `19.99`)

### Classification (distinct members)

Applied in this order:

1. **Manual or complimentary access**  
   Payment Request; amount ? $1; Free/Trial types; staff/test emails; expiration after 2030.

2. **Confirmed annual, single payment**  
   Known annual `subscriptionrate_id` **and** latest `monthlybilling = 0` **and** amount in `$129 / $144 / $199 / $228`.

3. **Annual access, installment plan**  
   Three-payment subscription types, known installment rate IDs, or amounts `$45 / $50 / $80`.

4. **Probable annual, single payment**  
   Non-monthly with annual-looking amount and/or ~300?450 day member term, but missing/blank/inconsistent type or rate.

5. **Unresolved non-monthly**  
   Remaining current non-monthly members that do not fit a reliable product rule.

### Known annual rate IDs (inferred from import profiling)

| Rate ID | Typical amount | Notes |
|---|---|---|
| `A1C5572D-E311-D637-AE12-EDE03F978083` | $228 | Premium annual |
| `A3B982C4-C38B-ADBE-976E-74BF7E206134` | $144 | Basic annual |
| `7BE384D6-AA24-CCDD-CC5E-D0A919B4CF9F` | $199 | Older premium annual |
| `0ED57103-BCD1-7507-6767-390B9C08623E` | $129 | Older basic annual |
| `BDDAAA7D-E693-879A-A58A-41A3767B112C` | $129 | Basic variant |
| `8EC1301D-5056-A02D-DF5E-999D3DEF52CA` | $129 | Basic variant |
| `1B4A9622-036C-3F12-F565-1B9ED5BC4F06` | $129 | Basic variant |

Installment rate IDs used for classification:

- `A384521E-9BD0-4085-DD12-775999B33BCE` ($80)
- `A3D7A352-B4E9-1F52-111B-8ED722C66FBE` ($50)
- `0EE3EA0F-C3F2-FA48-1101-577D4BCAD7EB` (older three-payment amounts)

Watson does **not** import a SubscriptionRates lookup table. These IDs were inferred from amount/`premium`/member-type patterns in the imported data.

### Processor display

- Explicit `processor` values: Stripe, PayPal, Payment Request, or raw text
- If processor is blank and `arb_id` starts with `sub_`, display Stripe *(inferred)*
- If processor is blank and `arb_id` is numeric, display Authorize.net *(inferred)*
- Otherwise Unknown

### Exception flags

- Member expiration differs from latest subscription expiration
- Missing type / rate / processor
- Duplicate current subscription records
- Suspicious amount
- Expiration after 2030
- Likely staff/test record
- Migration may require manual handling

### Summary cards

Shown separately (never collapsed into one approximate annual total):

- Confirmed annual single-payment
- Probable annual single-payment
- Annual installment access
- Manual/complimentary
- Unresolved non-monthly
- Expiring within 30 / 60 / 90 days

## Former Members - No Memberstack Account

**Route:** `/watson/reports/former-members-no-memberstack`

### Purpose

Build a **strict, read-only email list** of former **confirmed legacy annual** (and annual-installment) members whose old login will not work because they have no Memberstack account. Does not send email and does not mutate Memberstack, ActiveCampaign, Stripe, or Watson.

### Watson universe

```sql
subscriptionexpiring IS NOT NULL
AND subscriptionexpiring::date < today_Los_Angeles
AND subscriptionexpiring::date >= '2025-11-01'
```

Uses `legacy_members.subscriptionexpiring` for the paid-through window (on/after November 1, 2025; before today). Does **not** treat the free Memberstack Legacy plan as evidence that membership expired.

### Annual product filter

Reuses Remaining Annual Access classification helpers:

1. Exclude obvious monthly (`monthlysubscriber = 1`, latest `monthlybilling = 1`, or monthly amount).
2. Include only **confirmed annual single-payment** or **annual installment**.
3. Probable / manual / unresolved types go to a **manual-review** bucket and never enter the email CSV.

### Memberstack rule (strict)

Live Admin scan (`listMembers`) indexed by normalized email, applied only to confirmed annual / installment candidates:

| Resolution | Email CSV? | Review bucket |
|---|---|---|
| `not_found` | **Yes** | Email list |
| `unique` | No | Memberstack account found |
| `ambiguous` | No | Ambiguous email match |
| `error` | No | Lookup error |
| Missing / invalid email | No | Missing or invalid email |
| Same email on multiple Watson member IDs | No | Duplicate Watson record |

**Fail closed:** if the Memberstack member scan fails or is truncated, the report does not load an email list and never interprets an incomplete scan as `not_found`.

### Email CSV columns

First name, Last name, Email, Old subscription end date, Watson status, Memberstack result, Qualification reason (confirmed legacy annual vs confirmed legacy annual installment).

### Code

| Piece | Path |
|---|---|
| Report logic | `src/lib/watson/formerMembersNoMemberstackReport.ts` |
| UI | `src/components/watson/WatsonFormerMembersNoMemberstackReport.astro` |
| Page | `src/pages/watson/reports/former-members-no-memberstack.astro` |

## Filters and CSV

Current Legacy Members and Remaining Annual Access support in-page filters and CSV export of the **currently filtered** rows. Export is client-side from the loaded report.

The Former Members - No Memberstack report exports CSV for the **strict email list only**.

## Code

| Piece | Path |
|---|---|
| Shared query / helpers | `src/lib/watson/legacyMembershipReportsShared.ts` |
| Current members report | `src/lib/watson/currentLegacyMembersReport.ts` |
| Remaining annual report | `src/lib/watson/remainingAnnualAccessReport.ts` |
| Former members (no Memberstack) | `src/lib/watson/formerMembersNoMemberstackReport.ts` |
| UI | `src/components/watson/WatsonCurrentLegacyMembersReport.astro`, `WatsonRemainingAnnualAccessReport.astro`, `WatsonFormerMembersNoMemberstackReport.astro` |
| Pages | `src/pages/watson/reports/current-legacy-members.astro`, `remaining-annual-access.astro`, `former-members-no-memberstack.astro` |
