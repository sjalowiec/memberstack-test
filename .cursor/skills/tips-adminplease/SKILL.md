---
name: tips-adminplease
description: Make Help Hub tips admin actions sticky and place the Refresh JSON Preview button in the preview header. Use when editing tips admin UI layout or when the user asks to keep Save/Cancel/Delete visible while scrolling.
---

# Tips Admin Please

## Purpose
Apply a consistent UI tweak to Help Hub tip admin pages:
- Keep `Save`, `Cancel edit`, and `Delete` visible via sticky actions.
- Keep `Refresh JSON preview` in the preview section header, next to the preview title.

## Apply To
- `src/pages/admin/tips-admin.astro`
- `src/pages/admin/tips-edit.astro` (if this page is in use for tip editing)

## Required Outcome
1. **Sticky actions row**
   - `Save`, `Cancel edit`, and `Delete` remain in the main form actions row.
   - Actions row uses sticky positioning near the bottom of the viewport.

2. **Preview refresh placement**
   - `Refresh JSON preview` is **not** in the sticky actions row.
   - It appears in the preview header area with the "Current record (preview)" title.

3. **No behavior regressions**
   - Existing button IDs and click handlers continue working.
   - No data model or API changes.

## Implementation Notes
- Reuse existing classes when possible:
  - Sticky actions: `help-hub-admin__form-actions--sticky`
  - Preview header wrapper: `help-hub-admin__preview-head`
- Keep styling minimal and consistent with existing admin UI.
- Do not refactor unrelated layout or fields.

## Verification
- Scroll long tip form: Save/Cancel/Delete remain visible.
- Refresh JSON preview button appears with preview title and still refreshes preview JSON.
- No console errors from missing button IDs.
