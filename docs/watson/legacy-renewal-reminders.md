# Legacy Annual Renewal Reminders

Scheduled + manual job that nudges legacy **annual** members to renew, by tagging
them in ActiveCampaign at **30, 7, and 1 day** before their Watson paid-through
date. Per-tag ActiveCampaign automations send the actual emails.

- Netlify function: `netlify/functions/legacy-renewal-reminders.ts`
- Core logic: `src/lib/watson/legacyRenewalReminders.ts`
- ActiveCampaign client: `src/lib/activecampaign/client.ts`
- Audit table: `watson_legacy_renewal_reminders`

> This job is completely independent of the legacy annual **expiration**
> reconciliation (`legacy-annual-expiry`). It never modifies Watson dates and
> never removes Memberstack plans.

## Source-of-truth split

| System | Role |
|---|---|
| **Watson** (`legacy_members.subscriptionexpiring`) | **WHEN** to remind. The paid-through calendar day (America/Los_Angeles). |
| **Memberstack** | **WHETHER** to remind. If the member holds an active **paid** plan they have already repurchased ? skip. |
| **ActiveCampaign** | **Delivery only.** Date field + tag ? automation ? renewal email. |

### Why the Memberstack re-check is mandatory

Legacy annual members were imported into Memberstack on the **free** legacy
membership plan. When they continue, they buy a **new paid** Knit It Now
membership in Memberstack — they do **not** advance their Watson
`subscriptionexpiring` date. So the unchanged legacy date can never prove they
have not repurchased. Every reminder window re-checks Memberstack
(`memberHasActivePaidMembership`) and skips anyone with an active paid plan.

## Reminder windows and tags

On the America/Los_Angeles calendar day `D`, a member is a candidate for a window
when `subscriptionexpiring::date = D + windowDays`:

| Window | Condition (paid-through) | Exact tag |
|---|---|---|
| 30-day | `D + 30` | `legacy-renewal-30-day` |
| 7-day | `D + 7` | `legacy-renewal-7-day` |
| 1-day | `D + 1` | `legacy-renewal-1-day` |

Monthly subscribers (auto-renewing via Stripe) and beta rows are excluded from
the candidate universe.

## Per-candidate decision flow

For each candidate, in order (first match wins):

1. **Missing email** ? `skipped_missing_email`.
2. **Staff/test email** (`isStaffOrTestEmail`) ? `skipped_staff_or_test`.
3. **Ambiguous legacy email** (same email on >1 legacy row) ? `skipped_ambiguous`.
4. **Memberstack re-check**:
   - ambiguous match ? `skipped_ambiguous`
   - unique + active paid plan ? `skipped_active_paid`
   - unique + no paid plan, or not found ? continue (still a legacy annual member).
5. **Durable dedupe** — if the audit table already has a live `tagged` row for
   `(legacy_memberid, tag_name)` ? `skipped_already_tagged` (no ActiveCampaign call).
6. **ActiveCampaign contact lookup**:
   - **Not found** ? create/subscribe/tag (a brand-new contact has no consent conflict).
   - **Found** ? read list status and protect consent:
     - `unsubscribed` ? `skipped_unsubscribed`
     - `bounced` ? `skipped_bounced`
     - `unconfirmed` ? `skipped_unconfirmed`
     - already has the tag ? `skipped_already_tagged`
     - otherwise ? update date field, subscribe if not on list, then tag.

Before every tag, the Watson paid-through date (`D + windowDays`, `YYYY-MM-DD`) is
written to the **Legacy Membership Paid Through** ActiveCampaign date field via
`contact/sync`.

## Duplicate protection (layered)

1. **Watson audit** — a partial `UNIQUE INDEX (legacy_memberid, tag_name) WHERE
   outcome = 'tagged' AND dry_run = FALSE` plus a pre-write lookup.
2. **ActiveCampaign** — `contactTags` is checked before tagging; the API is also
   idempotent for repeated tag assignment.
3. **Automation** — configure each per-tag automation to run **once per contact**.

## Dry-run vs live

