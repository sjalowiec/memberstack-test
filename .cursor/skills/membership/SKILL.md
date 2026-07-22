---
name: membership
description: Maintain the Knit it Now Membership landing page at /membership. Use when editing membership page copy, layout, or CTAs. Membership is broader than patterns—it covers the full site (tools, troubleshooting, help hubs, guidance).
---

# Knit it Now Membership Page

## Purpose

Membership landing page linked from membership prompts across the site (patterns, gated content, help hubs, and similar). Explain what membership includes and present one paid membership with monthly or annual billing.

**Scope:** Membership represents the larger Knit it Now site—not patterns alone. Include pattern systems as one part of a broader offering: project tools, calculators, troubleshooting, help hubs, technique guidance, planning support, and ongoing resources for machine knitters.

## Apply To

- `src/pages/membership.astro`
- `src/components/membership/MembershipPricing.astro`
- `src/components/membership/MembershipStatusPanel.astro`
- `src/pages/join.astro`
- `GET /.netlify/functions/membership-status` (logged-in status summary)

## Tone

Friendly, clear, reassuring, and practical. For machine knitters. Not corporate or overly salesy.

## Product model

- One paid membership: **Knit it Now Membership**
- Billing: monthly or annual
- Do not describe Basic vs Premium tiers
- Do not promise Memberstack or ActiveCampaign by name on the public page

## Layout and Styling

- Keep existing page layout and styling as much as possible.
- Keep existing colors and button styling (`kbm-btn kbm-btn-accent`).
- Preserve current responsive behavior (global `.page-wrap`).
- Use `.membership-page-wrap.page-wrap { padding-top: 8px; }` / sales-page top spacing so spacing is not doubled with Layout header clearance.

## Do Not

- Reintroduce Basic vs Premium comparison language.
- Invent new marketing claims beyond existing membership benefits.
- Promise exact launch dates for unreleased builders.
- Frame membership as patterns-only; balance pattern systems with tools, troubleshooting, help hubs, and guidance.

## CTA

- Hero primary CTA (`data-membership-sales-cta`): `Choose a membership` → `#pricing` for prospects/free (no paid plan) accounts; active paid members see `Manage Membership` → `/account#membership`
- Plan checkout labels (monthly/annual): `Become a Member` → Memberstack signup/login then Stripe checkout (account is created as part of purchase — do not require a Memberstack account merely to collect email)
- Paid members see `Current Plan` on plan buttons; manage billing via account or portal
- **Logged-out sales page must stay untouched:** no status panel, loading/wait/contact/manage overlays, membership modal, or authenticated `membership-status` endpoint call. Detect login from the Memberstack client first; only then run personalized status UI.
- Logged-in status panel: client Memberstack is authoritative for current paid status; server legacy context is consulted only when the client has no paid plan. A successfully loaded member with no paid plan is purchase-eligible (not a lookup failure). No legacy record (`not_found`) is also purchase-eligible. Genuine authenticated client/server/legacy lookup failures use wait/contact — never invent purchase when status cannot be confirmed safely. Future legacy paid-through and ambiguous legacy remain contact-support and suppress purchase.
- Ambiguous or unavailable status (authenticated only): suppress purchase CTAs and point to contact support / retry — never default endpoint failure to “please buy”
- Do not auto-open the membership details modal for non-members; once-per-session modal is only for active/canceling paid members
- Fact rows render only when they have real values (never blank Plan/Status/Billing/Renews/Active through/Previous membership labels)
