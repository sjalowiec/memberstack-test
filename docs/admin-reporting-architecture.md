# Admin Reporting Architecture — Recommendation

Status: partially implemented. Written after auditing the current data layer, Stripe/Memberstack integration, and `/admin` pages in this repo (knititnow-staging). See "Implementation log" and "Information architecture plan" below for current state.

## What's actually here today

**No traditional database.** There's no Postgres/MySQL/Mongo anywhere in this repo. Persistent runtime data lives in **Netlify Blobs** (`@netlify/blobs`), used as a set of independent key-value stores, one per feature:

- `custom-pattern-projects` — saved patterns, one JSON blob per project plus a hand-maintained `index.json` summary per user (`netlify/functions/lib/custom-pattern-projects-store.js`)
- `pattern-activity-log` — append-only events, one blob per event under `events/{date}/{id}.json` (`netlify/functions/lib/pattern-activity-store.js`)
- `bookshelf-activity-log` — same append-only shape, separate store (`netlify/functions/admin-bookshelf-activity.ts`)

Static catalog content (machines, glossary, bookshelf, videos) is separately stored as JSON files in `src/data/` and edited through admin pages — that's a content-management path, not the reporting path, and is out of scope here.

**No direct Stripe integration.** There is no Stripe SDK dependency, no Stripe webhook handler, and no `sk_live`/Stripe API calls anywhere in the code. Billing is entirely delegated to Memberstack's built-in Stripe wrapper: the client calls `$memberstackDom.purchasePlansWithCheckout()` and `launchStripeCustomerPortal()` (see `src/scripts/joinCheckout.ts`), and plan/price IDs are configured once in `src/config/memberships.ts`. Memberstack owns the Stripe relationship; this app never sees raw Stripe objects.

**Memberstack integration** has two halves:
- Client: `$memberstackDom` (loaded via a hardcoded app id in `BaseLayout.astro`) for auth, plan checkout, and billing portal.
- Server: a small Admin REST client (`netlify/functions/lib/memberstack-admin.js`) using `MEMBERSTACK_SECRET_KEY` for admin-only member lookups and JSON-metadata updates. One webhook, `memberstack-created.ts`, fires on signup and syncs the new member to ActiveCampaign — it doesn't persist anything locally.
- Identity in Netlify Functions is trusted from client-sent `X-KBM-Member-Id` / `X-KBM-Member-Email` headers. There is **no server-side JWT verification** yet — it's flagged as a TODO directly in the code (`custom-pattern-projects-store.js`).

**Admin pages** (`src/pages/admin/*.astro`) are not gated at the routing/middleware level at all — `middleware.ts` has no admin check. Access relies on the path being unlisted plus each data-fetching Netlify Function independently calling `isActivityAdmin(req)`, which checks the member id/email against an env-var allowlist (`PATTERN_ACTIVITY_ADMIN_MEMBER_IDS` / `_EMAILS`), with a permanent bypass in local dev. The page shell itself renders for anyone; only the data fetch 403s.

The dashboard at `/admin/index.astro` already has a "Reporting" section (Bookshelf Activity, Bookshelf Suggestions) plus an inline Pattern Activity panel. Its own comment says: *"No site-wide admin-role helper exists in this codebase... reporting is restricted here via an explicit allowlist."*

## The duplication problem

The two reporting features that exist (pattern activity, bookshelf activity) are built as fully parallel, independently-written stacks:

| Layer | Pattern activity | Bookshelf activity |
|---|---|---|
| Client tracker | `src/lib/patterns/patternActivityLog.ts` | `src/lib/bookshelfTracking.ts` |
| Append endpoint | `pattern-activity-log.js` (POST) | `log-bookshelf-activity.ts` (POST) |
| Report endpoint | `pattern-activity-log.js` (GET) | `admin-bookshelf-activity.ts` (GET) |
| Aggregation | hand-written counters in `patternActivityLog.ts` | hand-written `summarize()` in `admin-bookshelf-activity.ts` |
| Admin page | inline section in `admin/index.astro` | `admin/bookshelf-activity.astro` |

