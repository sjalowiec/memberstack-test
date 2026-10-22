# Legacy course image sources

updated 2026-09-27

Use these known libraries before searching a drive. Course image URLs rewritten to `/challenge/images/v2/{courseId}/...` often still live in the older shared folders, not in a folder named for the course ID.

## Verified from Course 15

- The August 2026 FTP snapshot at `E:\!2022Knititnow\knitbymachine\BACKUP_KIN\September1\FTP_final_2026-08-25\FTP\challenge\images\v2` does not contain folder `15`.
- `E:\!2022Knititnow\knitbymachine\workspace\legacy-courses\courses\challenge\images\v2\15` contains only `sleeve.jpg` and `sleeve.webp`. Neither file is one of the 22 lesson images.
- The 22 lesson images came from `E:\!2022Knititnow\knitbymachine\workspace\legacy-courses\courses\challenge\images\`, in the `2hr`, `gauge_swatch_tension`, and `sleeve_practice` subfolders.
- The same 22 files also exist under `E:\!!!backups\2026_courses\images\`.
- They were copied, preserving subfolders and filenames, to `public/images/course-content/15/`. Course 15 JSON paths have not yet been updated.

## Next course

1. Read that course’s actual image references.
2. Look for those files in the two libraries above: `legacy-courses\courses\challenge\images\` and `E:\!!!backups\2026_courses\images\`.
3. Copy only the referenced files. Keep the original subfolders and filenames.
4. Report any referenced file that is missing from both libraries.

Do not assume the images live in a folder named for the course ID. Do not search entire drives unless both known locations fail.
