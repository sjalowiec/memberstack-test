export type TriangleUnit = "in" | "cm";

export interface TriangleScarfInputs {
  width: number;
  length: number;
  stitchGauge: number;
  rowGauge: number;
  needles: number;
  unit: TriangleUnit;
}

export interface ShapingPhaseResult {
  action: "increase" | "decrease";
  stitches: number;
  rows: number;
  times: number;
  side: string;
  leftoverRows: number;
}

export interface TriangleScarfOk {
  ok: true;
  method: "wide-to-point" | "point-wide-point";
  /** Widest stitch count used in instructions (cast-on or center width). */
  widestStitches: number;
  totalRows: number;
  castOnStitches?: number;
  centerStitches?: number;
  /** Method 2: min(width, needles) before forcing odd for paired-edge repeats. */
  centerRawStitches?: number;
  /** Method 2: true when center was reduced by 1 to stay odd for paired-edge math. */
  centerAdjusted?: boolean;
  castOnAdjusted: boolean;
  phases: ShapingPhaseResult[];
  summary: {
    widestStitchCount: number;
    totalRows: number;
    knittingMethodLabel: string;
  };
}

export interface TriangleScarfErr {
  ok: false;
  message: string;
}

export type TriangleScarfResult = TriangleScarfOk | TriangleScarfErr;

/** Parse shareable URL query (?w=&l=&sg=&rg=&n=&u=in|cm). */
export function parseTriangleScarfSearchParams(searchParams: URLSearchParams): TriangleScarfInputs | null {
  const w = parseFloat(String(searchParams.get("w") ?? ""));
  const l = parseFloat(String(searchParams.get("l") ?? ""));
  const sg = parseFloat(String(searchParams.get("sg") ?? ""));
  const rg = parseFloat(String(searchParams.get("rg") ?? ""));
  const n = parseInt(String(searchParams.get("n") ?? ""), 10);
  const uRaw = String(searchParams.get("u") ?? "in").toLowerCase();
  const unit: TriangleUnit = uRaw === "cm" ? "cm" : "in";

  if (!Number.isFinite(w) || !Number.isFinite(l) || !Number.isFinite(sg) || !Number.isFinite(rg)) {
    return null;
  }
  if (!Number.isFinite(n)) {
    return null;
  }
  return { width: w, length: l, stitchGauge: sg, rowGauge: rg, needles: n, unit };
}

