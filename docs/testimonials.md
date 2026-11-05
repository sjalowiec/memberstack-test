# Testimonials

Recorded 5 November 2026. The public page title is “What Knitters Say.” Admin labels stay “Testimonials.”

Local verification uses `TESTIMONIALS_DATABASE_URL` on an isolated loopback database. A plain `--apply` still refuses every other host, including the configured Watson URL. Do not set `TESTIMONIALS_DATABASE_URL` on Netlify.

The configured Watson database is selected only with both `--apply` and `--target configured-watson`. That import uses `WATSON_DATABASE_URL` (or `WATSON_DATABASE_ADMIN_URL` when set). New rows stay inactive. A repeat import refreshes historical fields, keeps activation choices and display edits, and skips legacy rating ids an admin has deleted.

## Admin control

An admin page must let staff:

- Read an individual testimonial
- Activate that testimonial
- Inactivate that testimonial
- Delete that testimonial after a confirmation that shows the attribution and a short quote preview

Deleting a legacy review keeps only its legacy rating id. The next import does not recreate that review. Deleting a member submission or an email entry removes that row and stores no marker.

## Initial state

Imported testimonials start inactive. The legacy `dbo.Reviews.Show` flag does not activate them. `Show = 1` only records that the old site had published the row.

## Public display

A testimonial may appear on a public page only after it has been activated in this admin. Inactivating it removes it from public pages.

## Investigation records

The legacy export and member-ID check remain in `legacy-data/private/reviews/`. That folder is gitignored. Those files are the investigation record, not an import.
