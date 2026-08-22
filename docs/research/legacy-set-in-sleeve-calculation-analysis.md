# Legacy Set-In Sleeve Calculation Analysis

**Status:** research only. No implementation recommendations.  
**Primary source:** `src/pages/downloads/setinsleeve.cfm`  
**Date:** 2026-08-21

This document reverse-engineers the legacy ColdFusion set-in sleeve **cap** calculator so it can be compared with sleeve-design reference material before any new Set-In Sleeve Lego blocks are designed.

The file is a **fragment**, not a complete pattern engine. It assumes a parent page has already computed the body armhole, the sleeve width at the underarm, gauges, bust, and several `sleaveinsleave_*` / `setinsleeve_*` variables. Those parent files are **not in this repository**.

---

## 1. Executive summary

The legacy engine does **not** design a full sleeve (cuff → biceps → cap). This file only shapes the **sleeve cap**, starting from a stitch count that already represents the sleeve width at the underarm.

The algorithm has three layers that are only loosely coupled:

1. **Body armhole perimeter** — one side of the body armscye is approximated as four straight-line segments (initial bind-off, a short diagonal, an every-other-row diagonal, then a vertical straight). Their hypotenuses are summed.
2. **Target cap geometry** — the initial underarm bind-off, a 1-inch “top slope,” and a final top bind-off are peeled off that perimeter. What remains is treated as a single right triangle. Cap **height** is then solved with the Pythagorean theorem. A **second**, simpler cap-height rule (`armhole depth − 2/3/4 inches` by bust size) is also computed and is what actually sets the pattern’s end-row budget.
3. **Three “Greenline” shaping zones** — the remaining width and (geometric) height are split into three decrease bands: roughly **¼ / ½ / ¼ of the rows** and **⅓ / ⅓ / ⅓ of the stitches**. That produces the classic sleeve-cap rhythm **faster → slower → faster**. Each band is turned into knitting instructions with the site’s old “magic formula” (two interleaved decrease intervals).

Several values are loaded or computed and then **never used** in the knitting instructions, including the sizing-chart `sleeve_cap` measurement. Matthew left comments such as `not right`, a discarded alternate cap-height formula, and a leftover ` Cap_workingRows` path. The published “Set-in Sleeve Warning” glossary entry states that some size/gauge combinations make the generated instructions **inaccurate**.

Front and back armholes are **not** treated separately. One set of body-armhole numbers is reused for the whole cap.

---

## 2. Inputs

### 2.1 Values this file reads (not defined here)

These must already exist in the parent pattern-engine scope.

| Variable | Apparent meaning | Units | Origin (as far as this repo can tell) | Source class |
|---|---|---|---|---|
| `stitchcount` | Stitches on the needle at the **start of the cap** (full sleeve width at underarm / biceps) | stitches | Previous sleeve-body action. This file immediately subtracts the first bind-off from it. | Sleeve body / user garment + gauge |
| `stitchgauge` | Sleeve stitch gauge | stitches per inch | Pattern gauge | Gauge |
| `rowgauge` | Sleeve row gauge | rows per inch | Pattern gauge | Gauge |
| `rowcount` | Current row counter when the cap begins | rows | Pattern engine state | Engine state |
| `sleaveinsleave_armholestep1` | Body armhole **initial bind-off**, one side. Copied onto the sleeve as the first two cap bind-offs. | stitches | Body armhole calculation (“other piece”) | Body / armhole |
| `sleaveinsleave_step_6_2s` | Horizontal stitch component of the **second** body-armhole segment. Comment: “from armhole element.” Name suggests armhole worksheet step 6, part 2. | stitches | Body armhole calculation | Body / armhole |
| `sleaveinsleave_bodystichgauge` | Body stitch gauge used to convert armhole stitches → inches | stitches per inch | Body gauge (may equal sleeve gauge) | Gauge (body) |
| `sleaveinsleave_bodyrowgauge` | Body row gauge used to convert armhole rows → inches | rows per inch | Body gauge | Gauge (body) |
| `sleaveinsleave_armholedepth` | Body armhole **depth** | inches | Sizing / user measurement | Body / user |
| `sleaveinsleave_shoulderrowstart` | Body row where the **shoulder** begins | rows | Body calculation | Body / armhole |
| `setinsleeve_armholeshaping_endrow` | Body row where **armhole decreases finish** (start of the straight armhole) | rows | Body armhole calculation | Body / armhole |
| `setinsleeve_Bust_inches` | Bust or chest used only to pick `estimated_cap` | inches | Sizing / user | User / sizing |
| `garment.sizingtypeid_fk` | Sizing-chart family (misses, men, …) | id | Pattern / garment record | Sizing DB |
| `form.SizingSizeID` | Selected size | id | User / form | User |
| `form.debug` | Dumps the `sleeve_cap` query | flag | Form | Engine |
| `form.typeofpattern` | `"Machine_printedinstructions"` vs hand | string | Form | Presentation |
| `actionid`, `patternid_fk` | Pattern-engine action / pattern ids | ids | Engine | Engine |
| `Mulipler` | Stored on the action; **not used** in any formula | unknown | Engine (likely stitch-pattern multiple) | Engine |
| `details.uselable`, `details.lable`, `details.lable2` | Optional diagram labels | text | Action config | Presentation |
| `step13c` | Written into the “Sleeve Cap Height” label as inches | unknown | **Undefined in this file** | Unknown / leftover |

Comment on line 28: `setinsleeve_armholewidth passed from other pieace` — that variable is **never referenced**. The width actually used is `stitchcount`.

### 2.2 Values this file loads from the sizing database