const LEFTOVER_LINE = "Then work remaining rows as established.";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildTriangleScarfPatternHtml(result: TriangleScarfOk): string {
  const summary = `
<div class="ts-pattern-summary">
  <h3 class="ts-pattern-summary__title">Summary</h3>
  <ul class="ts-pattern-summary__list">
    <li><strong>Widest stitch count:</strong> ${result.summary.widestStitchCount}</li>
    <li><strong>Total rows:</strong> ${result.summary.totalRows}</li>
    <li><strong>Knitting method:</strong> ${escapeHtml(result.summary.knittingMethodLabel)}</li>
  </ul>
</div>`;

  if (result.method === "wide-to-point") {
    const cast = result.castOnStitches ?? result.widestStitches;
    const p0 = result.phases[0];
    const adj =
      result.castOnAdjusted && result.castOnStitches
        ? `<p class="ts-cast-note">The cast-on was adjusted to <strong>${result.castOnStitches}</strong> stitches (odd count) so paired edge decreases can end at one stitch.</p>`
        : "";

    const leftover =
      p0.leftoverRows > 0 ? `<p class="ts-leftover-line">${escapeHtml(LEFTOVER_LINE)}</p>` : "";

    return `
<div class="ts-pattern-body">
  ${summary}
  <div class="ts-instructions-block ts-big-picture">
    <p>This scarf is worked from the widest edge down to a point.</p>
    <p>Decreases are worked on both edges to shape the triangle.</p>
  </div>
  <div class="ts-instructions-block ts-pattern-steps">
    <p>Cast on <strong>${cast}</strong> stitches across the needle bed.</p>
    <p>Decrease on each edge as directed.</p>
    <p>Continue until 1 stitch remains.</p>
    <p>Bind off.</p>
    ${adj}
  </div>
  ${renderShapingInstructionHtml({
    action: "decrease",
    stitches: 1,
    rows: p0.rows,
    times: p0.times,
    side: "each edge",
  })}
  ${leftover}
</div>`.trim();
  }

  const center = result.centerStitches ?? result.widestStitches;
  const inc = result.phases[0];
  const dec = result.phases[1];

  const centerNote =
    result.centerAdjusted && result.centerRawStitches !== undefined
      ? `<p class="ts-cast-note">The widest stitch count was set to <strong>${center}</strong> stitches (odd) so paired edge increases/decreases match the shaping repeats. Target from gauge and needles was <strong>${result.centerRawStitches}</strong>.</p>`
      : "";

  const afterInc =
    inc.leftoverRows > 0 ? `<p class="ts-leftover-line">${escapeHtml(LEFTOVER_LINE)}</p>` : "";
  const afterDec =
    dec.leftoverRows > 0 ? `<p class="ts-leftover-line">${escapeHtml(LEFTOVER_LINE)}</p>` : "";

  return `
<div class="ts-pattern-body">
  ${summary}
  <div class="ts-instructions-block ts-big-picture">
    <p>This scarf is worked from one point to the center, then back to a point.</p>
    <p>Increases shape the first half of the scarf, then decreases complete the second half.</p>
  </div>
  <div class="ts-instructions-block ts-pattern-steps">
    <p>Start with <strong>1</strong> stitch.</p>
    <p>Increase on <strong>each edge</strong> as directed until you reach <strong>${center}</strong> stitches at the wide row.</p>
    <p>Then decrease on <strong>each edge</strong> as directed until <strong>1</strong> stitch remains.</p>
    <p>Bind off.</p>
    ${centerNote}
  </div>
  ${renderShapingInstructionHtml({
    action: "increase",
    stitches: 1,
    rows: inc.rows,
    times: inc.times,
    side: "each edge",
    label: "Shaping Instructions (first half)",
  })}
  ${afterInc}
  ${renderShapingInstructionHtml({
    action: "decrease",
    stitches: 1,
    rows: dec.rows,
    times: dec.times,
    side: "each edge",
    label: "Shaping Instructions (second half)",
  })}
  ${afterDec}
</div>`.trim();
}

function stitchesPerUnit(stitchGauge: number, unit: TriangleUnit): number {
  return stitchGauge / (unit === "cm" ? 10 : 4);
}

function rowsPerUnit(rowGauge: number, unit: TriangleUnit): number {
  return rowGauge / (unit === "cm" ? 10 : 4);
}

/** Uniform spacing: same interval every time; remainder rows worked even afterward. */
export function uniformShaping(totalRowsForPhase: number, times: number): { interval: number; leftoverRows: number } {
  if (times <= 0) {
    return { interval: 1, leftoverRows: Math.max(0, totalRowsForPhase) };
  }
  const interval = Math.max(1, Math.floor(totalRowsForPhase / times));
  const leftoverRows = Math.max(0, totalRowsForPhase - interval * times);
  return { interval, leftoverRows };
}

