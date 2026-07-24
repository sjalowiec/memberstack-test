# Watson ? Legacy Support Admin

Watson is a read-only legacy support admin for Knit It Now. It is **not** a replacement for the ColdFusion admin.

When the legacy ColdFusion site is retired, customer support still needs access to historical business data: memberships, orders, courses, saved patterns, PDF purchases, and private admin notes. Watson preserves that history in a modern, purpose-built tool so support workflows can continue without the legacy application.

## Design goals

- **Read-only legacy data** ? Imported ColdFusion data is never edited in Watson. It is a historical archive for lookup and context.
- **New support notes stored in Postgres** ? Support staff can add and edit notes in Watson; those notes live in Postgres, separate from legacy imports.
- **Fast member search** ? The primary entry point is quick member lookup (by name, email, member ID, or other identifiers as the data model allows).
- **Designed for customer support workflows** ? Layout and navigation follow how support actually works: find a member, review their history, add context for the next agent.
- **Modern Astro application** ? Built with the same stack as the rest of knititnow-staging (Astro, Netlify deployment patterns).
- **No Bootstrap styling** ? Custom, lightweight CSS aligned with a simple admin aesthetic; no Bootstrap dependency.
- **Simple, clean UI** ? Functional first: clear tables, readable typography, minimal chrome. Polish comes from clarity, not decoration.

## Related documentation

| Document | Purpose |
|---|---|
| [architecture.md](./architecture.md) | Data flow, Postgres roles, read-only vs editable boundaries |
| [data-model.md](./data-model.md) | Approved export tables and business rules |
| [membership-reports.md](./membership-reports.md) | Current Legacy Members and Remaining Annual Access report rules |
| [ui-plan.md](./ui-plan.md) | First-version interface and workflows |
| [import-plan.md](./import-plan.md) | CSV export and Postgres import process |
| [importer.md](./importer.md) | Importer CLI, env vars, validation, reruns |
| [store-fulfillment.md](./store-fulfillment.md) | Machine/drop-ship shipping-cost records and apply SQL |
| [shopify-sales.md](./shopify-sales.md) | Live Shopify order sync, Recent Sales UI, DesignaKnit licenses |
| [todo.md](./todo.md) | Phased implementation checklist |

## Local Memberstack sandbox vs live secrets

On localhost and other non-production hosts, the browser Memberstack script
(`data-memberstack-app` in `BaseLayout.astro`) runs in **TEST/sandbox** mode.
Sandbox member ids look like `mem_sb_?`.

Server Admin lookups must use the matching sandbox secret:

| Variable | Purpose |
|---|---|
| `MEMBERSTACK_SANDBOX_SECRET_KEY` | Sandbox/test Admin secret (required for local `/membership` status) |
| `MEMBERSTACK_SECRET_KEY` | Live Admin secret (production; local fallback only) |

```powershell
$env:MEMBERSTACK_SANDBOX_SECRET_KEY="sk_sb_?"   # from Memberstack dashboard ? Test Mode ? Secrets
$env:MEMBERSTACK_TLS_INSECURE="1"               # only if local TLS inspection blocks Admin
npm run dev
```

Production (`NODE_ENV=production` or Netlify `CONTEXT=production`) uses **only**
`MEMBERSTACK_SECRET_KEY` and never falls back to the sandbox secret.

## Local Memberstack Admin TLS (Windows / SSL inspection)

Watson customer profiles load **live** membership from the Memberstack Admin API (`https://admin.memberstack.com`) in Node/Astro SSR. On some local Windows networks, Node fails with:

`UNABLE_TO_VERIFY_LEAF_SIGNATURE`

When that happens, Watson shows **Memberstack lookup unavailable** and does not display live plan connections. The public `/membership` page may still look correct because it uses the Memberstack DOM SDK in the browser ? that does **not** prove Watson's server-side Admin lookup is working.

### Opt-in local workaround (PowerShell)

In the same PowerShell session where you start the site:

```powershell
$env:MEMBERSTACK_TLS_INSECURE="1"
npm run dev
```

Remove it from the current session when finished:

```powershell
Remove-Item Env:MEMBERSTACK_TLS_INSECURE
```

Rules:

- This is **only** for the known local certificate-chain / SSL-inspection problem.
- It must **not** be configured in production (Netlify production ignores `MEMBERSTACK_TLS_INSECURE`).
- Do **not** commit `MEMBERSTACK_TLS_INSECURE=1` to a shared or production env file.
- Secure TLS remains the default everywhere. The opt-in applies only to the Memberstack Admin client (not browser security, not a process-wide `NODE_TLS_REJECT_UNAUTHORIZED=0`).

## Public membership status (narrow exception)

Watson staff UI remains support-only. A narrow member-facing endpoint reuses Watson's merged customer helpers for `/membership`:

- `GET /.netlify/functions/membership-status` (Bearer Memberstack JWT via `requireMember`)
- Live plan status from Memberstack Admin API; legacy history from Watson Postgres (unique email link only)
- Restricted customer-facing fields only - no notes, orders, addresses, or staff labels
- See [membership-reports.md](./membership-reports.md) and `docs/membership-rules.md`

## Out of scope (for now)

- Replacing ColdFusion admin features (content editing, catalog management, live billing).
- Writing back to legacy SQL Server.
- Broad end-user (member-facing) Watson functionality beyond the restricted membership-status summary above.
