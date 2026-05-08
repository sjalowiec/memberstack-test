# Pattern System Standards

> Working standards and architectural decisions discovered during development of the Sleeveless Pattern Builder.
>
> This document is intentionally iterative. It captures decisions, rules, rendering behavior, instruction conventions, QA discoveries, and future architectural direction so future pattern systems inherit the same standards.

## Core Philosophy

The goal is not to create one perfect pattern.

The goal is to create:

- a reusable pattern engine
- a reusable instruction language
- reusable rendering systems
- reusable shaping systems
- reusable chart systems
- reusable SVG visualization systems
- reusable print formatting standards
- reusable QA / tech editing rules

The Sleeveless Pattern Builder is the reference implementation where these standards are being discovered.

## Architecture Principles

### Single Source of Truth

Written instructions, shaping charts, stitch counts, SVG diagrams, and print layouts must derive from the same underlying shaping timeline data.

Avoid duplicated shaping logic across:

- text instructions
- chart rendering
- SVG rendering
- print rendering

The same shaping event timeline should drive:

1. written instructions
2. chart rows
3. stitch counts
4. SVG geometry
5. print formatting

### Separate Math from Language

Pattern calculations and instruction wording are separate systems.

Example:

Math layer:

- decrease 4 stitches at RC 250

Instruction layer:

- RC 250: Bind off 4 stitches at shoulder edge.

This separation allows future support for:

- beginner wording
- condensed wording
- Japanese notation
- machine knitting phrasing
- hand knitting phrasing
- educational overlays

### Shared Rendering Utilities

Repeated rendering behavior should become shared utilities instead of pattern-specific logic.

Examples already discovered:

- formatPlainKnitInPatternSpan()
- mergeAdjacentPlainKnitBlocks()
- clampFrontSharedRowsBeforeNeckStart()
- renderShapingGeometrySvg()

These are pattern-engine utilities, not sleeveless-only logic.

## Instruction Language Standards

### Prefer Explicit RC Targets

Preferred:

RC 022: Knit to RC 140.

RC 140 (Armhole): Bind off 10 stitches at armhole edge.

Avoid:

- Knit 118 rows.
- Knit until RC 139.
- Work even for 118 rows.

Reason:

This creates a direct handshake between the plain knitting section and the shaping section.

It removes ambiguity about whether the shaping row is worked before or after the target RC.

### Avoid “Work Even”

Preferred:

- Knit in pattern

Avoid when possible:

- Work even

Reason:

“Knitting in pattern” is clearer and more natural for machine knitters.

### Mechanical Row Counter Standards

Mechanical row counter begins at:

- RC 000

Instructions should align directly with visible machine row counter values.

Avoid requiring knitters to mentally add or subtract rows.

### Action Rows Must Be Explicit

Never leave shaping rows visually blank if an action occurs during that row.

If a shoulder decrease occurs on RC 250, the row must explicitly indicate the action.

Avoid situations where the knitter must infer:

- opposite carriage-side actions
- second-pass shaping
- implied bind-offs

Reason:

Blank rows create hesitation and uncertainty.

### Stitch Counts Reflect Post-Action State

Displayed stitch counts should represent the stitch count AFTER the shaping action on that RC.

Example:

If RC 140 binds off 10 stitches, the displayed stitch count for RC 140 reflects the reduced count.

### Reduce Duplicate Instruction Surfaces

Avoid repeating the same shaping instructions in:

- prose
- chart rows
- SVG labels

Preferred structure:

- concise instruction summary
- detailed shaping chart
- visual SVG diagram

## RC / Timeline Standards

### RC Continuity

RC values must:

- progress sequentially
- avoid gaps in logic
- avoid ambiguous transitions

QA checks should verify:

- non-decreasing RC order
- no accidental skipped shaping rows
- no duplicated RC actions unless intentional

### Plain Knit Span Rendering

Plain knitting spans should preferentially render as:

Knit in pattern until RC ###.

Fallback only when RC context is unavailable:

Knit in pattern for X rows.

### Shared Row Clamping

Shared knitting spans must stop before neckline shaping begins.

Front neckline shaping must not overlap with inherited back-body spans.

Clamping logic discovered:

- remove rows at or beyond front neckline start RC
- shorten inherited spans to stop before shaping begins

## Neckline & Shoulder Standards

### Shared Timeline

Neckline shaping and shoulder shaping must coexist in a unified shaping timeline.

The system must support:

- simultaneous shaping
- overlapping actions
- independent edge shaping
- center bind-offs

### Round Neckline System

Current preferred system:

Deep round neckline:

- approximately one-third center bind-off
- approximately one-third stair-step shaping
- approximately one-third single decreases

