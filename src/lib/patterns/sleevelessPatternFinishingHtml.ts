import {
  buildSleevelessFinishingStepIds,
  SLEEVELESS_FINISHING_STEP_TITLES,
  type SleevelessFinishingStepId,
} from "./sleevelessPatternFinishing";

export type SleevelessFinishingHtmlDeps = {
  escapeHtml: (s: string) => string;
  glossaryTooltip: (id: number, term: string) => string;
  oneShoulderFinishingHelpHtml: () => string;
  neckFinishingVideoKey: string;
  neckFinishingButtonLabel: string;
  neckFinishingLeadHtml: string;
};

function stepSlug(id: SleevelessFinishingStepId): string {
  return `finishing-step-${id.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
}

function stepSection(
  stepNumber: number,
  id: SleevelessFinishingStepId,
  title: string,
  bodyHtml: string,
): string {
  const slug = stepSlug(id);
  return `<section class="pattern-finishing-step" aria-labelledby="${slug}">
    <h3 class="pattern-finishing-step__title" id="${slug}">${stepNumber}. ${title}</h3>
    ${bodyHtml}
  </section>`;
}

function blockPiecesBody(deps: SleevelessFinishingHtmlDeps): string {
  return `<ul>
      <li>Lightly steam or ${deps.glossaryTooltip(659, "Wet Block")} pieces to measurements.</li>
      <li>Allow pieces to dry completely before assembly.</li>
      <li>Pin edges flat if needed.</li>
    </ul>
    <p>Blocking before seaming helps neckline and armhole edges relax and makes finishing easier.</p>`;
}

function joinShouldersBody(deps: SleevelessFinishingHtmlDeps): string {
  return `<p class="pattern-finishing-lead">Join ${deps.oneShoulderFinishingHelpHtml()} using your preferred method.</p>
    <ul>
      <li>${deps.glossaryTooltip(745, "Linker")}</li>
      <li>crochet slip stitch</li>
      <li>machine bind-off method</li>
    </ul>`;
}

function finishArmholesBody(deps: SleevelessFinishingHtmlDeps): string {
  return `<ul>
      <li>Work both armhole trims the same way as the neckband.</li>
      <li>Use the neckband video in the Finish Neckline step as a guide for finishing the armholes.</li>
      <li>Be sure to grade the tension as you knit the band.</li>
    </ul>
    <p class="pattern-finishing-video-help pattern-help-link no-print">
      <span class="pattern-finishing-video-help__lead"><i class="fa-solid fa-play"></i> Same technique as the neckband:</span>
      <span class="pattern-finishing-video-help__links">
        <button type="button" class="pattern-help-link__button" data-sleeveless-help-video="${deps.neckFinishingVideoKey}" aria-haspopup="dialog"><i class="fa-solid fa-play"></i> ${deps.escapeHtml(
          deps.neckFinishingButtonLabel,
        )}</button>
      </span>
    </p>`;
}

function finishFrontEdgesBody(
  pickupSts: number | undefined,
  deps: SleevelessFinishingHtmlDeps,
): string {
  const xx =
    pickupSts !== undefined && Number.isFinite(pickupSts) && pickupSts > 0
      ? String(Math.round(pickupSts))
      : "the calculated number of";
  const turningRow = deps.glossaryTooltip(324, "turning row");
  return `<ul>
      <li>Pick up approximately ${xx} stitches evenly along one front edge, beginning at the hem and ending at the neckline.</li>
      <li>Knit the first side of the band.</li>
      <li>Knit 1 ${turningRow}.</li>
      <li>Knit the second side of the band.</li>
      <li>Bind off loosely.</li>
      <li>Fold the band on the ${turningRow} and stitch it down.</li>
      <li>Repeat for the opposite front edge, adding buttonholes if desired.</li>
    </ul>`;
}

function finishNecklineBody(deps: SleevelessFinishingHtmlDeps): string {
  return `<ul>
      <li>Work the neckline trim or neckband.</li>
      <li>Finish the neckband as desired.</li>
      <li>Join the remaining shoulder seam and neckband seam.</li>
    </ul>
    ${deps.neckFinishingLeadHtml}
    <p class="pattern-finishing-video-help pattern-help-link no-print">
      <span class="pattern-finishing-video-help__lead"><i class="fa-solid fa-play"></i> Helpful video for finishing:</span>
      <span class="pattern-finishing-video-help__links">
        <button type="button" class="pattern-help-link__button" data-sleeveless-help-video="${deps.neckFinishingVideoKey}" aria-haspopup="dialog"><i class="fa-solid fa-play"></i> ${deps.escapeHtml(
          deps.neckFinishingButtonLabel,
        )}</button>
      </span>
    </p>`;
}

function joinSideSeamsBody(): string {
  return `<ul>
      <li>Match armhole edges and hem.</li>
      <li>Match markers (if added).</li>
      <li>Seam from hem to underarm.</li>
    </ul>
    <p class="pattern-finishing-video-help pattern-help-link no-print">
      <span class="pattern-finishing-video-help__lead"><i class="fa-solid fa-play"></i> Helpful video for seaming:</span>
      <span class="pattern-finishing-video-help__links">
        <button type="button" class="pattern-help-link__button" data-sleeveless-help-video="seamingPuttingItAllTogether" aria-haspopup="dialog"><i class="fa-solid fa-play"></i> Seaming – Putting It All Together</button>
      </span>
    </p>`;
}

function finalPressingBody(): string {
  return `<ul>
      <li>Lightly steam seams if needed.</li>
      <li>Weave in ends.</li>
      <li>Allow garment to rest before wearing.</li>
    </ul>`;
}

function stepBodyHtml(
  id: SleevelessFinishingStepId,
  deps: SleevelessFinishingHtmlDeps,
  frontEdgePickupSts: number | undefined,
): string {
  switch (id) {
    case "blockPieces":
      return blockPiecesBody(deps);
    case "joinShoulders":
      return joinShouldersBody(deps);
    case "finishArmholes":
      return finishArmholesBody(deps);
    case "finishFrontEdges":
      return finishFrontEdgesBody(frontEdgePickupSts, deps);
    case "finishNeckline":
      return finishNecklineBody(deps);
    case "joinSideSeams":
      return joinSideSeamsBody();
    case "finalPressing":
      return finalPressingBody();
    default:
      return "";
  }
}

export function buildSleevelessFinishingStepsHtml(options: {
  isCardigan: boolean;
  frontEdgePickupSts?: number;
  deps: SleevelessFinishingHtmlDeps;
}): string {
  const ids = buildSleevelessFinishingStepIds({ isCardigan: options.isCardigan });
  const sections = ids.map((id, index) =>
    stepSection(
      index + 1,
      id,
      SLEEVELESS_FINISHING_STEP_TITLES[id],
      stepBodyHtml(id, options.deps, options.frontEdgePickupSts),
    ),
  );
  const inner = sections.join("\n\n");
  return '<div class="pattern-finishing-steps">\n' + inner + "\n</div>";
}

export function buildSleevelessFinishingPrintListHtml(options: {
  isCardigan: boolean;
  frontEdgePickupSts?: number;
}): string {
  const ids = buildSleevelessFinishingStepIds({ isCardigan: options.isCardigan });
  const items: string[] = [];

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    const n = i + 1;
    switch (id) {
      case "blockPieces":
        items.push(`${n}. Optional: block pieces to measurements; allow to dry.`);
        break;
      case "joinShoulders":
        items.push(`${n}. Join shoulders with your preferred method.`);
        break;
      case "finishArmholes":
        items.push(
          `${n}. Finish both armholes (work trims to match your yarn and tension; use the neckband technique as a guide).`,
        );
        break;
      case "finishFrontEdges": {
        const xx =
          options.frontEdgePickupSts !== undefined &&
          Number.isFinite(options.frontEdgePickupSts) &&
          options.frontEdgePickupSts > 0
            ? String(Math.round(options.frontEdgePickupSts))
            : "approximately the calculated number of";
        items.push(
          `${n}. Finish front edges: pick up ${xx} stitches evenly along each front edge from hem to neckline; work the band, bind off loosely, and repeat on the opposite edge (add buttonholes if desired).`,
        );
        break;
      }
      case "finishNeckline":
        items.push(
          `${n}. Finish the neckline (work trim or neckband, finish as desired, join the remaining shoulder and neckband seams).`,
        );
        break;
      case "joinSideSeams":
        items.push(`${n}. Join side seams from hem toward underarm, matching edges.`);
        break;
      case "finalPressing":
        items.push(`${n}. Weave in ends; lightly steam if needed; allow the garment to rest before wearing.`);
        break;
      default:
        break;
    }
  }

  return items.map((line) => `<li>${line}</li>`).join("\n    ");
}
