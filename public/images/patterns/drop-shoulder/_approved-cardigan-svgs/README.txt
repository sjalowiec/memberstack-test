APPROVED DROP-SHOULDER CARDIGAN FRONT SVGs (read-only backup)
==============================================================
Created: 2025-06-25

The pattern page loads LIVE files from drop-shoulder/body/ and drop-shoulder/japanese/
- NOT this folder.


STRAIGHT CARDIGAN FRONT (round + V-neck share)
----------------------------------------------

  LIVE:  body/drop_body_cardigan.svg          Stitches & Rows
  LIVE:  japanese/jp-drop-body-cardigan.svg   Shaping Notation

  BACKUP: 01-straight-cardigan-front-STITCHES-AND-ROWS.svg


A-LINE CARDIGAN FRONT (round + V-neck share - both necklines in artwork)
-----------------------------------------------------------------------

  LIVE:  drop-A-body-cardigan.svg              Stitches & Rows
  LIVE:  japanese/jp-drop-cardigan-aline.svg    Shaping Notation

  BACKUP: 02-aline-round-cardigan-front-STITCHES-AND-ROWS.svg
  BACKUP: 03-aline-round-cardigan-front-SHAPING-NOTATION.svg


SHAPED CARDIGAN FRONT (round + V-neck share)
--------------------------------------------

  LIVE:  drop-body-cardigan-shaped.svg           Stitches & Rows
  LIVE:  japanese/jp-drop-cardigan-shaped.svg   Shaping Notation

  BACKUP: 04-shaped-cardigan-front-STITCHES-AND-ROWS.svg
  BACKUP: 05-shaped-cardigan-front-SHAPING-NOTATION.svg


RESTORE (PowerShell, from repo root)
------------------------------------

  Copy-Item "public\images\patterns\drop-shoulder\_approved-cardigan-svgs\original-filenames\drop_body_cardigan.svg" `
            "public\images\patterns\drop-shoulder\body\drop_body_cardigan.svg" -Force

  Copy-Item "public\images\patterns\drop-shoulder\_approved-cardigan-svgs\original-filenames\drop-A-body-cardigan.svg" `
            "public\images\patterns\drop-shoulder\drop-A-body-cardigan.svg" -Force

  Copy-Item "public\images\patterns\drop-shoulder\_approved-cardigan-svgs\original-filenames\jp-drop-cardigan-aline.svg" `
            "public\images\patterns\drop-shoulder\japanese\jp-drop-cardigan-aline.svg" -Force

  Copy-Item "public\images\patterns\drop-shoulder\_approved-cardigan-svgs\original-filenames\drop-body-cardigan-shaped.svg" `
            "public\images\patterns\drop-shoulder\drop-body-cardigan-shaped.svg" -Force

  Copy-Item "public\images\patterns\drop-shoulder\_approved-cardigan-svgs\original-filenames\jp-drop-cardigan-shaped.svg" `
            "public\images\patterns\drop-shoulder\japanese\jp-drop-cardigan-shaped.svg" -Force