Shallow neckline:

- simplified shaping for limited row depth

### Shoulder Shaping Scheduling

Shoulder shaping typically occurs during the final portion of neckline shaping.

Shoulder shaping should:

- align with row gauge
- preserve shoulder slope appearance
- integrate into shared chart timeline

### Bridge Rows

Upper-back / bridge rows should anchor to actual neckline start RC.

Bridge rendering should:

- connect body knitting to neckline shaping
- use explicit RC targets
- align with shaping chart start rows

## Chart Standards

### Compact Print Charts

Print charts should prioritize:

- vertical compactness
- readability
- explicit action visibility

Avoid excessive vertical whitespace.

### No Blank Action Rows

Chart rows must never imply shaping without explicitly stating the action.

If shaping occurs on a row:

- the row displays the action
- the left/right columns clarify which side is affected

### Shared Timeline Data

Charts derive from the same shaping timeline used by:

- SVG diagrams
- written instructions
- stitch counts

No independent chart-only shaping logic.

### Demo Data Never Renders in Production

Placeholder/demo chart rows must never leak into production rendering.

If live shaping data is unavailable:

- render empty state
- render fallback state
- do NOT render demo rows

## SVG / Diagram Standards

### Diagram Placement

Online and print layouts should place shaping diagrams:

- full width
- below shaping charts

Avoid narrow sidebar diagrams for shaping sections.

### Shared Geometry Source

SVG diagrams derive from the same shaping timeline used by:

- charts
- text instructions
- stitch counts

### Color Standards

Neckline shaping:

- terra cotta

Shoulder shaping:

- green

Labels and stair-step lines should visually correspond to their shaping category.

### Anti-Clipping Rules

SVG labels must:

- avoid clipping
- avoid overlap
- preserve readability
- remain visible at print scale

Label placement may dynamically nudge to avoid collisions.

### Width Normalization

SVG width normalization should anchor primarily to shoulder width.

Reason:

Neckline geometry alone can distort visual centering.

### Japanese Notation

Japanese notation support is planned.

Possible future display style:

1s - 2r - 3x

Glossary integration:

- glossary ID 354

Potential future tooltip overlays in online rendering.

## Gauge Standards

### Preserve Exact User Entry

Visible gauge text must preserve:

- exact numbers entered
- exact unit basis entered

Do not reconstruct visible gauge text from SPI/RPI calculations.

### Gauge Basis Labels

Imperial:

- stitches per 4 in
- rows per 4 in

Metric:

- stitches per 10 cm
- rows per 10 cm

Displayed labels should match the original entry basis.

## Print Layout Standards

### Online and Print Consistency

Online pattern layout and print layout should remain structurally similar whenever practical.

The knitter should recognize the same organizational structure across both formats.

### Reduce Excess White Space

Large empty regions waste print pages and reduce readability.

Future print QA should evaluate:

- chart spacing
- section spacing
- diagram spacing
- page flow

### Sans Serif Preference

Current print direction favors clean sans-serif typography for readability.

## Terminology Standards

Preferred terminology:

- Design instead of Style
- Pullover/Cardigan instead of Open/Closed
- Knit in pattern instead of Work even

Avoid vague or overly technical phrasing unless required.

Tone should remain:

- supportive
- clear
- instructional
- non-intimidating

## Tech Editing / QA Rules

### Required QA Checks

#### RC Logic

- RC progression valid
- no skipped shaping logic
- no contradictory row targets

#### Action Visibility

- no hidden shaping rows
- no implied second-pass actions
- carriage-side actions explicit

#### SVG Validation

- no clipping
- no overlapping labels
- consistent scaling
- correct centering

#### Data Integrity

- chart/text/SVG share same source data
- gauge preserved exactly
- no demo data leakage

#### Print Validation

- acceptable page count
- no large whitespace gaps
- charts readable
- labels readable

## Future Architecture Notes

### Goal: Reusable Pattern Engine

Long-term goal:

Pattern systems should compose reusable building blocks instead of creating isolated pattern implementations.

Future systems:

- raglan
- set-in sleeve
- drop shoulder
- cardigan
- hats
- blankets
- accessories

should inherit:

- shared instruction standards
- shared chart standards
- shared SVG standards
- shared QA rules
- shared terminology

### Potential Future Systems

Future exploration ideas:

- interactive drag-point shaping tools
- geometry-driven pattern drafting
- dynamic yarn estimation based on stitch totals
- educational overlays
- glossary-integrated instruction rendering
- interactive charts
- printable worksheet views

## Important Reminder

These standards are evolving.

The purpose of this document is not perfection.

The purpose is to preserve discoveries so future pattern systems do not repeatedly solve the same problems.
