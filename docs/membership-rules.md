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
- On `/membership`, a uniquely linked legacy expiration that is **today or in the future** (America/Los_Angeles calendar day) sets `recommendedAction: contact_support` and suppresses purchase CTAs — so customers are not nudged to pay twice — without granting Memberstack access from that date. Past legacy expirations may recommend purchase with “ended on” wording.
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

## Lifetime Pattern Builder purchases

- Lifetime purchases are independent of membership.
- Active members have access to all Pattern Builders.
- Lifetime owners retain full access to the specific builder purchased.
- Canceling membership does not remove lifetime builder ownership.