Mirrors `legacy-annual-expiry`:

- **Scheduled** (`netlify.toml`, daily `0 8 * * *`): live **only** when
  `LEGACY_RENEWAL_REMINDER_LIVE_ENABLED === "true"`. Otherwise dry-run.
- **Manual HTTP** GET/POST: **dry-run by default**. A live manual run requires
  **both** `?confirm=LIVE` **and** a correct `X-Legacy-Renewal-Secret` header.

Dry-run performs **read-only** ActiveCampaign calls to produce an accurate
preview, performs **zero** writes (no `contact/sync`, no list subscribe, no tag),
and **writes no audit rows**. Dry-run results appear only in the JSON response and
logs. The audit table is reserved for **live** attempts and outcomes.

## Environment variables

| Variable | Purpose |
|---|---|
| `WATSON_DATABASE_URL` | Watson Postgres (candidates + audit). |
| `MEMBERSTACK_SECRET_KEY` / `MEMBERSTACK_SANDBOX_SECRET_KEY` | Admin scan for the paid-plan re-check. |
| `ACTIVECAMPAIGN_API_KEY` | ActiveCampaign API token. |
| `ACTIVECAMPAIGN_BASE_URL` | e.g. `https://knitbymachine.activehosted.com` (no trailing `/api/3`, no trailing slash). |
| `ACTIVECAMPAIGN_KIN_LIST_ID` | Existing Knit It Now list id (numeric). Never auto-created; the job fails fast if it is missing. |
| `ACTIVECAMPAIGN_PAID_THROUGH_FIELD_ID` | Custom date field id for "Legacy Membership Paid Through". |
| `LEGACY_RENEWAL_REMINDER_LIVE_ENABLED` | Must be exactly `"true"` for a **scheduled** live run. |
| `LEGACY_RENEWAL_REMINDER_SECRET` | Required to authorize a **manual** live run (sent as `X-Legacy-Renewal-Secret`). Blank disables manual live runs. |

## ActiveCampaign dashboard setup

1. **List** — note the numeric id of the existing Knit It Now list
   (Lists ? the list ? id in the URL) and set `ACTIVECAMPAIGN_KIN_LIST_ID`.
2. **Custom field** — create (or reuse) a **Date** field named
   *Legacy Membership Paid Through*; set `ACTIVECAMPAIGN_PAID_THROUGH_FIELD_ID`
   to its numeric id.
3. **Tags** — the three tags are auto-created on first live use, or create them
   manually: `legacy-renewal-30-day`, `legacy-renewal-7-day`, `legacy-renewal-1-day`.
4. **Automations** — build one automation per tag ("when tag is added ? send
   email"), each set to run **once per contact**.

## Running it

Dry-run (safe; read-only) against the deployed function:

```powershell
curl.exe -sS -X POST "https://<site>/.netlify/functions/legacy-renewal-reminders"
```

Inspect the JSON: `result.dryRun` must be `true`, then review
`result.totals` (candidatesFound, wouldTag, and every `skipped*` bucket),
`result.windows[]` per-window counts, and spot-check `result.details[]`
(`outcome`, `reason`, `paidThrough`, `listStatus`).

Live manual run (only after a reviewed dry-run):

```powershell
curl.exe -sS -X POST "https://<site>/.netlify/functions/legacy-renewal-reminders?confirm=LIVE" `
  -H "X-Legacy-Renewal-Secret: <LEGACY_RENEWAL_REMINDER_SECRET>"
```

## Audit table

`watson_legacy_renewal_reminders` records **live** attempts and outcomes only
(created by `getWatsonNativeSchemaStatements` in `src/lib/watson/schema.ts`;
regenerate `schema.sql` with `npm run watson:generate-schema`).

## Tests

- `src/lib/watson/legacyRenewalReminders.test.ts` — window/tag mapping, dry-run
  safety (no writes, no audit), live tagging, and every skip/protection path.
- `netlify/functions/__tests__/legacy-renewal-reminders.test.ts` — scheduled vs
  manual dry-run/live authorization and request parsing.