Each one reimplements: event validation, the blob key/date-bucket scheme, the "scan blobs → tally by event type → build top-N + recent list" aggregation, and a hand-rolled stats-card + table UI with its own copy-pasted CSS block. The only thing already shared is `isActivityAdmin()`. Every new report (course engagement, tool usage, checkout funnel, membership/revenue) would mean copying this whole stack again — which is the exact scaling problem flagged in the request.

There's also a real ceiling here: both report endpoints re-scan every blob in the window on every request (capped at `MAX_EVENTS_SCANNED = 5000`). That's fine at current volume but will silently truncate or slow down as events grow — there's no incremental rollup for events, even though the codebase already proved that pattern elsewhere (the `custom-pattern-projects` summary-index, which *is* incrementally maintained rather than rescanned).

## Recommended architecture

Keep the current stack (Astro + Netlify Functions + Netlify Blobs) — there's no case for introducing a real database yet at this data volume, and doing so would be a bigger lift than the reporting problem requires. Instead, generalize the pattern that already works twice into a shared module set, so a third/fourth/fifth report is configuration, not new code.

**1. One shared event-log library**, e.g. `netlify/functions/lib/reporting/eventLog.js`:
- `appendEvent(storeName, event)` — same date-bucket key scheme (`events/{YYYY-MM-DD}/{id}.json`) used today, generalized to take any store name and a generic envelope (`id`, `eventType`, `createdAt`, `userId`/`visitorId`, `metadata`).
- `listEvents(storeName, { sinceDays })` — same bounded/prefix-scan logic used today, generalized.
- Every future tracked feature (course engagement, tool usage, downloads, checkout starts) calls this instead of writing its own store module. Migrate `pattern-activity-store.js` and the bookshelf store onto it — proves it works before adding new domains.

**2. One declarative summarizer**, replacing the hand-written `summarize()` functions:
- Config per domain: which `eventType`s map to which named counters, which fields to tally into "top N" tables (e.g. `bookId`+`bookTitle`), which fields to surface in a recent-events table.
- One generic function walks the event list once and produces `{ counters, topLists, recentEvents }` from that config. New report = a config object, not a new aggregation function.

**3. One shared report endpoint** instead of one Netlify Function per domain — e.g. `netlify/functions/admin-report.ts` taking `?domain=bookshelf&days=30`, looking up the domain's config (store name + summarizer config), and reusing `isActivityAdmin()` exactly as today. New domains add a config entry, not a new `.ts` file.

**4. One shared admin report page/component** instead of copy-pasted Astro pages — a generic stats-cards + top-tables + recent-table renderer driven by the same domain config (labels, which counters to show as cards). `/admin/reports/[domain].astro` (or a reusable Astro component included from small per-domain pages) replaces the current copy-pasted CSS+DOM code. Keep the existing `/admin/index.astro` dashboard as the entry point/index of report cards — that part is already working well and doesn't need to change.

**5. Harden the admin gate now, before revenue data is exposed:**
- Verify the Memberstack JWT server-side instead of trusting client-sent `X-KBM-Member-Id`/`Email` headers — this is already a known TODO, and it matters more once reports include billing/plan data, not just anonymous usage counts.
- Add an actual `/admin/*` check in `middleware.ts` (redirect non-admins) so the page shell itself is gated, not just the data fetch. Right now anyone can load the page and see the UI chrome even if the API 403s.
- Keep `isActivityAdmin()` (or its generalized successor) as the single source of truth for "who can see reports" — it's already shared across two features; just don't let a third feature reinvent it.

