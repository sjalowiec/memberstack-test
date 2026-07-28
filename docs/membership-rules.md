# Membership Rules

updated 2026-07-22

## Membership plans

- Knit it Now Membership Monthly: $19.99
- Knit it Now Membership Annual: $228.00

There is one paid membership. KIN Beta Access (`pln_kin-beta-access-vyek0a38`) is retired and no longer grants site content access.

## Legacy membership (free access plan)

- The active Memberstack free plan **legacy membership** (`pln_legacy-membership-t012x0xw0`) grants full Knit It Now member access — the same access as the paid membership.
- It is part of the shared allow list (`MEMBER_PLAN_IDS`) consumed by `hasMemberAccess`, so courses, videos, patterns, tools, and server-side member access checks all recognize it.
- It is a free plan with no checkout price or Stripe association; it must never appear in `MEMBERSHIP_PRICE_IDS` and does not affect checkout pricing or billing.
- **Expiration is managed separately and is not enforced by the access gate.** The access gate only checks that an ACTIVE Memberstack connection to this plan id exists; when/how the plan expires is handled outside `hasMemberAccess`. See [Legacy annual expiration](#legacy-annual-expiration) for the process that removes this connection when a legacy annual member's paid-through date passes.

## Legacy annual expiration

Legacy annual members were migrated into Memberstack with the free legacy membership access plan (`pln_legacy-membership-t012x0xw0`) but have **no Stripe subscription**. Their paid-through date lives only in Watson (`legacy_members.subscriptionexpiring`). Because Memberstack plan connections are authoritative for access, an expired annual member would keep access indefinitely until the free plan connection is removed.

A scheduled reconciliation closes this gap:

- **Job:** `netlify/functions/legacy-annual-expiry.ts` (core logic in `src/lib/watson/legacyAnnualExpiry.ts`), scheduled daily at 09:00 UTC in `netlify.toml` (safely after midnight in America/Los_Angeles).
- **Scheduled live guard:** a scheduled run performs live Memberstack changes **only when `LEGACY_ANNUAL_EXPIRY_LIVE_ENABLED` is exactly `"true"`**. Any other value (unset, `false`, etc.) keeps scheduled runs in dry-run mode.
- **Paid-through source:** `legacy_members.subscriptionexpiring` is the authoritative date.
- **Calendar rule:** same as the membership status API — the paid-through day itself still has access; expiration occurs only when `subscriptionexpiring::date` is **strictly earlier** than today in America/Los_Angeles.
- **Action:** for each expired member, look up the Memberstack member by exact email and remove **only** the `pln_legacy-membership-t012x0xw0` connection via the Admin API (`POST /members/:id/remove-plan`).
- **Renewal safety:** members who hold any other active paid membership plan are skipped and keep access. Members whose legacy plan is already absent are skipped (idempotent, so repeated runs are safe).
- **Robustness:** members with a blank email, a duplicate legacy email, or no unique Memberstack match are skipped and reported; per-member failures never abort the batch.
- **`hasMemberAccess` is never changed.** This process only removes plan connections; Memberstack connections remain the single source of truth for access.

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

- **Memberstack is authoritative for live membership.** Current paid status, canceling-but-still-active access, and plan connections are read from the Memberstack Admin API at request time.
- **Watson legacy records provide historical context only** (prior memberships and expiration dates from the imported Postgres snapshot).
- **Legacy expiration dates do not automatically grant current site access.** Access gating continues to use Memberstack plan connections only.
- On `/membership`, **logged-out visitors see the normal sales page only** (no status panel, loading/wait overlays, or authenticated status endpoint). Personalized membership-status UI runs only after Memberstack confirms login. Knit it Now does not create Memberstack accounts merely to collect an email — prospects choose monthly/annual and create/receive their account in the purchase flow.
- For logged-in visitors, client Memberstack is authoritative for current paid status. A successfully loaded member with **no paid plan** is purchase-eligible (not a lookup failure). Server legacy context is consulted only when the client has no paid plan.
- A uniquely linked legacy expiration that is **today or in the future** (America/Los_Angeles calendar day) sets `recommendedAction: contact_support` and suppresses purchase CTAs — so customers are not nudged to pay twice — without granting Memberstack access from that date. Past legacy expirations and **no legacy record** (`not_found`) recommend purchase. A failed legacy Watson lookup (`lookup_unavailable`) waits — it is not treated as “no record.”
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

- Dynamic Patterns (catalog, builders, saved/generated patterns, print) require **active Knit it Now membership** only — canonical `hasMemberAccess` / `MEMBER_PLAN_IDS` (paid membership and legacy member shells). Retired KIN Beta Access does not grant access.
- A Memberstack account alone (login, DesignaKnit, course, prior/canceled membership) does **not** grant Dynamic Pattern access.
- Lifetime Pattern Builder plan connections, Memberstack JSON unlock flags (`sleevelessPatternSystemUnlocked`), free-claim JSON, and localhost/dev bypass do **not** grant Dynamic Pattern access.
- There is no free-account or one-free-pattern path for Dynamic Patterns.
- The public Patterns landing page (`/patterns/about`) remains public for marketing; the catalog and builders are membership-gated.

## Lifetime Pattern Builder purchases

- Lifetime products may still exist in Memberstack/checkout configuration for historical records.
- Lifetime ownership alone does **not** unlock Dynamic Patterns; active membership is required.
- Active members have access to all Pattern Builders.
