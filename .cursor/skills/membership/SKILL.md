---
name: membership
description: Maintain the temporary Knit it Now Membership landing page at /membership. Use when editing membership page copy, layout, or CTAs. Membership is broader than patterns—it covers the full site (tools, troubleshooting, help hubs, guidance).
---

# Knit it Now Membership Page

## Purpose

Temporary landing page linked from membership prompts across the site (patterns, gated content, help hubs, and similar). Explain what membership will include without final pricing or plan promises.

**Scope:** Membership represents the larger Knit it Now site—not patterns alone. Include pattern systems as one part of a broader offering: project tools, calculators, troubleshooting, help hubs, technique guidance, planning support, and ongoing resources for machine knitters.

## Apply To

- `src/pages/membership.astro`

## Tone

Friendly, clear, reassuring, and practical. For machine knitters. Not corporate or overly salesy.

## Layout and Styling

- Keep existing page layout and styling as much as possible.
- Keep existing colors and button styling (`kbm-btn kbm-btn-accent`).
- Page should still feel temporary, but polished enough to link from across the site.
- Preserve current responsive behavior (global `.page-wrap`).
- Use `.membership-page-wrap.page-wrap { padding-top: 8px; }` so top spacing is not doubled with Layout header clearance.

## Do Not

- Add a purchase link yet.
- Mention Memberstack.
- Mention ActiveCampaign.
- Promise exact launch dates.
- Promise every garment style or every future feature.
- Frame membership as patterns-only; balance pattern systems with tools, troubleshooting, help hubs, and guidance.

## CTA

- Button text: `Membership Options Coming Soon`
- Keep the button inactive or pointing wherever it currently points (self-link to `/membership` is acceptable).

## Page Copy (use verbatim)

**Title:**
Knit it Now Membership

**Intro:**
Knit it Now membership gives machine knitters access to pattern systems, project tools, troubleshooting help, and practical guidance designed to make knitting easier to understand and easier to manage.

Whether you're following a pattern, customizing a garment, solving a machine problem, or planning your next project, the goal is to help you keep moving forward with confidence.

**Section heading:**
What members will get

**Bullets:**
- Access to Knit it Now pattern systems
- Full customization tools for supported pattern systems
- Project planning tools and calculators
- Troubleshooting help and practical machine knitting fixes
- Technique guides and instructional videos
- Help hubs focused on real machine knitting problems
- Ongoing updates, new tools, and future learning resources
- Access to new releases as they are added

**Section heading:**
More than just patterns

**Body:**
Knit it Now is designed to support the entire knitting process, not just provide a single pattern download.

Members will be able to explore pattern systems, customize supported garments, use planning tools, troubleshoot problems, and access practical resources designed specifically for machine knitters.

**Section heading:**
During beta testing

**Body:**
Current beta members already have access while we finish setting up membership options. Plans and pricing are still being finalized.

**Button text:**
Membership Options Coming Soon
