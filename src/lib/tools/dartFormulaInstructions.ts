/**
 * HTML instruction rendering for the standalone Dart Formula tool.
 * Uses {@link computeDartShaping} results; does not recalculate dart math.
 */
import type { DartShapingSuccess } from "./dartFormulaMath";

function timesWord(n: number): string {
  return n === 1 ? "time" : "times";
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatGaugeLabel(unit: "in" | "cm"): string {
  return unit === "cm" ? "10 cm" : '4"';
}

function formatDepthLabel(unit: "in" | "cm"): string {
  return unit === "cm" ? "cm" : "in";
}

/** Short-row hold steps shared with sweater bust-dart instructions (plain text). */
export function dartShapingHoldStepLines(result: DartShapingSuccess): string[] {
  const lines: string[] = [];
  if (result.dividesEvenly) {
    lines.push(
      `Place ${result.holdPerPassWhenEven} needles in hold every other row, ${result.shapingPasses} ${timesWord(result.shapingPasses)}.`,
    );
  } else {
    lines.push(
      `Place ${result.higherHoldCount} needles in hold every other row, ${result.numberOfHigherPasses} ${timesWord(result.numberOfHigherPasses)}.`,
    );
    lines.push(
      `Place ${result.lowerHoldCount} needles in hold every other row, ${result.numberOfLowerPasses} ${timesWord(result.numberOfLowerPasses)}.`,
    );
  }
  lines.push("Turn off hold settings.");
  lines.push("Start your row counter (or reset it) so the next plain row is counted correctly.");
  lines.push("Continue knitting across all stitches.");
  return lines;
}

/** Tool-page results HTML (summary table + instruction blocks). */
export function buildDartFormulaResultsHtml(result: DartShapingSuccess): string {
  const unit = result.unit;
  const gLabel = formatGaugeLabel(unit);
  const dLabel = formatDepthLabel(unit);
  const unitsLabel = unit === "cm" ? "Centimeters" : "Inches";

  const holdLines = dartShapingHoldStepLines(result);
  // Last three lines are shared post-hold steps; tool shows them as list items with the holds.
  const stepsHtml = holdLines
    .map((line) => {
      const m = line.match(/^Place (\d+) needles in hold every other row, (\d+) times?\.$/);
      if (m) {
        return `<li>Place <strong>${m[1]}</strong> needles in hold every other row, <strong>${m[2]}</strong> ${timesWord(Number(m[2]))}.</li>`;
      }
      return `<li>${escapeHtml(line)}</li>`;
    })
    .join("");

  const summaryRows: [string, string][] = [
    ["Cup size", escapeHtml(result.cupKey)],
    ["Stitch gauge", `${escapeHtml(String(result.stitchGauge))} sts / ${gLabel}`],
    ["Row gauge", `${escapeHtml(String(result.rowGauge))} rows / ${gLabel}`],
    ["Dart width", `${escapeHtml(String(result.dartWidth))} ${dLabel}`],
    ["Dart depth", `${escapeHtml(String(result.dartDepth))} ${dLabel}`],
    ["Units", unitsLabel],
    ["Stitches involved (calculated)", escapeHtml(String(result.totalHeldStitches))],
    ["Depth in rows (calculated)", escapeHtml(String(result.totalDepthRows))],
  ];

  const tableBody = summaryRows
    .map(([k, v]) => `<tr><th scope="row">${escapeHtml(k)}</th><td>${v}</td></tr>`)
    .join("");

  return `
          <p class="results-summary"><strong>Summary</strong></p>
          <table class="dart-summary-table">
            <tbody>${tableBody}</tbody>
          </table>
          <div class="results-instruction-block">
            <p><strong>When to work the dart:</strong></p>
            <p>Knit to the point where you want to start your shaping.</p>
            <p>Stop your row counter, work the dart, then reset your row counter and continue knitting.</p>
          </div>
          <div class="results-instruction-block">
            <p><strong>Instructions</strong></p>
            <p>Work the short-row shaping:</p>
            <ul>${stepsHtml}</ul>
          </div>
        `;
}
