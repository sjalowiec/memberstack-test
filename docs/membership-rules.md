# Membership Rules

updated 2026-07-22

## Membership plans

- Knit it Now Membership Monthly: $19.99
- Knit it Now Membership Annual: $228.00

There is one paid membership. KIN Beta Access (`pln_kin-beta-access-vyek0a38`) is retired and no longer grants site content access.

## Legacy membership (free access plan)

- A confirmed Watson `legacy_members.subscriptionexpiring` date that is today or in the future (America/Los_Angeles calendar day) grants the same access as paid membership. The free Memberstack plan **legacy membership** (`pln_legacy-membership-t012x0xw0`) is **not required** when that date is confirmed.
- It is part of the shared candidate list (`MEMBER_PLAN_IDS`) consumed by `hasMemberAccess`. Plan presence alone is not enough; a free legacy plan without a valid Watson date does not grant access.
- It is a free plan with no checkout price or Stripe association; it must never appear in `MEMBERSHIP_PRICE_IDS` and does not affect checkout pricing or billing.
- **Expiration is enforced by the access gate.** `hasMemberAccess` requires a valid paid-through date when there is no active paid Memberstack plan. A scheduled reconciliation still removes expired plan connections from Memberstack; the gate does not wait for that job.

## Legacy annual expiration

Legacy annual members were migrated into Memberstack, often with the free legacy membership access plan (`pln_legacy-membership-t012x0xw0`) but **no Stripe subscription**. Their paid-through date lives in Watson (`legacy_members.subscriptionexpiring`). Site access consults that date at request time (`hasMemberAccess` / `evaluateMemberAccessForRecord`) for any logged-in member without an active paid plan. The scheduled job still removes expired plan connections so Memberstack records stay in sync.

A scheduled reconciliation continues to remove expired connections:

- **Job:** `netlify/functions/legacy-annual-expiry.ts` (core logic in `src/lib/watson/legacyAnnualExpiry.ts`), scheduled daily at 09:00 UTC in `netlify.toml` (safely after midnight in America/Los_Angeles).
- **Scheduled live guard:** a scheduled run performs live Memberstack changes **only when `LEGACY_ANNUAL_EXPIRY_LIVE_ENABLED` is exactly `"true"`**. Any other value (unset, `false`, etc.) keeps scheduled runs in dry-run mode.
- **Paid-through source:** `legacy_members.subscriptionexpiring` is the authoritative date.
- **Calendar rule:** same as the membership status API — the paid-through day itself still has access; expiration occurs only when `subscriptionexpiring::date` is **strictly earlier** than today in America/Los_Angeles.
- **Action:** for each expired member, look up the Memberstack member by exact email and remove **only** the `pln_legacy-membership-t012x0xw0` connection via the Admin API (`POST /members/:id/remove-plan`).
- **Renewal safety:** members who hold any other active paid membership plan are skipped and keep access. Members whose legacy plan is already absent are skipped (idempotent, so repeated runs are safe).
- **Robustness:** members with a blank email, a duplicate legacy email, or no unique Memberstack match are skipped and reported; per-member failures never abort the batch.
- **`hasMemberAccess` now also enforces the paid-through date** when there is no active paid plan. The free Memberstack legacy plan is not required. Removing the Memberstack connection remains a cleanup step so expired members do not keep a misleading plan on their account.

### Running the reconciliation

- **Scheduled runs are live only when opted in.** They run dry-run unless `LEGACY_ANNUAL_EXPIRY_LIVE_ENABLED === "true"`.
- **Manual HTTP runs default to dry-run.** `GET`/`POST` to `/.netlify/functions/legacy-annual-expiry` reports exactly what would change without modifying Memberstack.
- **A manual live run requires BOTH** `?confirm=LIVE` **and a correct** `X-Legacy-Expiry-Secret` **header** (matching `LEGACY_ANNUAL_EXPIRY_SECRET`). A manual live run does **not** depend on `LEGACY_ANNUAL_EXPIRY_LIVE_ENABLED` — the explicit confirmation plus the secret are the safeguard. If the secret is unset or the header is wrong, a live manual request is rejected with `401`.
- **Result summary** counts: candidates found, legacy plans removed, skipped (already removed), skipped (another paid plan active), skipped (no unique Memberstack match), and failures.

### Deployment sequence (first rollout)