| Variable | Apparent meaning | Units | Origin | Used in cap math? |
|---|---|---|---|---|
| `sleevecap_inches` | Sizing-chart field `EngineVariable = "sleeve_cap"` | inches | `Sizing_mesurments` / `Sizing_areas` | **No.** Stored on `pattern_#actionid#_details` only. |
| `sleevecap_stitches` | `int(sleevecap_inches * stitchgauge)`, then forced even | stitches | Derived | **No.** Comment: “item 10.” |

Modern copies of those charts (`public/data/sizing_sweaters_*.json`) show `sleeve_cap` populated for **misses** (2.5–3.5″) and **men** (4.25–5″), and **empty** for kids, baby, and plus. What that chart field was *meant* to be (cap height, cap ease, top-of-cap width, or “amount subtracted from armhole depth”) is not stated in this file. See §11.

### 2.3 Inputs this file does **not** use

These were requested in the research brief. They do not appear in the cap calculator:

| Expected input | Present? |
|---|---|
| Sleeve length (shoulder to wrist, or underarm to wrist) | No — cap-only file |
| Cuff / wrist width | No |
| Sleeve taper from cuff to biceps | No — assumed already knitted |
| Separate front vs back armhole | No — one perimeter |
| Ease allowance as a named input | No named ease. Implicit ease lives in `estimated_cap`, the `− 0.25` on the final bind-off, and the unused `sleeve_cap` chart value |

### 2.4 Values this file creates

Documented in §4 and §5. The most important outputs are:

- knitting instructions (machine and hand HTML tables)
- per-row `pattern_#patternid_fk#_knitinfo.rc_#n#` chart cells
- optional labels “Sleeve Cap Height” and “Sleeve Cap Top”

---

## 3. Armhole geometry

The file rebuilds **one side** of the body armscye as four straight segments, converts each to inches with **body** gauge, and takes the Euclidean length of each segment.

This is a **polyline approximation** of the knitted armscye: four straight lines, not a curve, and not a stitch-by-stitch walk of the bound-off / decreased edge.

Front and back are **assumed identical**. Nothing in the file adds a second armhole or averages two.

### 3.1 Segment table

Let

- \(N_1\) = `sleaveinsleave_armholestep1` (stitches)
- \(N_2\) = `sleaveinsleave_step_6_2s` (stitches)
- \(G_s\) = `sleaveinsleave_bodystichgauge`
- \(G_r\) = `sleaveinsleave_bodyrowgauge`
- \(R_{sh}\) = `sleaveinsleave_shoulderrowstart`
- \(R_{ah}\) = `setinsleeve_armholeshaping_endrow`

| Zone | What it appears to be on the body | Horizontal \(\Delta x\) | Vertical \(\Delta y\) | Length |
|---|---|---|---|---|
| **Zone 1** | Initial underarm bind-off | \(N_1 / G_s\) | \(0\) | \(\lvert\Delta x\rvert\) |
| **Zone 2** | Short shaped step from the armhole element | \(N_2 / G_s\) | \(4 / G_r\) (**4 rows, hard-coded**) | \(\sqrt{\Delta x^2 + \Delta y^2}\) |
| **Zone 3** | Remaining armhole decreases | \(N_1 / G_s\) (same stitch count as Zone 1) | \((N_1 \cdot 2) / G_r\) | \(\sqrt{\Delta x^2 + \Delta y^2}\) |
| **Zone 4** | Straight armhole after shaping, up to the shoulder | \(0\) | \((R_{sh} - R_{ah}) / G_r\) | \(\lvert\Delta y\rvert\) |

**Combined perimeter (one side):**

\[
P = L_1 + L_2 + L_3 + L_4
\]

stored as `parimaterlength`.

### 3.2 What the segments imply about the missing body-armhole recipe

The sleeve file does not compute the body armhole; it only **reads** it. The four zones nonetheless imply a specific body recipe:

1. **Bind off \(N_1\) stitches** (horizontal, no row height).
2. **A short second step** of \(N_2\) stitches over **exactly 4 rows**. That 4 is not derived from \(N_2\). It is a constant.
3. **Decrease 1 stitch every other row, \(N_1\) times.** Height \(= 2 N_1\) rows is exactly that schedule. Using the *same* \(N_1\) as the initial bind-off is a design rule, not a geometric necessity.
4. **Work even** from the last armhole decrease to the shoulder.

This is **more articulated** than the current modern sleeveless/drop-shoulder armhole Lego (`src/lib/patterns/legoBlocks/armholeShaping.ts`), which is only: bind off ≈ half the side stitches, decrease the rest every other row, work even.

### 3.3 How the perimeter is consumed by the sleeve

After \(P\) is built, the file subtracts the three cap edges that are *not* the working (Greenline) curve:

\[
P_{\text{working}} = P - B_{\text{initial}} - S_{\text{topslope}} - \tfrac{1}{2} B_{\text{final}}
\]

| Symbol | Variable | Meaning |
|---|---|---|
| \(P\) | `parimaterlength` | One-side body armscye, inches |
| \(B_{\text{initial}}\) | `sleave_intialbindoff_inches` = \(N_1 / G_s\) | Same as Zone 1. Sleeve underarm bind-off is meant to **match** the body underarm bind-off. |
| \(S_{\text{topslope}}\) | `topslope_slope_inch` | Hypotenuse of the 1-inch-wide top slope |
| \(B_{\text{final}}\) | `Final_bind_Off_inches` | Full top-of-cap bind-off width. Only **half** is subtracted because \(P\) is one side. |

`P_working` (`workingheight_parimater`) is then treated as the **hypotenuse** of the working cap on one side. See §4.5.

### 3.4 Front vs back

Not separated. If the live Knit it Now body engine ever used a different front armhole (deeper scoop, different bind-off), this file would not see it unless the parent copied one side’s numbers into the `sleaveinsleave_*` variables.