export function calculateTriangleScarf(input: TriangleScarfInputs): TriangleScarfResult {
  const { width, length, stitchGauge, rowGauge, needles, unit } = input;

  if (!Number.isFinite(width) || width <= 0) {
    return { ok: false, message: "Enter a finished width greater than zero." };
  }
  if (!Number.isFinite(length) || length <= 0) {
    return { ok: false, message: "Enter a finished length (depth) greater than zero." };
  }
  if (!Number.isFinite(stitchGauge) || stitchGauge <= 0) {
    return { ok: false, message: "Enter stitch gauge (stitches per 4″ or per 10 cm)." };
  }
  if (!Number.isFinite(rowGauge) || rowGauge <= 0) {
    return { ok: false, message: "Enter row gauge (rows per 4″ or per 10 cm)." };
  }
  if (!Number.isFinite(needles) || needles < 50 || needles > 400) {
    return { ok: false, message: "Enter available needles (50–400), matching your machine bed." };
  }

  const su = stitchesPerUnit(stitchGauge, unit);
  const ru = rowsPerUnit(rowGauge, unit);

  const widthStitches = Math.round(width * su);
  const totalRows = Math.max(1, Math.round(length * ru));

  if (widthStitches < 2) {
    return { ok: false, message: "Finished width is too small for this stitch gauge." };
  }

  // Method 1 — Wide → Point (full width fits on the bed at cast-on).
  if (widthStitches <= needles) {
    let castOn = widthStitches;
    let adjusted = false;
    if (castOn > 1 && castOn % 2 === 0) {
      castOn -= 1;
      adjusted = true;
    }

    const times = Math.floor((castOn - 1) / 2);
    if (times < 1) {
      return { ok: false, message: "Could not derive shaping from these dimensions." };
    }
    if (times > totalRows) {
      return {
        ok: false,
        message:
          "Not enough rows for this width at your gauge. Increase finished length or reduce width.",
      };
    }

    const { interval, leftoverRows } = uniformShaping(totalRows, times);

    return {
      ok: true,
      method: "wide-to-point",
      widestStitches: castOn,
      totalRows,
      castOnStitches: castOn,
      castOnAdjusted: adjusted,
      phases: [
        {
          action: "decrease",
          stitches: 1,
          rows: interval,
          times,
          side: "each edge",
          leftoverRows,
        },
      ],
      summary: {
        widestStitchCount: castOn,
        totalRows,
        knittingMethodLabel: "Wide → Point",
      },
    };
  }

  // Method 2 — Point → Wide → Point (widest row needs more needles than the bed holds at once).
  //
  // NOTATION (same as Wide→Point): ShapingInstructionBlock uses stitches=1, side="each edge".
  // That means one stitch changed at each edge per repeat → net Δ = ±2 stitches on the piece per repeat.
  //
  // Increase half: start = 1. After k paired-edge repeats: stitchCount = 1 + 2*k.
  // So target center C must be odd, and k = (C - 1) / 2 paired repeats (shown as `times` in notation).
  //
  // Decrease half: from C to 1 requires the same k repeats (−2 stitches per repeat).
  //
  // DEV sanity (inline):
  //   startStitches = 1
  //   stitchesAddedPerRepeat = 2   (1 at each edge)
  //   pairedRepeats = (center - 1) / 2
  //   resultingCenter = 1 + 2 * pairedRepeats === center (odd)

  const rawCenter = Math.min(widthStitches, needles);
  let center = rawCenter;
  let centerAdjusted = false;
  if (center > 1 && center % 2 === 0) {
    center -= 1;
    centerAdjusted = true;
  }

  if (center < 3) {
    return {
      ok: false,
      message:
        "Center stitch count is too small for paired-edge shaping. Widen the finished width or use more needles.",
    };
  }

  const pairedRepeats = (center - 1) / 2;

  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    const startStitches = 1;
    const stitchesDeltaPerRepeat = 2;
    console.assert(
      Number.isInteger(pairedRepeats) && pairedRepeats >= 1,
      "[triangle scarf] pairedRepeats must be a positive integer"
    );
    console.assert(
      startStitches + stitchesDeltaPerRepeat * pairedRepeats === center,
      `[triangle scarf] Point→Wide→Point: 1 + 2*${pairedRepeats} must equal center ${center}`
    );
  }

  const rInc = Math.floor(totalRows / 2);
  const rDec = totalRows - rInc;

  if (pairedRepeats > rInc || pairedRepeats > rDec) {
    return {
      ok: false,
      message:
        "Not enough rows for this width at your gauge. Increase finished length or reduce width.",
    };
  }

  const uInc = uniformShaping(rInc, pairedRepeats);
  const uDec = uniformShaping(rDec, pairedRepeats);

  return {
    ok: true,
    method: "point-wide-point",
    widestStitches: center,
    totalRows,
    centerStitches: center,
    centerRawStitches: rawCenter,
    centerAdjusted,
    castOnAdjusted: false,
    phases: [
      {
        action: "increase",
        stitches: 1,
        rows: uInc.interval,
        times: pairedRepeats,
        side: "each edge",
        leftoverRows: uInc.leftoverRows,
      },
      {
        action: "decrease",
        stitches: 1,
        rows: uDec.interval,
        times: pairedRepeats,
        side: "each edge",
        leftoverRows: uDec.leftoverRows,
      },
    ],
    summary: {
      widestStitchCount: center,
      totalRows,
      knittingMethodLabel: "Point → Wide → Point",
    },
  };
}

