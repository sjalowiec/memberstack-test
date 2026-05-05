/**
 * Round Front Neckline — lego block
 *
 * Single responsibility: given neck stitches, available rows, and starting RC,
 * calculate the shaping and return numbers + instructions.
 *
 * Shaping formula (Alternate Round Neckline):
 *   Step 1 — bind off ~1/3 of neck stitches at center (one time)
 *   Step 2 — decrease 1 st each side every row (steep, near center)
 *   Step 3 — decrease 1 st each side every other row (gradual, near shoulder)
 *   Step 4 — knit straight on shoulder stitches until shoulder shaping
 *
 * This output is the single source of truth for:
 *   - written pattern instructions
 *   - the row-by-row chart table
 *   - the SVG shape diagram
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RoundFrontNecklineInputs = {
  /** Total neck opening width in stitches (N). */
  necklineStitches: number;
  /** Rows available for the full front neck section (depth × row gauge). */
  neckDepthRows: number;
  /** RC at which the center bind-off happens. */
  startRC: number;
  /** Stitches remaining on each shoulder after all neck shaping (for reference/display). */
  shoulderStitchesPerSide: number;
};

export type NecklineChartRow = {
  rc: number;
  action: "centerBindOff" | "steepDecrease" | "gradualDecrease" | "straight";
  /** Stitches decreased at left neck edge this row (0 if none). */
  leftNeckDecrease: number;
  /** Stitches decreased at right neck edge this row (0 if none). */
  rightNeckDecrease: number;
  /** Remaining stitches on left shoulder section after this row. */
  leftStitches: number;
  /** Remaining stitches on right shoulder section after this row. */
  rightStitches: number;
};