---

## 4. Sleeve-cap geometry

### 4.1 Dependency chain

```
Body armhole
  ├─ N1, N2, armhole depth, shaping-end row, shoulder-start row
  └─ four-segment perimeter P
        │
        ▼
Target cap geometry
  ├─ Initial BO  = N1 each side (2 rows)
  ├─ Final BO    = (sleeve width / 4) − 0.25″   [Step 4]
  ├─ Top slope   = 1″ width over ~½″ rows       [Step 3]
  ├─ Working width W  = half sleeve − those three pieces
  ├─ Working hypotenuse P_working = P − those three pieces
  ├─ Geometric cap height h = √(P_working² − W²)
  └─ Simple cap height H = armhole depth − estimated_cap(bust)   [Step 2]
        │
        ▼
Shaping zones (Greenline 1 / 2 / 3)
  ├─ stitches from W  (split by 3)
  └─ rows from h      (split by 4, middle band doubled)
        │
        ▼
Knitting instructions
  Step 1: bind off N1, two rows
  Step 2: magic-formula decreases in three Greenline bands
  + 2 plain rows
  Top slope: multi-stitch decreases, smallest → largest, with a knit row between
  Bind off remaining stitches
```

Two different cap heights exist. **Greenline row counts use the geometric \(h\).** **The pattern `endrow` budget uses the simple \(H\).** They are not required to agree. That split is one of the most important findings in this file.

### 4.2 Initial sleeve-cap bind-off

```
sleave_intialbindoff_inches = sleaveinsleave_armholestep1 / sleaveinsleave_bodystichgauge
```

Knitting (Step 1): bind off `sleaveinsleave_armholestep1` stitches at the beginning of **two consecutive rows** (one each side). `stitchcount` is reduced by \(N_1\) after each row.

**Geometric intent:** the sleeve underarm cast-off should be the same width as the body underarm cast-off so those edges seam together.

### 4.3 Finished / top cap width (Step 4)

Computed *before* the top slope in the source, despite the comment numbering.

\[
B_{\text{final}} = \frac{\textit{stitchcount}/G_{\text{sleeve}}}{4} - 0.25
\]

```
Final_bind_Off_inches = ((stitchcount/stitchgauge)/4) - .25
Final_bind_off_stitches = int(Final_bind_Off_inches * stitchgauge)
```

If the stitch count is odd, **1 is subtracted** (forced even). The comment says “make this also odd”; the code makes it **even**.

**Geometric intent:** the bound-off top of the cap (the edge that sits at the shoulder) is about **one quarter of the sleeve’s underarm width, minus ¼ inch**. That ¼ inch is an ease/fudge, not a measurement.

The leftover stitches after all shaping are bound off with “Bind off remaining stitches.” The label “Sleeve Cap Top” stores whatever `stitchcount` remains at that moment — it is **not** independently set to `Final_bind_off_stitches`. If Greenline rounding drifts, the actual top width can differ from the Step 4 target.

### 4.4 Top slope (Step 3)

Sue’s rule, quoted in-file: the top slope is **always one inch wide**.

```
Top_slope_rows = int(rowgauge / 2)     → then forced even
Top_slope_decrease1 = int((stitchgauge * 2) / Top_slope_rows)
Top_slope_decrease2 = int(stitchgauge - Top_slope_decrease1)
```

If `decrease2 > decrease1`, `decrease2` is capped at `decrease1` and the remainder becomes `decrease3`. Otherwise `decrease3 = 0`. Negative `decrease3` is clamped to 0.

The three decrease counts are concatenated and **sorted ascending**. Knitting walks that list: decrease \(k\) stitches **on each side**, then knit 1 row, for each \(k > 0\).

Width and hypotenuse:

\[
w_{\text{slope}} = (d_1 + d_2 + d_3) / G_{\text{sleeve}} \approx 1\text{ inch}
\]
\[
h_{\text{slope}} = \textit{Top_slope_rows} / G_{\text{row}}
\]
\[
S_{\text{topslope}} = \sqrt{w_{\text{slope}}^2 + h_{\text{slope}}^2}
\]

**Geometric intent:** just below the final bind-off, remove about **1 inch of width** over about **½ inch of depth**, in two or three stepped, multi-stitch decreases that get **larger toward the top**. That steepens the curve into the shoulder.

`topsloperowlist` is a list of **stitch counts**, not row numbers. The name is misleading.

### 4.5 Working cap width

One side:

```
workingwitdh_stitches
  = (stitchcount / 2)
    − sleaveinsleave_armholestep1
    − Top_slope_decrease1 − Top_slope_decrease2 − Top_slope_decrease3
    − Final_bind_off_stitches / 2
```

\[
W = \frac{\textit{workingwitdh_stitches}}{G_{\text{sleeve}}}
\]

**Geometric intent:** after the two bind-offs and the top slope are reserved, this is the remaining **horizontal run** of the cap curve on one side — the base of the “working” right triangle.

### 4.6 Working cap perimeter and geometric height

\[
P_{\text{working}} = P - B_{\text{initial}} - S_{\text{topslope}} - B_{\text{final}}/2
\]

\[
h = \sqrt{P_{\text{working}}^2 - W^2}
\]

```
workingheight_inches = sqr((workingheight_parimater)^2 - (workingwitdh_inches)^2)
workingheight_rows   = int(workingheight_inches * rowgauge)
```

**Geometric intent:** pretend the working cap edge is a **straight hypotenuse** of length \(P_{\text{working}}\) and run \(W\). Solve for rise. That rise becomes the row budget for the three Greenline zones.

