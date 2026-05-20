import type { SleevelessBodyBlockRuntimeDebug } from "./sleevelessAlineShaping";

/** Temporary Pattern-tab panel — remove after live body-block verification. */
export function buildSleevelessBodyBlockDebugPanelHtml(
  debug: SleevelessBodyBlockRuntimeDebug | undefined,
): string {
  if (!debug) {
    return `<aside class="sleeveless-body-block-debug" data-sleeveless-body-block-debug><p><strong>Body block debug:</strong> no runtime data.</p></aside>`;
  }
  const rows: [string, string][] = [
    ["garmentStyle", debug.garmentStyle],
    ["frontStyle", debug.frontStyle || "(empty)"],
    ["garmentKindSource", debug.garmentKindSource || "(empty)"],
    ["patternMode", debug.patternMode || "(empty)"],
    ["style.bodyShape", debug.styleBodyShape || "(empty)"],
    ["effective bust (in)", String(debug.effectiveBustInches ?? "—")],
    ["effective hip (in)", String(debug.effectiveHipInches ?? "—")],
    ["shouldRunSleevelessBodyBlockForPullover", String(debug.shouldRunSleevelessBodyBlockForPullover)],
    ["hip sent to body block (in)", String(debug.hipSentToBodyBlock ?? "—")],
    ["explicitCustomBuildStraight", String(debug.explicitCustomBuildStraight)],
    ["measurementsImplyAline", String(debug.measurementsImplyAline)],
    ["buildSleevelessBodyBlockPlan() called", String(debug.bodyBlockCalled)],
    ["bodyBlockPlan.bodyShapeKind", debug.bodyShapeKind ?? "—"],
    ["bodyBlockPlan.shapingDirection", debug.shapingDirection ?? "—"],
    ["bodyBlockPlan.hemStitches", String(debug.bodyBlockHemStitches ?? "—")],
    ["bodyBlockPlan.bustStitches", String(debug.bodyBlockBustStitches ?? "—")],
    ["bodyBlockPlan.shapingEvents.length", String(debug.shapingEventsCount ?? "—")],
    ["final castOnStitches (generator)", String(debug.finalCastOnStitches)],
  ];
  const match =
    debug.bodyBlockCalled &&
    debug.bodyBlockHemStitches !== undefined &&
    debug.finalCastOnStitches === debug.bodyBlockHemStitches;
  const list = rows
    .map(
      ([k, v]) =>
        `<tr><th scope="row">${escapeHtml(k)}</th><td><code>${escapeHtml(v)}</code></td></tr>`,
    )
    .join("");
  return `<aside class="sleeveless-body-block-debug no-print" data-sleeveless-body-block-debug>
  <h2 class="sleeveless-body-block-debug__title">Body block debug (temporary)</h2>
  <p class="sleeveless-body-block-debug__note">Remove this panel after cast-on matches hip width in the browser.</p>
  <table class="sleeveless-body-block-debug__table"><tbody>${list}</tbody></table>
  <p class="sleeveless-body-block-debug__check"><strong>castOn === bodyBlock hemStitches:</strong> ${match ? "yes" : "no"}</p>
</aside>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
