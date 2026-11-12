# Knit it Now – Lego Block Reference

This file keeps track of reusable components (“Lego Blocks”) used in the Knit it Now tools and wizards.

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


SAVED PATTERN STICKY NAVIGATION

Location:
src/components/patterns/SavedPatternStickyNav.astro
src/lib/patterns/patternInpageNav.ts

Purpose:
Sticky in-page navigation for every saved pattern page. Each pattern passes its own section links and Edit / Print actions. The bar adds a Top link back to the pattern header. On a narrow screen the section links scroll and the actions stay visible. The bar is omitted from print.

Example:

<SavedPatternStickyNav actionsAttrs={["data-sleeveless-pattern-actions"]}>
  <button type="button" data-testid="button-edit-pattern">Edit Pattern</button>
</SavedPatternStickyNav>


---------------------------------------------------

CROSS SHOULDER MEASUREMENT

Location:
src/lib/patterns/legoBlocks/crossShoulderMeasurement.ts

Purpose:
Labels the finished width from one outer shoulder point to the other, including the neck opening, on sweater Stitches & Rows diagrams. The measurement is the knitted width of the generated shoulder stitches (stitches divided by gauge), in the selected units. A split half shows that finished width as “Full cross shoulder” with no arrow, and puts the dimension arrow on the half on the needles, including its seam stitch.

Use when:
A sweater body diagram spans both outer shoulders, or a center-seam half needs the full width distinguished from the half on the needles. Sleeves, cardigan fronts, sideways bodies, hats, and socks do not use it.

---------------------------------------------------

CAST-ON EDGE LABEL

Location:
src/lib/patterns/legoBlocks/stitchesRowsDiagramLabel.ts

Purpose:
Labels every cast-on edge on body and sleeve Stitches & Rows diagrams with the generated stitch count and the knitted width of that count. The width is the stitch count divided by stitch gauge, in the selected units, to one decimal. A split piece uses the stitch count already drawn for that piece, including its seam stitch. A-line hems use the hem stitch count. This label does not change sizing or shaping. The diagram leaves room below the cast-on edge so the width stays visible on screen and in print.

Use when:
A Stitches & Rows diagram draws a cast-on edge for a sweater body or sleeve. Bind-off edges, neck widths, and body lengths keep their own measurements.

---------------------------------------------------

GLOSSARY TOOLTIP

Location:
src/components/common/GlossaryTooltip.astro

Purpose:
Reusable inline glossary tooltip used across tools, help panels, and page text.

import GlossaryTooltip from "../../components/common/GlossaryTooltip.astro";

<GlossaryTooltip id={843}>Proper Swatch</GlossaryTooltip>