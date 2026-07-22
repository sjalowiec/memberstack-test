# Membership Rules

updated 2026-07-22

## Membership plans

- Knit it Now Membership Monthly: $19.99
- Knit it Now Membership Annual: $228.00

There is one paid membership. Beta access remains a separate free plan for invited beta members.

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

- Dynamic Patterns (catalog, builders, saved/generated patterns, print) require **active Knit it Now membership** only — canonical `hasMemberAccess` / `MEMBER_PLAN_IDS` (paid membership, Beta, and legacy member shells).
- A Memberstack account alone (login, DesignaKnit, course, prior/canceled membership) does **not** grant Dynamic Pattern access.
- Lifetime Pattern Builder plan connections, Memberstack JSON unlock flags (`sleevelessPatternSystemUnlocked`), free-claim JSON, and localhost/dev bypass do **not** grant Dynamic Pattern access.
- There is no free-account or one-free-pattern path for Dynamic Patterns.
- The public Patterns landing page (`/patterns/about`) remains public for marketing; the catalog and builders are membership-gated.

## Lifetime Pattern Builder purchases

- Lifetime products may still exist in Memberstack/checkout configuration for historical records.
- Lifetime ownership alone does **not** unlock Dynamic Patterns; active membership is required.
- Active members have access to all Pattern Builders.