export type RoundFrontNecklineResult = {
  // --- Shaping numbers (source of truth) ---
  /** Stitches bound off at center on startRC. */
  centerBindOff: number;
  /** Stitches decreased per side in the steep phase (every row). */
  steepStitchesPerSide: number;
  /** Number of rows in the steep phase. */
  steepRows: number;
  /** Stitches decreased on the left side in the gradual phase (every other row). */
  gradualStitchesLeft: number;
  /** Stitches decreased on the right side in the gradual phase (every other row). */
  gradualStitchesRight: number;
  /** Number of rows in the gradual phase (including plain rows between decreases). */
  gradualRows: number;
  /** Rows of plain knitting after all neck shaping, before shoulder shaping. */
  straightRows: number;
  /** Total rows consumed (should equal neckDepthRows). */
  totalRows: number;
  /** RC of the first steep decrease row. */
  steepStartRC: number;
  /** RC of the first gradual decrease row. */
  gradualStartRC: number;
  /** RC of the first straight row (after all neck shaping). */
  straightStartRC: number;

  // --- Row-by-row chart (drives table + SVG) ---
  chartRows: NecklineChartRow[];

  // --- Written instructions ---
  instructions: string[];

  // --- Warnings ---
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rcLabel(rc: number): string {
  return `RC: ${rc}`;
}

function formatRC(start: number, end?: number): string {
  if (end === undefined || end === start) return `RC: ${start}`;
  return `RC: ${start}–${end}`;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function calculateRoundFrontNeckline(
  inputs: RoundFrontNecklineInputs
): RoundFrontNecklineResult {
  const { necklineStitches: N, neckDepthRows, startRC, shoulderStitchesPerSide } = inputs;

  const warnings: string[] = [];

  // --- Validate ---
  if (N <= 0 || !Number.isFinite(N)) {
    warnings.push("necklineStitches must be a positive number.");
  }
  if (neckDepthRows <= 0 || !Number.isFinite(neckDepthRows)) {
    warnings.push("neckDepthRows must be a positive number.");
  }

  // --- Step 1: Center bind-off (~1/3 of N, matching parity of N) ---
  let centerBindOff = Math.round(N / 3);
  // Match parity so remainder splits evenly to both sides
  if (centerBindOff % 2 !== N % 2) centerBindOff += 1;
  centerBindOff = Math.max(1, Math.min(centerBindOff, N - 2));

  const remaining = N - centerBindOff; // stitches to shape at neck edges

  // Split remaining to left and right (within 1 stitch if odd)
  const rightSideTotal = Math.ceil(remaining / 2);
  const leftSideTotal = Math.floor(remaining / 2);

  // --- Step 2 & 3: Split side stitches into steep and gradual phases ---
  // Steep (every row): ~half of side total
  // Gradual (every other row): remaining
  const steepStitchesPerSide = Math.round(rightSideTotal / 2); // use heavier side
  const steepRows = steepStitchesPerSide; // 1 st per row

  const gradualStitchesRight = rightSideTotal - steepStitchesPerSide;
  const gradualStitchesLeft = leftSideTotal - steepStitchesPerSide;
  const gradualRows = gradualStitchesRight * 2; // every other row (use heavier side)

  // --- Straight rows (post-center rows only: steep + gradual + straight = neckDepthRows - 1) ---
  const postCenterRows = neckDepthRows - 1;
  const shapingRows = steepRows + gradualRows;
  const straightRows = Math.max(0, postCenterRows - shapingRows);

  const totalRows = neckDepthRows;

  if (postCenterRows !== shapingRows + straightRows) {
    warnings.push(
      `Row count mismatch: post-center rows ${postCenterRows} but steep+gradual+straight = ${shapingRows + straightRows}.`
    );
  }

  // --- RC boundaries ---
  const steepStartRC = startRC + 1;
  const gradualStartRC = steepStartRC + steepRows;
  const straightStartRC = gradualStartRC + gradualRows;

  // --- Build chart rows ---
  const chartRows: NecklineChartRow[] = [];

  // Starting stitch count per side = shoulder sts + all side neck sts to be removed
  let leftSts = shoulderStitchesPerSide + leftSideTotal;
  let rightSts = shoulderStitchesPerSide + rightSideTotal;

  // Row 0: center bind-off
  chartRows.push({
    rc: startRC,
    action: "centerBindOff",
    leftNeckDecrease: 0,
    rightNeckDecrease: 0,
    leftStitches: leftSts,
    rightStitches: rightSts,
  });

  // Steep phase: 1 st each side every row
  for (let i = 0; i < steepRows; i++) {
    const rc = steepStartRC + i;
    leftSts -= 1;
    rightSts -= 1;
    chartRows.push({
      rc,
      action: "steepDecrease",
      leftNeckDecrease: 1,
      rightNeckDecrease: 1,
      leftStitches: leftSts,
      rightStitches: rightSts,
    });
  }

  // Gradual phase: 1 st each side every other row
  // (action rows + plain rows interleaved)
  const maxGradualSts = Math.max(gradualStitchesLeft, gradualStitchesRight);
  for (let i = 0; i < gradualRows; i++) {
    const rc = gradualStartRC + i;
    const isActionRow = i % 2 === 0;
    const actionIndex = Math.floor(i / 2);

    const leftDec = isActionRow && actionIndex < gradualStitchesLeft ? 1 : 0;
    const rightDec = isActionRow && actionIndex < gradualStitchesRight ? 1 : 0;

    leftSts -= leftDec;
    rightSts -= rightDec;

    if (leftDec > 0 || rightDec > 0) {
      chartRows.push({
        rc,
        action: "gradualDecrease",
        leftNeckDecrease: leftDec,
        rightNeckDecrease: rightDec,
        leftStitches: leftSts,
        rightStitches: rightSts,
      });
    }
    // Plain rows between decreases are not charted individually
    // (knitter works plain on those rows)
  }

  // Straight rows: just first and last for reference
  if (straightRows > 0) {
    chartRows.push({
      rc: straightStartRC,
      action: "straight",
      leftNeckDecrease: 0,
      rightNeckDecrease: 0,
      leftStitches: leftSts,
      rightStitches: rightSts,
    });
  }

  // --- Sanity check: remaining sts should equal shoulderStitchesPerSide ---
  if (leftSts !== shoulderStitchesPerSide) {
    warnings.push(
      `Left stitch count after shaping is ${leftSts}, expected ${shoulderStitchesPerSide}. Check side neck stitch distribution.`
    );
  }
  if (rightSts !== shoulderStitchesPerSide) {
    warnings.push(
      `Right stitch count after shaping is ${rightSts}, expected ${shoulderStitchesPerSide}. Check side neck stitch distribution.`
    );
  }

  // --- Build written instructions ---
  const instructions: string[] = [];

  instructions.push(`${rcLabel(startRC)}. Bind off center ${centerBindOff} stitches.`);
  instructions.push(
    `You now have ${leftSts + leftSideTotal} stitches on the left and ${rightSts + rightSideTotal} stitches on the right.`
  );
  instructions.push(`Work each shoulder separately.`);
  instructions.push(``);

  // Steep phase
  instructions.push(
    `${formatRC(steepStartRC, steepStartRC + steepRows - 1)}. ` +
    `At neck edge, decrease 1 stitch every row, ${steepRows} times (${steepRows} rows). ` +
    `${steepStitchesPerSide} stitches removed per side.`
  );

  // Gradual phase
  const gradualEndRC = gradualStartRC + gradualRows - 1;
  if (gradualStitchesLeft === gradualStitchesRight) {
    instructions.push(
      `${formatRC(gradualStartRC, gradualEndRC)}. ` +
      `At neck edge, decrease 1 stitch every other row, ${gradualStitchesRight} times (${gradualRows} rows). ` +
      `${gradualStitchesRight} stitches removed per side.`
    );
  } else {
    instructions.push(
      `${formatRC(gradualStartRC, gradualEndRC)}. ` +
      `At neck edge, decrease 1 stitch every other row — ` +
      `${gradualStitchesLeft} times on the left, ${gradualStitchesRight} times on the right (${gradualRows} rows).`
    );
  }

  instructions.push(``);
  instructions.push(
    `${shoulderStitchesPerSide} stitches remain on each shoulder.`
  );

  if (straightRows > 0) {
    instructions.push(
      `${formatRC(straightStartRC, straightStartRC + straightRows - 1)}. ` +
      `Knit straight for ${straightRows} rows.`
    );
  }

  instructions.push(`Continue to shoulder shaping.`);

  // --- Stitch identity check ---
  const stitchCheck =
    centerBindOff + leftSideTotal + rightSideTotal;
  if (stitchCheck !== N) {
    warnings.push(
      `Stitch identity failed: center(${centerBindOff}) + left(${leftSideTotal}) + right(${rightSideTotal}) = ${stitchCheck}, expected ${N}.`
    );
  }

  return {
    centerBindOff,
    steepStitchesPerSide,
    steepRows,
    gradualStitchesLeft,
    gradualStitchesRight,
    gradualRows,
    straightRows,
    totalRows,
    steepStartRC,
    gradualStartRC,
    straightStartRC,
    chartRows,
    instructions,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Quick verification with your real numbers
// ---------------------------------------------------------------------------

export function verifyWithRealNumbers(): void {
  const result = calculateRoundFrontNeckline({
    necklineStitches: 53,
    neckDepthRows: 55,
    startRC: 247,
    shoulderStitchesPerSide: 38,
  });

  console.log("=== Round Front Neckline — Verification ===");
  console.log(`Center bind-off:     ${result.centerBindOff} sts`);
  console.log(`Steep phase:         ${result.steepStitchesPerSide} sts/side × ${result.steepRows} rows (every row)`);
  console.log(`Gradual phase left:  ${result.gradualStitchesLeft} sts × ${result.gradualRows} rows (every other row)`);
  console.log(`Gradual phase right: ${result.gradualStitchesRight} sts × ${result.gradualRows} rows (every other row)`);
  console.log(`Straight rows:       ${result.straightRows}`);
  console.log(`Total rows:          ${result.totalRows} (expected 55)`);
  console.log(`Steep RC:            ${result.steepStartRC}–${result.steepStartRC + result.steepRows - 1}`);
  console.log(`Gradual RC:          ${result.gradualStartRC}–${result.gradualStartRC + result.gradualRows - 1}`);
  console.log(`Straight RC:         ${result.straightStartRC}–${result.straightStartRC + result.straightRows - 1}`);
  console.log(``);
  console.log("--- Instructions ---");
  result.instructions.forEach((line) => console.log(line));
  console.log(``);
  if (result.warnings.length > 0) {
    console.log("--- Warnings ---");
    result.warnings.forEach((w) => console.log("⚠️ ", w));
  } else {
    console.log("✅ No warnings.");
  }
}
