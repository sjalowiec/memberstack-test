APPROVED DROP-SHOULDER FRONT SVGs (read-only backup)
=====================================================
Created: 2025-06-25

These copies are a safety net. The pattern page loads the LIVE files in the
parent folder (drop-shoulder/), NOT this folder.

Only edit the live file when you mean to replace production art. If you
accidentally overwrite a live file, restore from here.


WHICH FILE IS WHICH? (live filename → pattern tab)
--------------------------------------------------

  LIVE FILE (edit for production)          TAB              NOTES
  -------------------------------          ---              -----
  drop-body-front.svg                      Stitches & Rows  straight pullover front
                                                              (round + V-neck share this file)
  drop-A-body-front.svg                    Stitches & Rows  A-line round pullover front
  diagram-jp-front-aline.svg               Shaping Notation A-line round pullover front
  drop-body-front-shaped.svg               Stitches & Rows  shaped pullover front (round + V)
  diagram-jp-front-shaped.svg              Shaping Notation shaped pullover front (round + V)

  jp-drop-body-front.svg                   Shaping Notation straight pullover front
                                                              (not backed up here yet)


CLEAR BACKUP NAMES (same art, easier to read)
---------------------------------------------

  01-straight-pullover-front-STITCHES-AND-ROWS.svg  →  drop-body-front.svg
  02-aline-round-pullover-front-STITCHES-AND-ROWS.svg  →  drop-A-body-front.svg
  03-aline-round-pullover-front-JP-NOTATION.svg        →  diagram-jp-front-aline.svg
  04-shaped-pullover-front-STITCHES-AND-ROWS.svg       →  drop-body-front-shaped.svg
  05-shaped-pullover-front-JP-NOTATION.svg             →  diagram-jp-front-shaped.svg

  original-filenames/ holds the same files under their live names.


HEM CAST-ON (bottom horizontal width)
-------------------------------------

  {{HIP_STS}}sts
  ({{HIP_INCHES}} {{UNIT}})

  Left side hem depth (vertical) stays {{HEM_ROWS}} / {{HEM_INCHES}}.


RESTORE ONE LIVE FILE (PowerShell, from repo root)
--------------------------------------------------

  Copy-Item "public\images\patterns\drop-shoulder\_approved-front-svgs\original-filenames\drop-body-front.svg" `
            "public\images\patterns\drop-shoulder\drop-body-front.svg" -Force

  Or use the numbered copy:

  Copy-Item "public\images\patterns\drop-shoulder\_approved-front-svgs\01-straight-pullover-front-STITCHES-AND-ROWS.svg" `
            "public\images\patterns\drop-shoulder\drop-body-front.svg" -Force
