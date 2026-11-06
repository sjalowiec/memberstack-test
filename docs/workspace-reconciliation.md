# Workspace reconciliation

Everyday folder: `E:\!2022Knititnow\knitbymachine\workspace\knititnow-staging`.

Reviewed kin-dev commit: `0bb48eb5` on `origin/dev`. Sue’s kin-dev review passed for courses, set-in sleeve pattern generation, Tip of the Week admin, and Current Members. Vimeo playback was not checked because of the dev restriction.

Parked snapshot: local branch `kin-dev/tip-of-the-week-admin` at `d3fc6819`. It was not pushed. Do not recover it. It is not part of `dev`.

Production (`origin/main`, `e38bb7ac`) was not updated.

## Still on dev, not on production

These need a separate production decision. Do not treat this list as approval to merge `dev` into `main`.

- Set-in sleeve builder, including its kin-dev-only anonymous test hook.
- Verified Home Study course access, the Watson Home Study page, purchased-course history, and ebook entitlement recovery.
- Watson Member Account Repair.
- In-lesson glossary modal.
- Help Hub Watch and Learn.
- Sock and Christmas stocking stitch planner.
- Course 103’s extra English Rib Checklist.

## Do not drop these production behaviors in a later merge

- Production staff sign-in is `/admin/login`. Dev keeps the Watson login and does not add a second gate.
- Nifty Gifty Stocking is published on production for November 5, 2026. Dev leaves it unpublished until Watson saves a date.
- The Brother KH930/KH940 user-guide PDF stays out of `dev`. The course links to the MKManuals search page instead.