If \(P_{\text{working}} < W\), the square root is not real. ColdFusion `sqr` of a negative number fails or yields an invalid height. This is a plausible trigger for the published “formulas don’t work for this size/gauge” warning.

### 4.7 Simple cap height from bust (Step 2) — the other height

```
bust ≤ 30″  → estimated_cap = 2
bust ≤ 48″  → estimated_cap = 3
else        → estimated_cap = 4
```

Used formula:

\[
H = \textit{armhole depth} - \textit{estimated_cap}
\]

```
Total_cap_length_inches = sleaveinsleave_armholedepth - estimated_cap
Total_cap_length_rows   = Total_cap_length_inches * rowgauge
```

A discarded alternative is still in the file:

```
Total_cap_length_inches = armholedepth - (Final_bind_Off_inches / 2) - (estimated_cap / 2)
```

Comment: *“Two options for doing this we chouse the simpler one that gave a larger number.”*

So they **knew** there were two models, compared them, and kept the one that produced a **taller** cap (subtract less). `estimated_cap` here behaves as **inches subtracted from armhole depth**, not as a cap height. That matches the teaching video *Wonky Set in Sleeves* (“Why does the sleeve cap have less rows than the armhole opening?”).

`Cap_workingRows` is derived from this simple height:

```
Cap_workingRows = int(Total_cap_length_inches * rowgauge - Top_slope_rows - 2)
```

then forced even. The `2` is commented as “the first two bind rows.” **This value is never used.** A commented block would have divided a “middle section stitch count” by `Cap_workingRows`.

Pattern `endrow` is initialized as `rowcount + Total_cap_length_rows` (simple \(H\)), then later overwritten to the last instruction row actually written.

### 4.8 Point of inflection (computed, unused)

```
point_of_inflection     = Zone_1_lenght_in + Zone_2_height_in + Zone_3_height_in
point_of_inflection_row = point_of_inflection * rowgauge
```

This **adds a width to two heights**. It is not a valid single distance. It is never read again. Likely a leftover from a worksheet diagram (the “inflection” where the armhole curve becomes vertical).

### 4.9 Ease

There is no input named ease. Implicit ease / fudge appears as:

- `estimated_cap` = 2, 3, or 4 inches removed from armhole depth
- `− 0.25` on the final bind-off
- unused sizing-chart `sleeve_cap` (same numeric neighborhood as `estimated_cap` on misses)
- Greenline remainder handling that can drop or add a stitch

### 4.10 Worked numeric sketch (illustrative only)

Using round numbers to show the two heights diverging. Not a test fixture.

| Input | Value |
|---|---|
| Sleeve stitches at underarm | 70 |
| Sleeve / body gauge | 7 sts/in, 10 rows/in |
| \(N_1\), \(N_2\) | 6, 4 |
| Armhole depth | 7.5″ |
| Bust | 36″ |
| Straight armhole | 40 rows |

Results:

| Quantity | Value |
|---|---|
| Final BO | 2.25″ → 14 sts (even) |
| Top slope | decreases 2, 2, 3 (1.0″ wide, 6 rows) |
| Working width (one side) | 15 sts ≈ 2.14″ |
| Armscye \(P\) | ≈ 7.03″ |
| \(P_{\text{working}}\) | ≈ 3.88″ |
| Geometric \(h\) | ≈ 3.23″ → **32 rows** |
| Simple \(H\) | 7.5 − 3 = 4.5″ → **45 rows** |
| Unused `Cap_workingRows` | 38 |

Greenline then uses **32 rows**. The chart is pre-filled out to **45 rows**. That mismatch is in the source, not a rounding accident.

---

## 5. Shaping-zone algorithm

Comment in file: *“start key points for second GREEN TRINGLE.”* The zones are the remaining working triangle after bind-offs and top slope, split into three bands. “Greenline” / “green triangle” is worksheet language, not knitting language.

### 5.1 What Greenline_1 / 2 / 3 are

Let

- \(N_g = 2 \times \textit{workingwitdh_stitches}\) — stitches to remove **on both sides combined**
- \(R_g = \textit{workingheight_rows}\) — geometric working rows
- \(n = \operatorname{int}(N_g / 3)\)
- \(r = \operatorname{int}(R_g / 4)\)

| Zone | Stitches (both sides) | Rows | Role on the cap |
|---|---|---|---|
| **Greenline 1** | \(n\) | \(r\) | Lower cap — just above the underarm bind-off |
| **Greenline 2** | \(n\), or \(n+1\) if a remainder check fires | \(2r\), or \(2(r+1)\) if \(4r \neq R_g\) | Middle cap — longer, slower |
| **Greenline 3** | \(n\) | \(r\) | Upper working cap — just below the top slope |

Stitch remainder check **as written**:

```
if greenlinestitches * 3 neq Final_bind_off_stitches
    Greenline_2_stitches = greenlinestitches + 1
```

That compares \(3 \times \operatorname{int}(N_g/3)\) to the **final bind-off stitch count**, which is a different quantity. The natural check is \(3n \neq N_g\). As written, Greenline 2 **almost always** gets `+1` stitch, even when \(N_g\) divides evenly by 3.

Row remainder check **is** keyed to the right quantity (`greelinerows * 4 neq workingheight_rows`). Extra rows go to the **middle** band, doubled.

### 5.2 Decrease frequency

This **is** the classic sleeve-cap progression:

**faster decreases → slower decreases → faster decreases**

Because stitches are split in thirds while rows are split **¼ / ½ / ¼**:

\[
\text{rate}_1 \approx \frac{n}{r},\quad
\text{rate}_2 \approx \frac{n}{2r},\quad
\text{rate}_3 \approx \frac{n}{r}
\]