/** Mirrors ShapingInstructionBlock.astro markup for dynamic results. */
export function renderShapingInstructionHtml(props: {
  action: "increase" | "decrease";
  stitches: number;
  rows: number;
  times: number;
  side: string;
  label?: string;
  compact?: boolean;
}): string {
  const label = props.label ?? "Shaping Instructions";

  function formatEdgeClause(sideInput: string): string {
    let raw = sideInput.trim();
    if (raw.toLowerCase().startsWith("the ")) {
      raw = raw.slice(4).trim();
    }
    const lower = raw.toLowerCase();
    if (lower === "each edge" || lower === "both edges") {
      return "on each edge";
    }
    return `on the ${raw}`;
  }

  const edgeClause = formatEdgeClause(props.side);
  const stitchWord = props.stitches === 1 ? "stitch" : "stitches";
  const rowClause = props.rows === 1 ? "every row" : `every ${props.rows} rows`;
  const timeWord = props.times === 1 ? "time" : "times";
  const verb = props.action === "increase" ? "Increase" : "Decrease";
  const instructionSentence = `${verb} ${props.stitches} ${stitchWord} ${edgeClause} ${rowClause}, ${props.times} ${timeWord}`;
  const actionVerbLower = props.action === "increase" ? "increase" : "decrease";
  const tooltipText = [
    "Shaping format (stitches, rows, times).",
    `Example: (${props.stitches}, ${props.rows}, ${props.times}) = ${actionVerbLower} ${props.stitches} ${stitchWord} ${rowClause}, ${props.times} ${timeWord}.`,
  ].join(" ");
  const notation = `(${props.stitches}, ${props.rows}, ${props.times})`;

  const rootClass = ["shaping-instruction-block", props.compact ? "shaping-instruction-block--compact" : ""]
    .filter(Boolean)
    .join(" ");

  const labelHtml =
    label.trim().length > 0
      ? `<div class="shaping-instruction-block__label">${escapeHtml(label)}</div>`
      : "";

  const svgIcon = `<svg class="shaping-instruction-block__help-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 7zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" /></svg>`;

  return `
<div class="${rootClass}">
  ${labelHtml}
  <p class="shaping-instruction-block__sentence">${escapeHtml(instructionSentence)}</p>
  <p class="shaping-instruction-block__notation-row">
    <code class="shaping-instruction-block__notation">${escapeHtml(notation)}</code>
    <span class="tooltip tooltip-term tooltip--top" tabindex="0">
      <span class="tooltip-trigger">
        <span class="shaping-instruction-block__help" tabindex="0" aria-label="About shaping notation">${svgIcon}</span>
      </span>
      <span class="tooltip-text" role="tooltip">${escapeHtml(tooltipText)}</span>
    </span>
  </p>
</div>`.trim();
}
