---
name: drop-body-sleeve
description: >-
  Maintain drop-shoulder sleeve diagram SVGs (cuff-up and top-down, Stitches & Rows and
  Shaping Notation). Use when editing drop-body-sleeve.svg, JP-drop-body-sleeve.svg,
  jp-drop-body-sleeve-top-down.svg, sleeve Illustrator exports, or sleeve diagram tokens.
---

# Drop-shoulder sleeve diagrams (`drop-body-sleeve.svg`)

## Four live files

| Construction | Tab | Live path |
|--------------|-----|-----------|
| **Cuff-up** (bottom-up) | Stitches & Rows | `public/images/patterns/drop-shoulder/drop-body-sleeve.svg` |
| **Cuff-up** (bottom-up) | Shaping Notation | `public/images/patterns/drop-shoulder/JP-drop-body-sleeve.svg` |
| **Top-down** | Stitches & Rows | `public/images/patterns/drop-shoulder/drop-body-sleeve-top-down.svg` |
| **Top-down** | Shaping Notation | `public/images/patterns/drop-shoulder/jp-drop-body-sleeve-top-down.svg` |

**Naming note:** Bottom-up JP uses legacy capital `JP-drop-body-sleeve.svg` (git-tracked). Top-down JP is lowercase `jp-drop-body-sleeve-top-down.svg`. On Windows these look interchangeable - on Linux deploy they are **not**. Never save body/cardigan art into the sleeve JP filename.

## Do not mix token families

Export **one layer per file** from Illustrator.

- **Measurement** files (`drop-body-sleeve*.svg`): `{{WRIST_STS}}`, `{{SLEEVE_CAP_STS}}`, `{{SLEEVE_LENGTH_ROWS}}`, `{{SIDE_LENGTH}}`, `{{CUFF_ROWS}}`, `{{CUFF_DEPTH}}`, `{{UNIT}}`, etc.
- **Japanese notation** files (`JP-drop-body-sleeve*.svg`): `{{jp-caston}}`, `{{jp-cuff}}`, `{{jp-sleeve}}`, `{{jp-sleeve_cap_sts}}` only.

Body/cardigan tokens (`jp-neckline-bo`, `rc-armhole-bo`, `NECK_STS`, ...) belong on **front/back** schematics, not sleeve JP exports.

## Orientation

- **Cuff-up / bottom-up:** Cast-on at wrist (bottom). Upper-arm / bind-off at top. Matches default sleeve construction on the pattern page.
- **Top-down:** Artwork is vertically flipped; **same token ids** - the code swaps wrist -> upper-arm values when hydrating top-down measurement art.

## JP label placement (cuff-up)

| Token | Typical position |
|-------|------------------|
| `{{jp-caston}}` | Wrist / cast-on edge |
| `{{jp-cuff}}` | Cuff / hem section |
| `{{jp-sleeve}}` | Body shaping notation (interval decreases/increases) |
| `{{jp-sleeve_cap_sts}}` | Upper arm / bind-off edge |

Mirror top-down JP from `jp-drop-body-sleeve-top-down.svg` when redrawing cuff-up JP.

## Code wiring

- Resolver: `src/lib/patterns/dropShoulderDiagramSvgResolver.ts` (`sleeveDirection`: `cuff-up` | `top-down`)
- Paths/constants: `src/lib/patterns/dropShoulderSleeveNotationSvg.ts`
- Token builders: `buildDropShoulderSleeveDiagramReplacements`, `buildDropShoulderSleeveJapaneseNotationReplacements` in `src/lib/patterns/sleevelessGarmentDiagramReplacements.ts`
- Page hydrate: `src/scripts/sleevelessPatternPageShared.ts` ? `inlineDropShoulderSleeveNotationSvg`

## After export

1. Hard-refresh the drop-shoulder pattern page; toggle **Sleeve** tab ? **Shaping Notation** for both cuff-up and top-down.
2. Run tests:

```bash
npx vitest run src/lib/patterns/sleevelessGarmentDiagramReplacements.test.ts -t "drop-body-sleeve"
npx vitest run src/lib/patterns/dropShoulderDiagramSvgResolver.test.ts
```

## Common mistake

Saving cardigan/front JP into `JP-drop-body-sleeve.svg` breaks the bottom-up sleeve Shaping Notation tab (wrong tokens, parse/hydrate failure). If that happens, restore from git:

```powershell
git checkout HEAD -- public/images/patterns/drop-shoulder/JP-drop-body-sleeve.svg
```