1. **Deploy with `LEGACY_ANNUAL_EXPIRY_LIVE_ENABLED=false`** (and `LEGACY_ANNUAL_EXPIRY_SECRET` set). Every scheduled run is dry-run, so nothing is modified automatically.
2. **Run and inspect a dry run** via the manual endpoint (plain POST). Confirm `ok: true`, `dryRun: true`, `failures: 0`, and that the counters/`details[]` look correct.
3. **Perform a controlled manual live run if approved:** POST with `?confirm=LIVE` and the `X-Legacy-Expiry-Secret` header.
4. **Verify the results** — check the returned counts and spot-check affected members in Memberstack/Watson.
5. **Only then set `LEGACY_ANNUAL_EXPIRY_LIVE_ENABLED=true`** so future scheduled runs enforce expirations automatically.

## Live status vs legacy history

- **Memberstack is authoritative for live paid membership.** Current paid status, canceling-but-still-active access, and paid plan connections are read from Memberstack at request time.
- **The free legacy plan is not sufficient by itself.** Access also requires a unique Watson paid-through date (`legacy_members.subscriptionexpiring`) that is today or in the future (America/Los_Angeles). A free legacy plan without that valid date does not grant access.
- **A confirmed Watson paid-through date grants access without the free Memberstack plan.** Logged-in members with no active paid plan are looked up in Watson. Today or a future `subscriptionexpiring` date is Legacy Access. An expired date, no record, or a failed/ambiguous lookup does not grant access.
- On `/membership`, **logged-out visitors see the normal sales page only** (no status panel, loading/wait overlays, or authenticated status endpoint). Personalized membership-status UI runs only after Memberstack confirms login. Knit it Now does not create Memberstack accounts merely to collect an email — prospects choose monthly/annual and create/receive their account in the purchase flow.
- For logged-in visitors, client Memberstack is authoritative for current **paid** status. `/membership` and Account status use the same `hasMemberAccess` determination as the access gate: a valid Watson `subscriptionexpiring` (today or later) is shown as active / Legacy Access, with or without the free Memberstack plan. An expired date is shown as ended/expired, not as an active plan. A Watson lookup failure for non-paid members fails closed (wait / could-not-confirm), never Active. A successfully loaded member with **no qualifying access** is purchase-eligible when legacy is `not_found` or expired (not a lookup failure). Server legacy context is consulted when the client has no paid plan and no currently valid Watson-legacy access.
- A uniquely linked `subscriptionexpiring` that is **today or in the future** grants access and must be shown as Legacy Membership / Active (or Legacy Access) with the access-through date. Do not describe that account as a synchronization error, and do not show Become a Member. Past `subscriptionexpiring` dates and **no legacy record** (`not_found`) recommend purchase. A failed legacy Watson lookup (`lookup_unavailable`) waits / could-not-confirm — it is not treated as “no record,” Expired, or Active. Subscription history may appear in the history accordion only; it never determines current access or current-status labels when `subscriptionexpiring` is present.
- The public summary endpoint `GET /.netlify/functions/membership-status` exposes a restricted customer-facing view for logged-in members on `/membership`. It never trusts a browser-supplied member id or email (identity comes from the verified Memberstack JWT via `requireMember`).
- **Checkout protection remains independent** (`memberHasActivePaidMembership`, `resolveMembershipCheckoutDecision`, sales/join CTAs) and must not be weakened by the status panel. The panel may suppress purchase CTAs for ambiguous or unavailable lookups, but it does not replace those safety rules.

## Billing rules

- Renewals are handled automatically by Stripe.
- Membership access continues while the subscription is active.
- Cancellation leaves access available through the paid-through date.
- Failed payments follow the Stripe retry and cancellation settings.

## Billing interval changes

- Monthly to Annual and Annual to Monthly are managed through the billing portal when supported by Stripe/Memberstack.
- New members choose monthly or annual at checkout.

## Member benefits

- Active members have access to member lessons, tools, Help Hub resources, downloads, all Pattern Builders, and all Knit It Now courses.

## Dynamic Patterns access

- Dynamic Patterns (catalog, builders, saved/generated patterns, print) require **active Knit it Now membership** only — canonical `hasMemberAccess` (paid membership, or a confirmed Watson paid-through date today or later). Retired KIN Beta Access does not grant access.
- A Memberstack account alone (login, DesignaKnit, course, prior/canceled membership) does **not** grant Dynamic Pattern access.
- Lifetime Pattern Builder plan connections, Memberstack JSON unlock flags (`sleevelessPatternSystemUnlocked`), free-claim JSON, and localhost/dev bypass do **not** grant Dynamic Pattern access.
- There is no free-account or one-free-pattern path for Dynamic Patterns.
- The public Patterns landing page (`/patterns/about`) remains public for marketing; the catalog and builders are membership-gated.

## Lifetime Pattern Builder purchases

- Lifetime products may still exist in Memberstack/checkout configuration for historical records.
- Lifetime ownership alone does **not** unlock Dynamic Patterns; active membership is required.
- Active members have access to all Pattern Builders.
