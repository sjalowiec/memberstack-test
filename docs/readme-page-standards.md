Page Standards
Back Navigation Pattern

All interior pages should include a simple back navigation link at the top of the page.

Use the PageBackLink component for consistency.

Purpose
Helps users orient themselves
Prevents dead ends
Keeps navigation simple and consistent across the site
Usage

Place the back link at the top of the page content, above the main heading or hero section.

Examples:

Help Hub tip page → Back to Help Hub
Lesson page → Back to Tip
Reference pages → Back to References
Component

Use: PageBackLink

Props:

href → destination URL
text → label (component adds arrow automatically)
Rules
Always use the component (do not hand-code links)
Do not use breadcrumbs
Do not add multiple navigation options at the top
Keep it simple: one clear way back
Spacing

Spacing below the back link is handled by the component.
Do not add additional spacing per page.

Adoption Strategy
Use this component for all new pages
Replace old back links when editing existing pages
Do not refactor the entire site at once
Why this matters

Every page should answer:

Where did I come from?
Where do I go next?

This pattern ensures users never feel lost.