Middle band is about **half as steep** as the two ends. Then the top slope (multi-stitch decreases) is steeper still, then the final bind-off.

It is **not** “even decreases all the way,” and it is not a continuously changing curve. It is three linear tapers plus a stepped top.

### 5.3 The “magic formula” (per zone)

Identical block, run three times. Same family of math Knit it Now has always used to turn “remove \(T\) stitches over \(R\) rows, both sides” into two English instructions.

```
TaperStitchCount = Greenline_k_stitches          // both sides combined
removefromboth   = 2
RemovePerRow     = (rows / TaperStitchCount) * 2 // intended interval
step1_whole      = int(RemovePerRow)             // shorter interval
RemovePerRow_remainder = rows mod (TaperStitchCount / 2)
MagicStep2       = TaperStitchCount/2 - remainder  // times at short interval
MagicStep3       = step1_whole + 1                 // longer interval
```

**Instruction when remainder = 0**

> Decrease 1 stitch both sides every `step1_whole` rows, `MagicStep2` times

**Instruction when remainder ≠ 0**

> Decrease 1 stitch both sides every `step1_whole` rows, `MagicStep2` times  
> Decrease 1 stitch both sides every `MagicStep3` rows, `remainder` times

An inner loop writes those rows into the knit-info chart (leftremove = 1, rightremove = 1) and walks stitch counts forward to `endrow`.

This is **not** the same helper as the modern drop-shoulder `evenShapingSchedule` (`src/lib/patterns/evenShapingSchedule.ts`). The modern helper uses one interval plus leftover even rows. The legacy helper uses **two adjacent intervals** so the decreases fill the row budget more tightly. Same problem, different rounding policy.

### 5.4 Zone transitions and extra rows

Order of knitting:

1. Greenline 1  
2. Greenline 2  
3. Greenline 3  
4. **Two plain rows** (`rowcount + 1` twice) — not part of any Greenline  
5. Top slope (sorted multi-stitch decreases + knit 1 row between)  
6. Bind off remaining stitches  

There is no explicit “work even” band inside the Greenlines. Leftover rows are absorbed by the two-interval magic formula (or by the unused `Cap_workingRows` idea).

After Greenline 3 the file does **not** add 1 to `rowcount` (comment: “do not add on here”), then immediately adds two rows. Off-by-one risk at the 1/2/3 boundary.

### 5.5 Rounding behavior (summary)

| Place | Rule |
|---|---|
| Inches → stitches | `int` (truncate toward 0) |
| Odd `sleevecap_stitches` | +1 (even) |
| Odd `Final_bind_off_stitches` | −1 (even) |
| Odd `Top_slope_rows` | +1 (even) |
| Odd `Cap_workingRows` | +1 (even) — unused |
| Greenline stitches | `int(N/3)`; middle often +1 because of the wrong comparison |
| Greenline rows | `int(R/4)`; middle doubled, +2 extra if `R` not divisible by 4 |
| Magic formula interval | `int` of `(rows/stitches)*2` |
| `workingheight_rows` | `int(h * rowgauge)` — no even-forcing |

Comments that say “make this also odd” are **wrong**. Every `BitAnd(x, 1)` branch forces **even**.

### 5.6 Chart vs written instructions

Before Greenline runs, the file pre-creates `knitinfo` rows from current `rowcount` through `endrow` (simple cap height) with `action = 0`. Greenline then punches decrease rows into that grid. If geometric rows and simple rows disagree, the grid length and the decrease schedule disagree.

A few remainder-loop writes go to `pattern_#actionid#_details.RC_#n#.leftremove` (wrong struct / wrong key case) while `rightremove` goes to `knitinfo`. Left-side chart data can be missing on the second interval of each zone.

---

## 6. Numbered legacy calculation steps

The comments do **not** run in numeric order. Calculation order in the file is **4 → 3 → (perimeter) → 2 → Greenline → 1 (knit)**. Instruction order is **1 → 2 → top slope → final BO**.

| Label in file | When it runs | What it is | Knitting output |
|---|---|---|---|
| **item 10** | First | Load sizing `sleeve_cap` → stitches, force even | None (unused) |
| **Step 4** | Early calc | Final / top bind-off = sleeve width / 4 − 0.25″ | Later: “Bind off remaining stitches” |
| **Step 3 (top slope)** | Early calc | 1″-wide stepped decreases over ~½″ rows | After Greenlines: “Decrease \(k\) stitches on each side” + “Knit 1 Row” |
| *(unnumbered)* | Early calc | Four-zone armscye + working triangle | None directly |
| **Step 2** | Mid calc | Bust → `estimated_cap` → simple cap height \(H\) | Sets initial `endrow`; Greenline is the actual “middle” |
| **Middle section (Step 2)** | Knit | Pre-fill chart rows; then Greenline 1–3 | “Decrease 1 stitch both sides every \(n\) rows, \(t\) times” |
| **Step 1** / **finish step 1** | Knit (after the calcs) | Initial underarm bind-off, both sides | “Bind off \(N_1\) stitches at beginning of row” × 2 |

This looks like a **worksheet** that numbered the *parts of the sleeve cap* (1 underarm BO, 2 working cap, 3 top slope, 4 final BO), not a textbook chapter order. The code computes the top of the cap first (so remaining width is known), then knits from the bottom up.

Do **not** treat this as proof of a specific published method. It is enough structure to hold next to reference books:

- underarm matching bind-off
- three-phase working cap
- short steep top slope of fixed 1″ width
- final center bind-off ≈ ¼ of biceps minus ¼″
- cap shorter than armhole by a bust-based constant

