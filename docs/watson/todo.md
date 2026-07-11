# Watson ù Implementation Checklist

Phased roadmap for Watson. **Do not skip Phase 1** ù import and data model correctness underpin everything else.

Status key: `[ ]` not started ù `[~]` in progress ù `[x]` done

---

## Phase 1 ù Documentation, data model, import process

Foundation only; no member-facing UI required to complete Phase 1.

### Documentation

- [x] README ù purpose and design goals
- [x] architecture.md ù system boundaries and data flow
- [x] data-model.md ù approved tables and business rules
- [x] ui-plan.md ù v1 workflows and design principles
- [x] import-plan.md ù CSV export and Postgres import process
- [x] todo.md ù this checklist

### Data model

- [x] Confirm SQL Server column lists for all eight approved tables
- [x] Design Postgres schema (legacy snapshot tables + import metadata)
- [ ] Design Postgres schema for Watson support notes (editable)
- [x] Document join keys and indexes for member search
- [x] Document handling of `BirthDayInfo`, `Members.Notes`, addresses, subscription fields per business rules

### Import process

- [ ] Define CSV export scripts or ColdFusion/SQL job for each approved table
- [x] Implement import CLI (batch ID, validation, row counts)
- [ ] Run first import into staging Postgres with sanitized or full export
- [x] Document ops runbook (schedule, failure recovery, who runs exports) ó see [importer.md](./importer.md)
- [ ] Add import batch timestamp visible to developers (UI banner optional in Phase 2)

**Phase 1 exit criteria:** Staging Postgres loaded from real CSV structure; support notes schema migrated; import repeatable with validation report.

---

## Phase 2 ù Member search, member detail, read-only data display

Astro application shell; **read-only** legacy data only.

### Application setup

- [ ] Create Watson Astro app or route namespace (decision: separate app vs `/watson` in monorepo)
- [ ] Postgres connection and read-only query layer for legacy tables
- [ ] Admin authentication (align with existing admin gating)
- [ ] Custom CSS foundation (no Bootstrap)

### Member search

- [ ] Search page as primary entry
- [ ] Search by email, member ID, name (partial match)
- [ ] Results table with disambiguation columns
- [ ] Performance: indexed queries; target fast response for support

### Member detail page

- [ ] Overview section (profile, addresses, legacy `Members.Notes`, subscription summary with caveats)
- [ ] Orders ù Store_Transactions + items, sortable columns, newest first
- [ ] Courses ù HomeStudy_Course_member_library
- [ ] Saved Patterns ù Member_pattern_details + Pattern_Library
- [ ] Legacy PDF Purchases ù Pattern_Library_purchases
- [ ] Shared sortable table behavior (click every column header)
- [ ] Empty and error states

**Phase 2 exit criteria:** Support can find a member and review all read-only legacy sections in staging; no editable notes yet.

---

## Phase 3 ù Support notes, timeline, polish

Editable Watson-native data and UX refinement.

### Support notes

- [ ] CRUD API for support notes (Postgres only)
- [ ] Support Notes section on member detail
- [ ] Visual distinction: legacy `Members.Notes` vs Watson notes
- [ ] Audit fields (author, created_at, updated_at)
- [ ] Newest-first default list

### Timeline (optional enhancement)

- [ ] Unified chronological view: legacy events + support notes
- [ ] Read-only legacy events vs editable note entries clearly marked

### Polish

- [ ] Import batch ùas ofù indicator in UI
- [ ] Loading states, keyboard-accessible sort headers
- [ ] Staging UAT with support staff
- [ ] Production Postgres + final import runbook
- [ ] Deploy Watson to production

**Phase 3 exit criteria:** Support can search, review legacy history, and maintain Watson notes; ready for ColdFusion cutover dependency.

---

## Explicitly deferred (post-v1)

- Direct SQL Server connectivity
- Editing legacy imported rows
- Replacing ColdFusion admin non-support features
- Financial reporting / MRR (main site admin scope)
- Bootstrap or component library adoption

---

## References

- [README.md](./README.md)
- [architecture.md](./architecture.md)
- [data-model.md](./data-model.md)
- [ui-plan.md](./ui-plan.md)
- [import-plan.md](./import-plan.md)