**6. Revenue/membership reporting needs a different source, by design.** Since Stripe lives entirely inside Memberstack, there is no local Stripe data to query — blobs can't answer "what's our MRR." Two realistic paths, not mutually exclusive:
- **Snapshot approach:** call Memberstack's Admin REST `listMembers` (already scaffolded in `memberstack-admin.js`, currently only used for debug) at report time to compute plan mix / active member counts live. Simple, no new infrastructure, but it's a point-in-time snapshot — no historical trend, and it's rate-limited/paginated so it doesn't scale to "load this every time the dashboard renders."
- **Event-sourced approach:** check whether Memberstack's dashboard can emit webhooks for plan/subscription changes (it already emits the `member.created` webhook this repo listens to). If so, land those events into a `membership-events` store through the *same* shared event-log module from (1) — giving you real historical MRR/churn trend using the identical architecture as usage reporting, instead of a bespoke revenue-specific system.

Start with the snapshot approach for a first membership report (fast, no new webhooks to configure), and move to event-sourced once you need trends rather than a current-state count.

## Suggested build order

1. Extract the shared event-log + summarizer modules; refactor the two existing reports (pattern activity, bookshelf activity) onto them. This is a refactor with no new user-facing behavior — it's the proof that the abstraction fits before anything new is built on it.
2. Harden admin gating (JWT verification + middleware-level `/admin` check).
3. Add the Memberstack snapshot-based membership/plan report using the same page pattern.
4. Add any new usage-tracked domain (course engagement, tool usage, etc.) purely as config against the now-shared pipeline.
5. Only if event volume becomes a real problem: add incremental rollup counters (mirroring the summary-index pattern `custom-pattern-projects-store.js` already uses) instead of full-window rescans.

## Implementation log

**2026-07-11 — first slice shipped.** Server-side admin auth hardening (real Memberstack JWT verification via `netlify/functions/lib/admin-auth.js`, replacing trust in client-sent headers) and the membership snapshot report (`netlify/functions/admin-membership-report.ts`, page at `/admin/reports/membership`), plus the shared report UI scaffold (`src/components/admin/AdminReportPage.astro`, `AdminReportTable.astro`, `src/styles/admin-report.css`, `src/lib/admin/reportRenderer.ts`). Two open items from that session: (1) Memberstack's paid `planConnections[].payment` shape is undocumented — the MRR calc excludes anything it can't confidently match rather than guessing (see code comment in `admin-membership-report.ts`); (2) automated verification (`astro check` / `vitest`) could not be run from the build session's sandbox due to a shell/file-sync quirk — run it locally before deploying.

Step 1 of the build order above (refactoring the two legacy reports onto shared modules) has **not** been done yet — deferred in favor of building the membership report on fresh shared modules first. The legacy `pattern-activity-log` and `bookshelf-activity-log` stacks are still their own independent, duplicated code.

## Information architecture plan (2026-07-11)

Sue's preferred structure for the whole admin area is three top-level sections, replacing the current ad hoc grouping on `/admin/index.astro` (Content Admin / Private Project Workspaces / Reporting / Legacy Admin / Utilities):

- **Business Membership** — active members, members by plan, monthly vs. annual, new memberships, cancellations, churn/retention, member lookup, membership history.
- **Business Financial** — MRR, revenue by month, Stripe payments, failed payments, refunds, course/product revenue, taxes/payout summaries, reconciliation reports.
- **Data Admin** — JSON editing, pattern access reset, data repair utilities, imports/exports, activity reports, content manifests, support tools.

Note: the MRR card currently lives inside the membership report (built before this structure was decided). Under this IA it belongs in Business Financial, not Business Membership — needs to be split out when the nav is rebuilt.

### Inventory: what exists vs. what needs building

**Business Membership**
| Item | Status |
|---|---|
| Active members | Built — `admin-membership-report.ts` |
| Members by plan | Built — same endpoint, `activeByPlan` |
| Monthly vs. annual | Not built — endpoint resolves price id but doesn't currently surface interval as its own breakdown |
| New memberships | Built — today/7d/month/year |
| Cancellations | Partial — a total count exists (`canceledConnectionsTotal`); no time-bucketing (this week/month) |
| Churn and retention | Not built — a true churn *rate* needs historical tracking over time, not just a live snapshot; likely needs the event-sourced approach (webhooks into an event log) rather than the snapshot API alone |
| Member lookup | Partial — `admin-sleeveless-access-reset.js` already does an email-based Memberstack lookup (built for a different purpose: resetting a free-pattern claim); could be generalized into a real member-lookup tool |
| Membership history | Not built — needs a per-member timeline of plan changes; Memberstack's snapshot API doesn't expose this, so likely needs webhook-driven event capture going forward (no way to backfill history that predates tracking) |

