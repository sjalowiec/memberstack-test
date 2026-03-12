# Knit by Machine – Lego Block Reference

This file keeps track of reusable components (“Lego Blocks”) used in the Knit by Machine tools and wizards.

It helps remember:
- what blocks exist
- where they live
- when to use them


---------------------------------------------------

TOOL HELP TOGGLE

Location:
src/components/tools/ToolHelpToggle.astro

Purpose:
Adds a small help button to a tool. When clicked, it opens instructions or a tutorial link.

Use when:
A tool needs optional help or a video explanation.

Example:

<ToolHelpToggle title="Gauge Help">

Measure gauge from a swatch larger than 4 inches (10 cm).

<a href="/learn/measuring-gauge">
Watch the quick swatch tutorial
</a>

</ToolHelpToggle>


---------------------------------------------------

RESULT HIGHLIGHT CARD (planned)

Location:
src/components/tools/ResultHighlightCard.astro

Purpose:
Displays the main result of a tool in a large, clear format so the answer is easy to see.

Example result display:

50
Maximum Knitted Width

Use when:
A calculator produces one main answer that should stand out.


---------------------------------------------------

WIZARD BACK LINK

Location:
src/components/wizards/WizardBackLink.astro

Purpose:
Adds a consistent back navigation link for wizard-style tools.

Example:

<WizardBackLink />


---------------------------------------------------

UNIT TOGGLE

Location:
src/components/wizards/components/UnitToggle.astro

Purpose:
Lets the user switch between Inches and Centimeters.

Triggers the event:
kbm:units-change

Used in:
tools that support both inches and centimeters.


---------------------------------------------------

PRINT BUTTON

Location:
src/components/common/PrintButton.astro

Purpose:
Reusable button that allows users to print instructions or tool results.

Example:

<PrintButton />


---------------------------------------------------

HOW MOST TOOLS ARE BUILT

Typical layout:

Tool Title

[ Help button ]

Inputs

Calculate Button

Result


---------------------------------------------------

ADDING NEW LEGO BLOCKS

When creating a new reusable component:

1. Add it to this file
2. Record where the file lives
3. Write a short explanation
4. Add a small example if helpful


GLOSSARY TOOLTIP

Location:
src/components/common/GlossaryTooltip.astro

Purpose:
Reusable inline glossary tooltip used across tools, help panels, and page text.

import GlossaryTooltip from "../../components/common/GlossaryTooltip.astro";

<GlossaryTooltip id={843}>Proper Swatch</GlossaryTooltip>