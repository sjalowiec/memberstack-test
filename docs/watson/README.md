# Watson ù Legacy Support Admin

Watson is a read-only legacy support admin for Knit It Now. It is **not** a replacement for the ColdFusion admin.

When the legacy ColdFusion site is retired, customer support still needs access to historical business data: memberships, orders, courses, saved patterns, PDF purchases, and private admin notes. Watson preserves that history in a modern, purpose-built tool so support workflows can continue without the legacy application.

## Design goals

- **Read-only legacy data** ù Imported ColdFusion data is never edited in Watson. It is a historical archive for lookup and context.
- **New support notes stored in Postgres** ù Support staff can add and edit notes in Watson; those notes live in Postgres, separate from legacy imports.
- **Fast member search** ù The primary entry point is quick member lookup (by name, email, member ID, or other identifiers as the data model allows).
- **Designed for customer support workflows** ù Layout and navigation follow how support actually works: find a member, review their history, add context for the next agent.
- **Modern Astro application** ù Built with the same stack as the rest of knititnow-staging (Astro, Netlify deployment patterns).
- **No Bootstrap styling** ù Custom, lightweight CSS aligned with a simple admin aesthetic; no Bootstrap dependency.
- **Simple, clean UI** ù Functional first: clear tables, readable typography, minimal chrome. Polish comes from clarity, not decoration.

## Related documentation

| Document | Purpose |
|---|---|
| [architecture.md](./architecture.md) | Data flow, Postgres roles, read-only vs editable boundaries |
| [data-model.md](./data-model.md) | Approved export tables and business rules |
| [ui-plan.md](./ui-plan.md) | First-version interface and workflows |
| [import-plan.md](./import-plan.md) | CSV export and Postgres import process |
| [importer.md](./importer.md) | Importer CLI, env vars, validation, reruns |
| [todo.md](./todo.md) | Phased implementation checklist |

## Out of scope (for now)

- Replacing ColdFusion admin features (content editing, catalog management, live billing).
- Writing back to legacy SQL Server.
- End-user (member-facing) functionality.