The Knit it Now video *Paper and Pencil Charting – Modify Set in Sleeves 3* describes “a mathematical formula for determining the height of the sleeve cap and the magic formula for writing your knitting pattern.” That is the closest **in-repo** description of an external method that matches this file’s vocabulary. The CFM does not cite that video.

---

## 7. Magic numbers and questionable assumptions

Flag column: **do not carry forward without validation**.

| # | Quote / location | What it does | Purpose | Carry forward? |
|---|---|---|---|---|
| 1 | `− .25` on `Final_bind_Off_inches` | Shrinks top-of-cap width by ¼″ | Inferable as ease/fudge | **Validate.** Why ¼″, and why on width not height? |
| 2 | `/ 4` on sleeve width for final BO | Top of cap ≈ 25% of underarm width | Inferable design rule | **Validate** against reference methods (many use a fixed inch width or shoulder-related width) |
| 3 | `/ 2` in `rowgauge / 2` | Top slope is ~½″ tall | Inferable; pairs with Sue’s 1″ width | **Validate** the 1″ × ½″ rectangle |
| 4 | `stitchgauge * 2` in `Top_slope_decrease1` | First step size for splitting 1″ of stitches | Inferable but opaque | Review with the 1″ rule |
| 5 | Comment: `always ONE INCH (per sue)` | Forces top-slope width to one inch of stitches | **Sue-specific rule** | Ask Sue; do not silently keep |
| 6 | Bust brackets `30` and `48` | Pick `estimated_cap` 2 / 3 / 4 | Opaque size bands | **Do not carry.** Kids/baby/plus charts have empty `sleeve_cap`; 30″/48″ are adult-shaped |
| 7 | `estimated_cap = 2, 3, 4` | Inches subtracted from armhole depth | Inferable as “cap shorter than armhole,” but the numbers are magic | **Validate.** Chart `sleeve_cap` is in the same range and is unused |
| 8 | Discarded formula using `/ 2` on both final BO and `estimated_cap` | Would have produced a **shorter** cap | They chose the taller result | Record the choice; do not inherit “pick the larger number” |
| 9 | `− 2` in `Cap_workingRows` | Reserve the two underarm bind-off rows | Obvious, but the result is unused | Discard with the unused path |
| 10 | Zone 2 height `4` rows | Fixed 4-row body-armhole segment | Unknown why 4 | **Do not carry** without the missing armhole file |
| 11 | Zone 3 uses **the same** \(N_1\) as Zone 1 | Second diagonal run equals the initial BO | Inferable as “BO N, then dec N every other row,” but unverified | Need the armhole element |
| 12 | Greenline stitches `/ 3` | Equal stitch thirds | Classic 3-zone cap | Concept is reusable; the remainder bug is not |
| 13 | Greenline rows `/ 4` then middle `* 2` | ¼ / ½ / ¼ row split | Classic faster–slower–faster | Reusable concept |
| 14 | `greenlinestitches * 3 neq Final_bind_off_stitches` | Remainder goes to middle zone | **Looks like a bug** (wrong comparator) | **Do not carry** |
| 15 | `removefromboth = 2` | Decreases are paired (both sides) | Obvious | Fine as a knitting fact |
| 16 | Two extra plain rows after Greenline 3 | Spacer before top slope | Unknown (bind-off setup? even carriage side?) | **Ask Sue** |
| 17 | `BitAnd(..., 1)` even-forcing | Keep stitch/row counts even | Machine-knitting convention (both sides / carriage) | Concept is fine; the “odd” comments are wrong |
| 18 | Body gauge vs sleeve gauge | Armhole inches from body gauge; cap stitches from sleeve gauge | Sound if gauges can differ | Keep the *idea*; verify they ever actually differed |
| 19 | `int(...)` everywhere | Truncate, never round-to-nearest | Implementation habit | **Do not treat as design** |
| 20 | `tempinches = workingheight_rows/rowgauge` with `not right` | Unused | Matthew flagged it | Discard |
| 21 | `point_of_inflection` adds width + heights | Unused, dimensionally wrong | Debugging remnant | Discard |
| 22 | `sleevecap_endheight = 0` | Unused | Temporary | Discard |
| 23 | `step13c` in the height label | Undefined here | Leftover worksheet id? | Discard / find the parent |
| 24 | Debug `<br>` dumps of intermediates | Always printed (only the SQL dump is behind `form.debug`) | Debugging remnant | Discard |
| 25 | Hand instructions copy **machine** HTML at the end | `Hand_printedinstructions = Machine_printedinstructions` | Presentation shortcut | Discard |
| 26 | `sqr` with no guard when \(P < W\) | Invalid height | Known fragile (glossary warning) | Do not copy the failure mode |
| 27 | One armhole for front and back | Simplifying assumption | May be false for some garments | **Validate** |
| 28 | Top slope sorted **smallest → largest** | Steepens into the shoulder | Inferable | Confirm with Sue / references |
| 29 | Magic formula writes `pattern_#actionid#_details.RC_*` on some left decreases | Wrong target struct | Implementation bug | Discard |

### 7.1 Comments that show Matthew knew something was off

| Comment | Implication |
|---|---|
| `not right` (three times, on `tempinches`) | That inches reconstruction was known bad; left in place |
| `Two options... we chouse the simpler one that gave a larger number` | Cap height was chosen by comparing outputs, not by a single geometric definition |
| Commented-out `Total_cap_length` alternative | Previous formula retained as a ghost |
| Commented-out `sleavecap_middlesection_stitches / Cap_workingRows` | Earlier “one taper for the whole middle” path abandoned for Greenlines, remnants left |
| `make this also odd` on even-forcing | Copy-paste / confusion about parity |
| `look here workingheight_inches = ...` | Debug leftover, not production documentation |
| Glossary **Set-in Sleeve Warning**: some size/gauge pairs make instructions **inaccurate**; workaround is “edit dimensions slightly and rebuild” | The live system already admitted this math can fail |

