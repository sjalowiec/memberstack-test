# Watson — UI Plan (v1)

The first version of Watson is a **functional, modern support admin**: find a member quickly, review read-only legacy history, add or edit support notes. No Bootstrap. Simple, clean layout with sortable tables.

## Primary workflow

```
Search member
      ?
Overview
      ?
Orders
      ?
Courses
      ?
Saved Patterns
      ?
Legacy PDF Purchases
      ?
Support Notes
```

Each step after search is a **section or tab on the member detail view**, not a separate application. Support should land on search, open one member, and move through context without losing place.

## Global: Member search

**Entry point:** `/` or dedicated search route (exact path TBD in implementation).

- Single prominent search field (email, member ID, name—supporting partial match where practical).
- Results list: enough columns to disambiguate (name, email, member ID, city/state if available).
- Click a result ? member detail **Overview**.
- Default result ordering: relevance for search; list views elsewhere default **newest first** where dates apply.

## Member detail — Overview

Summary card(s) for the selected member:

- Identity: name, email, member ID
- Mailing address (preserved from legacy import)
- Legacy private admin notes (`Members.Notes`) — read-only, clearly labeled as legacy
- Subscription summary (historical; with UI caveat that `CurrentSubscriber` is unreliable)
- Birth day (month/day only — no misleading year)
- Quick counts or links: orders, courses, saved patterns, PDF purchases, support notes

Overview is the hub; other sections are reachable via sub-navigation (tabs or sidebar).

## Orders

Read-only table of **Store_Transactions** (and drill-down or nested **Store_Transactions_items**).

- Sortable columns via **click every column header**.
- Default sort: transaction date, **newest first**.
- Show transaction ID, date, totals, status fields as available in export.
- Line items: either expandable rows or linked sub-table per order.

## Courses

Read-only **HomeStudy_Course_member_library** for the member.

- Course name/ID, enrollment or access dates as exported.
- Sortable columns; default newest-first where a date column exists.

## Saved Patterns

Read-only **Member_pattern_details** (with **Pattern_Library** reference for titles/metadata where joined).

- Pattern name, save date, identifiers from export.
- Sortable; default newest-first on save/modify date if present.

## Legacy PDF Purchases

Read-only **Pattern_Library_purchases** (with pattern library metadata).

- Purchase date, pattern title, purchase identifiers.
- Sortable; default newest-first.

## Support Notes

**Editable** — the only section where support staff mutate data in v1.

- List existing Watson support notes (newest first).
- Add note, edit note (permissions TBD: all admins vs. author-only edits).
- Distinct styling from legacy `Members.Notes` on Overview (legacy = read-only archive; Watson notes = living log).
- Fields (minimum): body, author, created_at, updated_at.

Phase 3 may add a **timeline** merging legacy events and support notes; v1 can keep them in separate sections.

## Design principles

| Principle | Application |
|---|---|
| **Functional first** | Ship clear tables and search before visual refinement |
| **Modern appearance** | Clean typography, spacing, subtle borders/shadows—aligned with knititnow-staging admin direction, not legacy ColdFusion |
| **No Bootstrap** | Custom CSS; no Bootstrap CSS/JS/components |
| **Sortable tables** | Every column header click toggles sort (asc/desc); indicate active sort visually |
| **Read-only legacy data** | No inline edit, no delete, no “save” on imported tables |
| **Support notes editable** | Clear affordances: textarea, save/cancel, validation |
| **Newest-first defaults** | Orders, notes, purchases, enrollments where chronological |

## Layout sketch (conceptual)

```
??????????????????????????????????????????????????????????????
?  Watson                                    [user / logout] ?
??????????????????????????????????????????????????????????????
?  Search: [________________________] [Search]               ?
??????????????????????????????????????????????????????????????
?  Member: Jane Example (id 12345)                           ?
?  [Overview] [Orders] [Courses] [Patterns] [PDFs] [Notes]   ?
??????????????????????????????????????????????????????????????
?  (active section content — tables, cards, note editor)     ?
??????????????????????????????????????????????????????????????
```

## Non-goals for v1 UI

- Dashboards, charts, or MRR (see main site admin reporting).
- Editing legacy records.
- Bulk export or bulk actions.
- Mobile-first layout (desktop support workflow is primary; responsive enough to use on tablet is a nice-to-have).

## Accessibility and UX notes

- Table headers must be keyboard-focusable where sort is click-driven; consider Enter/Space to sort.
- Empty states: “No orders found for this member” with no dead ends.
- Loading and error states for search and member load.
- Distinguish “no results” from “import not run yet” for ops clarity.
