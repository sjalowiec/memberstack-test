APPROVED DROP-SHOULDER BACK SVGs (read-only backup)
====================================================
Created: 2025-06-24

These copies are a safety net. The pattern page loads the LIVE files in the
parent folder (drop-shoulder/), NOT this folder.

Only edit the live file when you mean to replace production art. If you
accidentally overwrite a live file, restore from here.


WHICH FILE IS WHICH? (live filename → pattern tab)
--------------------------------------------------

  LIVE FILE (edit for production)          TAB              BODY SHAPE
  -------------------------------          ---              ----------
  drop-body-back.svg                       Stitches & Rows  straight (hip = bust)
  drop-body-back-aline.svg                 Stitches & Rows  A-line (hip > bust)
  drop-body-back-shaped.svg                Stitches & Rows  shaped (hip < bust)

  jp-drop-body-back.svg                    Shaping Notation straight
  diagram-jp-back-aline.svg                Shaping Notation A-line
  diagram-jp-back-shaped.svg               Shaping Notation shaped


CLEAR BACKUP NAMES (same art, easier to read)
---------------------------------------------

  01-straight-back-STITCHES-AND-ROWS.svg   →  drop-body-back.svg
  02-aline-back-STITCHES-AND-ROWS.svg      →  drop-body-back-aline.svg
  03-straight-back-JP-NOTATION.svg         →  jp-drop-body-back.svg
  04-aline-back-JP-NOTATION.svg            →  diagram-jp-back-aline.svg

  05-shaped-back-STITCHES-AND-ROWS.svg     →  drop-body-back-shaped.svg
  06-shaped-back-JP-NOTATION.svg           →  diagram-jp-back-shaped.svg

  original-filenames/ holds the same files under their live names.


TOKEN FAMILIES (do not mix in one export)
-----------------------------------------

  Stitches & Rows:  HIP_STS, SIDE_LENGTH_ROWS, ARMHOLE_ROWS, NECK_DEPTH_ROWS, …
  JP notation:      jp-caston, jp-body-shaping, jp-body-rows, rc-armhole-bo, …


RESTORE ONE LIVE FILE (PowerShell, from repo root)
--------------------------------------------------

  Copy-Item "public\images\patterns\drop-shoulder\_approved-back-svgs\original-filenames\drop-body-back-aline.svg" `
            "public\images\patterns\drop-shoulder\drop-body-back-aline.svg" -Force

  Swap the filename in both paths for the file you need.


IGNORE
------

  drop-A-body-back.svg — old naming, not wired to the pattern page.