---

## 8. Reusable mathematical concepts

These are **ideas**, not an instruction to keep the CFM formulas.

1. **Match the sleeve underarm bind-off to the body underarm bind-off** so those seams are the same length.
2. **Measure the body armscye as a polyline** (horizontal BO + diagonals + vertical straight) and use that length as the length the cap edge must satisfy.
3. **Reserve the non-working cap edges** (underarm BO, top slope, center BO) and solve the remaining piece as a right triangle:  
   \(h = \sqrt{P_{\text{working}}^2 - W^2}\).
4. **Make the knitted cap shorter than the armhole depth** so the sleeve can be eased in. The *Wonky Set in Sleeves* video teaches this as a feature, not a bug.
5. **Three-zone cap: faster / slower / faster**, i.e. more rows in the middle than at the ends for the same stitch count.
6. **A short, steeper “top slope”** of multi-stitch decreases just before the final bind-off (common in set-in drafting).
7. **Convert a stitch/row budget into “every \(n\) rows, \(t\) times”** (the magic-formula *problem*), preferably with a tested modern helper rather than this CFM’s remainder logic.
8. **Keep left/right stitch counts even** when both sides decrease together.
9. **Use body gauge for body edges and sleeve gauge for sleeve edges** if those gauges can differ.

---

## 9. Legacy concepts we should probably discard

- ColdFusion query / `cfoutput` / `cfsavecontent` / dynamic `pattern_#id#` structs
- Variable names (`sleaveinsleave_*`, `workingwitdh`, `parimaterlength`, `greelinerows`, `Setinsleave`)
- Debug HTML dumped into the pattern
- Dual, disagreeing cap heights (`h` vs \(H\)) used for different purposes
- Unused `sleeve_cap` chart load sitting beside a hard-coded bust table
- Wrong Greenline stitch remainder comparison
- `point_of_inflection` that adds inches of width to inches of height
- `Cap_workingRows` and the commented “one middle taper” path
- `not right` `tempinches`
- Comments that say “odd” while the code forces even
- Truncation-as-policy (`int` everywhere) without a stated knitting reason
- Bust thresholds 30 / 48 and magic 2 / 3 / 4 as if they were measurements
- Hard-coded Zone 2 = 4 rows, copied without the armhole source
- Chart writes into the wrong struct on remainder intervals
- Hand instructions aliased to machine instructions
- “Pick the formula that gave a larger number”
- Generating a pattern that the glossary already describes as inaccurate, then asking the knitter to nudge measurements

The current modern armhole Lego (`armholeShaping.ts` / `armholeBlock.ts`) is a **different, simpler** body armhole. It should not be assumed to be the missing “other piece” that fed this file.

---

## 10. Related files discovered

Searched the repo for `setinsleeve.cfm`, `Greenline_1/2/3`, `sleaveinsleave_*`, other set-in CFMs, diagrams, worksheets, tests, and algorithm comments.

### 10.1 Primary / only legacy calculator

| File | Why it matters |
|---|---|
| `src/pages/downloads/setinsleeve.cfm` | The entire engine analyzed here. **Only** `.cfm` in the repo that calculates a set-in sleeve. The other `.cfm` is unrelated glossary admin. |

No other ColdFusion set-in or armhole calculator is in this repository. The parent that sets `sleaveinsleave_*` is missing.

### 10.2 Sizing data the CFM queries

| File | Why it matters |
|---|---|
| `public/data/sizing_sweaters_misses.json` | `sleeve_cap` 2.5–3.5″; also `armhole_depth`, `upper_arm`, `wrist`, `sleeve_length`, `bust_or_chest` |
| `public/data/sizing_sweaters_men.json` | `sleeve_cap` 4.25–5″ |
| `public/data/sizing_sweaters_kids.json` | `sleeve_cap` empty |
| `public/data/sizing_sweaters_baby.json` | `sleeve_cap` empty |
| `public/data/sizing_sweaters_plus.json` | `sleeve_cap` empty |
| `src/pages/reference/sizing-charts.astro` | Treats `sleeve_cap` as a known sweater-chart key |

### 10.3 Published admission that the math fails

| File | Why it matters |
|---|---|
| `src/data/glossary.json` (id 593, “Set-in Sleeve Warning”) | Short version: size + upper arm + armhole depth + gauge can break the formulas; instructions still generate but are inaccurate |
| `src/data/glossary_original.json` | Fuller HTML; references `/images/sleeve_cap.png` and `/images/sleeve_cap.jpg` (**those image files are not in the repo**) |
| `data/glossary_export.json` | Same warning text |
| `docs/dev/glossary-reference.md` | Index row for the warning term |

### 10.4 Teaching material (method vocabulary, not this CFM)

| File | Why it matters |
|---|---|
| `src/data/videos-public.json` — *Paper and Pencil Charting – Modify Set in Sleeves 1–4* | Part 3: cap **height formula** + **magic formula**. Closest named method. |
| Same file — *Wonky Set in Sleeves* | Why the cap has fewer rows than the armhole |
| Same file — *Set In Sleeve Perfection* | Finishing / skill, not drafting math |
| Same file — *Top Down Set In Sleeves* | Different construction (short-row join); not this calculator |
| `src/data/legacy_kin/cleaned/course_15_set_in_sleeve_perfection.poc.json` | Course export for the finishing class |
| `src/data/legacy_kin/exports/kin-legacy-course-index.csv` | Lists that course |

### 10.5 Modern pattern-system pieces (related domain, different math)

