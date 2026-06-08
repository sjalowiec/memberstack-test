import {
  buildSleevelessFinishingStepIds,
  SLEEVELESS_FINISHING_STEP_TITLES,
  type SleevelessCardiganFrontEdgeFinishingMode,
  type SleevelessFinishingStepId,
} from "./sleevelessPatternFinishing";

export type SleevelessFinishingHtmlDeps = {
  escapeHtml: (s: string) => string;
  glossaryTooltip: (id: number, term: string) => string;
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
      <li>Lightly steam your pieces to measurements.</li>
      <li>Allow pieces to dry completely before assembly.</li>
      <li>Pin edges flat if needed.</li>
    </ul>
    <p>Blocking before seaming helps neckline and armhole edges relax and makes finishing easier.</p>`;
}

function joinShouldersBody(deps: SleevelessFinishingHtmlDeps): string {
  return `<p class="pattern-finishing-lead">Join one shoulder using your preferred method.</p>
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

function finishFrontEdgesPickupBody(
  pickupSts: number | undefined,
  deps: SleevelessFinishingHtmlDeps,
): string {
  const xx =
    pickupSts !== undefined && Number.isFinite(pickupSts) && pickupSts > 0
      ? String(Math.round(pickupSts))
      : "the calculated number of";
  return `<ul>
      <li>Pick up approximately ${xx} stitches evenly along one front edge, beginning at the hem and ending at the neckline.</li>
      <li>Knit the first side of the band.</li>
      <li>Knit 1 turning row.</li>
      <li>Knit the second side of the band.</li>
      <li>Bind off loosely.</li>
      <li>Fold the band on the turning row and stitch it down.</li>
      <li>Repeat for the opposite front edge, adding buttonholes if desired.</li>
    </ul>`;
}

function finishFrontEdgesVerticalBandBody(): string {
  return `<p class="pattern-finishing-lead">For a V-neck cardigan, a vertical front band is often the most practical machine-knitting method. Instead of picking up the entire front edge and V-neck opening across the needle bed, knit each front band separately and attach it to the cardigan front.</p>
    <ol>
      <li>Decide the finished band width.</li>
      <li>Cast on the number of stitches needed for the band width.</li>
      <li>Knit the band vertically to match the front edge length.</li>
      <li>Work buttonholes on the buttonhole band as needed.</li>
      <li>Attach the band to the cardigan front as you knit, or sew it on after knitting.</li>
      <li>Repeat for the second front band.</li>
    </ol>
    <p>For many adult V-neck cardigans, there may not be enough needles available to pick up the entire front edge, V opening, and back neck in one piece. Vertical bands avoid that problem and give a clean, stable finish.</p>`;
}

function finishFrontEdgesBody(
  mode: SleevelessCardiganFrontEdgeFinishingMode,
  pickupSts: number | undefined,
  deps: SleevelessFinishingHtmlDeps,
): string {
  if (mode === "verticalBand") {
    return finishFrontEdgesVerticalBandBody();
  }
  return finishFrontEdgesPickupBody(pickupSts, deps);
}

function necklineFinishingHelpBody(): string {
  return `<aside class="pattern-finishing-neck-help pattern-finishing-video-help no-print" aria-label="Need help finishing the neckline?">
      <p class="pattern-finishing-neck-help__title"><i class="fa-solid fa-circle-question"></i> Need help finishing the neckline?</p>
      <p class="pattern-finishing-neck-help__lead">Watch the video that matches your pattern:</p>
      <ul class="pattern-finishing-neck-help__links">
        <li><a class="pattern-help-link__anchor" href="https://app.knititnow.com/videos/386/?q=v-neck" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-play"></i> V-Neck Finishing Instructions</a></li>
        <li><a class="pattern-help-link__anchor" href="https://app.knititnow.com/videos/695/?q=band" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-play"></i> Round Neck Finishing Instructions</a></li>
      </ul>
    </aside>`;
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
    </p>
    ${necklineFinishingHelpBody()}`;
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
  cardiganFrontEdgeFinishingMode: SleevelessCardiganFrontEdgeFinishingMode | undefined,
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
      return finishFrontEdgesBody(
        cardiganFrontEdgeFinishingMode ?? "pickup",
        frontEdgePickupSts,
        deps,
      );
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
  cardiganFrontEdgeFinishingMode?: SleevelessCardiganFrontEdgeFinishingMode;
  frontEdgePickupSts?: number;
  deps: SleevelessFinishingHtmlDeps;
}): string {
  const ids = buildSleevelessFinishingStepIds({ isCardigan: options.isCardigan });
  const frontEdgeMode =
    options.isCardigan ? (options.cardiganFrontEdgeFinishingMode ?? "pickup") : undefined;
  const sections = ids.map((id, index) =>
    stepSection(
      index + 1,
      id,
      SLEEVELESS_FINISHING_STEP_TITLES[id],
      stepBodyHtml(id, options.deps, frontEdgeMode, options.frontEdgePickupSts),
    ),
  );
  const inner = sections.join("\n\n");
  return '<div class="pattern-finishing-steps">\n' + inner + "\n</div>";
}

function finishFrontEdgesPrintLine(
  stepNumber: number,
  mode: SleevelessCardiganFrontEdgeFinishingMode,
  frontEdgePickupSts: number | undefined,
): string {
  if (mode === "verticalBand") {
    return `${stepNumber}. Finish front edges: knit each front band vertically to match the front edge length; work buttonholes on the buttonhole band as needed; attach each band as you knit or sew on after knitting; repeat for the second front band.`;
  }
  const xx =
    frontEdgePickupSts !== undefined &&
    Number.isFinite(frontEdgePickupSts) &&
    frontEdgePickupSts > 0
      ? String(Math.round(frontEdgePickupSts))
      : "approximately the calculated number of";
  return `${stepNumber}. Finish front edges: pick up ${xx} stitches evenly along each front edge from hem to neckline; work the band, bind off loosely, and repeat on the opposite edge (add buttonholes if desired).`;
}

export function buildSleevelessFinishingPrintListHtml(options: {
  isCardigan: boolean;
  cardiganFrontEdgeFinishingMode?: SleevelessCardiganFrontEdgeFinishingMode;
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
      case "finishFrontEdges":
        items.push(
          finishFrontEdgesPrintLine(
            n,
            options.cardiganFrontEdgeFinishingMode ?? "pickup",
            options.frontEdgePickupSts,
          ),
        );
        break;
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