**Business Financial**
| Item | Status |
|---|---|
| MRR | Built (as part of the membership report — needs to move) |
| Revenue by month | Not built — needs either historical Stripe data or an event log going forward; a live snapshot alone can't show past months |
| Stripe payments | Not built — **needs direct Stripe API access**, which nothing in this codebase currently has (Memberstack owns the Stripe relationship; its Admin API doesn't expose charge/payment-level detail, only plan connections) |
| Failed payments | Not built — same Stripe access gap |
| Refunds | Not built — same Stripe access gap |
| Course or product revenue | Not built — **needs investigation, not just Stripe access**: it's not yet confirmed whether one-time purchases (courses, ebooks, patterns) go through the same Memberstack/Stripe checkout as memberships, or a separate mechanism. The `src/pages/shop/*` pages (books, ebooks, cables) haven't been audited for how they actually process payment. |
| Taxes / payout summaries | Not built — needs Stripe's Payouts/Tax reporting API, advanced case |
| Reconciliation reports | Not built — needs Stripe access, plus cross-referencing against Memberstack plan data |

Open decision (Sue's to make): whether to provide a Stripe secret key (recommended: restricted-permissions, read-only on payments/charges/refunds) so these can be built against real data, using the `stripeCustomerId` field already present on each Memberstack member record as the bridge between the two systems. Nothing in Business Financial beyond MRR/plan-mix can be built without this.

**Data Admin**
| Item | Status |
|---|---|
| JSON editing | Built — Help Hub admin, Lessons admin, Bookshelf editor, Machine database admin all already edit JSON content files |
| Pattern access reset | Built — Sleeveless free-claim reset tool (`admin-sleeveless-access-reset.js` + UI section in `admin/index.astro`) |
| Data repair utilities | Partial — several one-off scripts exist (`scripts/*.mjs`, `*.cjs`: glossary repair, jump-link fixes, etc.) but run from the command line, not surfaced as admin UI tools |
| Imports and exports | Partial — `scripts/import-bookshelf.cjs`, `scripts/import-book-comments.cjs` exist as CLI scripts, not admin-UI-integrated |
| Activity reports | Built — pattern activity (inline on `admin/index.astro`) and bookshelf activity (`admin/bookshelf-activity.astro`); these are the two legacy duplicated report stacks from the original architecture doc, still not refactored onto shared modules |
| Content manifests | Partial — `scripts/generate-public-manifests.mjs` runs at build time (`prebuild`), not an interactive admin tool |
| Support tools | Partial — Video Access Manager, Legacy eBook Lookup, and the pattern access reset tool above all fit here; not consolidated under one heading yet |

### Suggested rollout approach (not yet started)

1. Rebuild `/admin/index.astro`'s navigation around the three sections, slotting in everything already built above. Keep existing page URLs stable (don't move files yet) — this is a navigation/grouping change first, physical reorganization later if wanted, to avoid unnecessary churn/breakage.
2. Split the MRR card out of the membership report into wherever Business Financial's first real page ends up living.
3. Resolve the Stripe access question above — it blocks most of Business Financial.
4. Fill in Business Membership's remaining gaps (monthly/annual breakdown is cheap — data's already fetched; churn/retention and membership history are the expensive ones needing webhook-driven history).
5. Data Admin is mostly consolidation of already-built tools plus surfacing the CLI-only scripts as real admin-UI tools where worth the effort — lower urgency than the other two sections since the operational capability already exists, just not in one place.