| File | Why it matters |
|---|---|
| `src/lib/patterns/legoBlocks/armholeShaping.ts` | Current body armhole: BO ≈ half, then every-other-row. **Not** the four-zone legacy armhole. |
| `src/lib/patterns/legoBlocks/armholeBlock.ts` | Written instructions for that modern armhole |
| `src/lib/patterns/legoBlocks/vNeckline.ts` | Comments that set-in / drop / cardigan will share neckline inputs |
| `src/lib/patterns/evenShapingSchedule.ts` | Modern “every \(n\) rows, \(t\) times” helper (one interval + leftover even rows) |
| `src/pages/patterns/index.astro` | Set-In Sleeve Sweater is listed as **coming soon** |
| `public/images/patterns/set-in-sleeve/set-in-kids-pullover-round-neck.webp` | Marketing image only |
| `docs/lego-blocks.md` | Lego inventory; no set-in sleeve block yet |
| `docs/pattern-system-standards.md` | How a future system should be tested (math first) |
| Drop-shoulder sleeve files (`dropShoulderSleeveShaping.ts`, diagrams, `.cursor/skills/drop-body-sleeve`) | Straight upper-arm bind-off, **no cap**. Do not confuse `jp-sleeve_cap_sts` with this algorithm. |
| Sleeveless armhole output / `customBuildEffectiveArmholeDepth.ts` | Armhole **depth** for sleeveless garments, not set-in caps |

### 10.6 Not found

- No tests for `setinsleeve.cfm`
- No SVG / worksheet of the green triangle
- No second CFM that defines `sleaveinsleave_armholestep1` or `sleaveinsleave_step_6_2s`
- No in-repo comment that names the reference book or worksheet
- `/images/sleeve_cap.png` and `/images/sleeve_cap.jpg` (linked from the glossary, files absent)

---

## 11. Open questions requiring Sue’s knitting / design knowledge

1. **What is sizing-chart `sleeve_cap`?** Cap height, cap ease (amount shorter than the armhole), top-of-cap width, or something else? Why is it loaded as “item 10” and then ignored?
2. **Is `estimated_cap` (2 / 3 / 4″ by bust) the same idea as chart `sleeve_cap`?** Should a new system use the chart, the bust table, a measured ease, or a drafted relationship to shoulder / upper arm?
3. **Confirm the body armhole recipe** implied by Zones 1–4, especially: why Zone 3 reuses the initial bind-off stitch count, and why Zone 2 is always 4 rows. Where is that armhole element / worksheet?
4. **Are front and back armholes allowed to differ** on a Knit it Now set-in sweater? This file assumes no.
5. **Is the top slope always 1 inch wide and about ½ inch tall**, regardless of size and gauge? (“per sue”)
6. **Is final top width really “¼ of biceps minus ¼ inch”?** Or should it relate to shoulder width / neck drop?
7. **Which cap height is the one that was supposed to be correct** — Pythagorean \(h\), simple \(H = \text{armhole} - \text{estimated_cap}\), or the discarded hybrid? Knitters were warned they can disagree with reality.
8. **What were the green triangles on the worksheet?** Is Greenline 2 literally a second triangle drawn on a paper chart?
9. **Do the numbered Steps 1–4 / item 10 / step 13c match a paper worksheet Sue still has?** If yes, that sheet is the missing spec for the parent armhole file.
10. **The two plain rows after Greenline 3** — carriage-side, bind-off setup, or leftover?
11. **When the warning fired**, what did the bad instruction look like (every 0 rows, negative height, leftover stitches ≠ final BO)? That would confirm the \(P < W\) and remainder-bug hypotheses.
12. **Did body and sleeve gauges ever differ** in the live engine, or is the dual-gauge conversion unused in practice?
13. **Paper-and-pencil series vs this CFM:** is the CFM an implementation of that class, a later automation of it, or a different Matthew construction that only shares the “magic formula” name?

---

## Appendix A. Knitting-instruction sequence (as generated)

1. Bind off \(N_1\) at beginning of row. (side 1)
2. Bind off \(N_1\) at beginning of row. (side 2)
3. Greenline 1: one or two “Decrease 1 stitch both sides every \(n\) rows, \(t\) times”
4. Greenline 2: same
5. Greenline 3: same
6. Two unlabelled knit rows (chart only)
7. For each top-slope step, smallest to largest: “Decrease \(k\) stitches on each side” then “Knit 1 Row”
8. “Bind off remaining stitches”

Machine and hand tables are built in parallel during Step 1 and the top slope; during Greenlines a single `cfsavecontent` writes into `Machine_printedinstructions` and may embed the previous hand or machine block depending on `form.typeofpattern`. At the end, hand is **replaced** by the machine block.

## Appendix B. Variable-name map (legacy → plain English)

| Legacy name | Plain English |
|---|---|
| `sleaveinsleave_armholestep1` | Body/sleeve matching underarm bind-off, one side |
| `sleaveinsleave_step_6_2s` | Body armhole segment 2, stitch run |
| `parimaterlength` | One-side armscye length (polyline) |
| `workingheight_parimater` | Remaining armscye length assigned to the working cap |
| `workingwitdh_stitches` | One-side remaining cap width in stitches |
| `workingheight_inches` | Pythagorean cap height of the working triangle |
| `estimated_cap` | Inches subtracted from armhole depth (not a measured cap) |
| `Total_cap_length_inches` | Simple cap height \(H\) |
| `Greenline_1/2/3` | Lower / middle / upper working-cap decrease bands |
| `topslope_*` | Stepped 1-inch finish into the final bind-off |
| `Final_bind_Off_*` | Designed top-of-cap width |
| `MagicStep2` / `MagicStep3` | Times-at-short-interval / long-interval for paired decreases |

---

*End of research document. No new implementation is proposed here.*
