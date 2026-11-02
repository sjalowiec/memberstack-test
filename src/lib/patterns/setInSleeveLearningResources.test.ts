import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import videosPublic from "../../data/videos-public.json";
import { vimeoNumericIdFromPublicVideo, type PublicVideoRow } from "../lessonVideo";
import { resolveCatalogVideoEmbed } from "../videos/resolveCatalogVideoEmbed";
import { findPublicVideoByContentId } from "./sleevelessCatalogHelpVideo";
import {
  SET_IN_BACK_ARMHOLE_BIND_OFF_TIP_ID,
  SET_IN_JOIN_SHOULDERS_VIDEO_CONTENT_ID,
  SET_IN_NECKLINE_ORIENTATION_TIP_ID,
  SET_IN_NECKLINE_SHORT_ROW_GLOSSARY_ID,
  SET_IN_NECKLINE_STAIR_STEPS_GLOSSARY_ID,
  SET_IN_SLEEVE_PERFECTION_CONTENT_ID,
  setInBackArmholeBindOffTrickTip,
  setInBackNecklineMachineHelpCardHtml,
  setInCatalogVideoModalLinkHtml,
  setInFrontNecklineMachineHelpCardHtml,
  setInJoinShouldersVideoHelpHtml,
  setInNecklineOrientationTipBlock,
  setInSleevePerfectionVideoHelpHtml,
} from "./setInSleeveLearningResources";
import { patternTipWrapperHtml } from "./sleevelessPatternOutput";

describe("set-in neckline chart help cards", () => {
  it("uses active Short Rows glossary 811 and omits inactive glossary 250", () => {
    const back = setInBackNecklineMachineHelpCardHtml();
    const front = setInFrontNecklineMachineHelpCardHtml(false);
    for (const html of [back, front]) {
      expect(html).toContain(`data-glossary-id="${SET_IN_NECKLINE_SHORT_ROW_GLOSSARY_ID}"`);
      expect(html).toContain(`data-glossary-id="${SET_IN_NECKLINE_STAIR_STEPS_GLOSSARY_ID}"`);
      expect(html).not.toContain('data-glossary-id="250"');
      expect(html).toContain('data-sleeveless-help-video="roundNeckShaping"');
      expect(html).toContain('data-tip-id="sleeveless-neckline-machine-help"');
      expect(html).toContain("no-print");
    }
  });

  it("omits the shallow-neck catalog 813 button from the back card", () => {
    const back = setInBackNecklineMachineHelpCardHtml();
    expect(back).not.toContain('data-sleeveless-help-video="shallowBackNeck"');
    expect(back).not.toContain("Short row shoulder shaping");
  });

  it("keeps both neckline videos on a round-neck front card", () => {
    const front = setInFrontNecklineMachineHelpCardHtml(false);
    expect(front).toContain('data-sleeveless-help-video="roundNeckShaping"');
    expect(front).toContain('data-sleeveless-help-video="shallowBackNeck"');
    expect(front).toContain("Round neck shaping");
    expect(front).toContain("Short row shoulder shaping");
  });

  it("omits the round-neck chart card from V-neck front shaping", () => {
    expect(setInFrontNecklineMachineHelpCardHtml(true)).toBe("");
  });
});

describe("set-in attach-sleeves and bind-off resources", () => {
  it("uses compact catalog-title buttons that open the pattern video modal", () => {
    const catalog = videosPublic as PublicVideoRow[];
    const shouldersRow = findPublicVideoByContentId(catalog, SET_IN_JOIN_SHOULDERS_VIDEO_CONTENT_ID);
    const sleeveRow = findPublicVideoByContentId(catalog, SET_IN_SLEEVE_PERFECTION_CONTENT_ID);
    const sleeve = resolveCatalogVideoEmbed(catalog, String(SET_IN_SLEEVE_PERFECTION_CONTENT_ID));
    expect(shouldersRow?.title).toBe("3- Needle Bind off (Shoulder Seams)");
    expect(sleeveRow?.title).toBe("Set In Sleeve Perfection");
    expect(vimeoNumericIdFromPublicVideo(sleeveRow!)).toBe("151858956");
    expect(sleeve.ok && sleeve.iframeSrc).toContain("https://player.vimeo.com/video/151858956");

    const shoulders = setInJoinShouldersVideoHelpHtml();
    const sleeves = setInSleevePerfectionVideoHelpHtml();
    expect(shoulders).toContain('href="/pages/videos/modal/202"');
    expect(shoulders).toContain('class="pattern-video-modal-link no-print"');
    expect(shoulders).toContain('data-video-id="202"');
    expect(shoulders).toContain("3- Needle Bind off (Shoulder Seams)");
    expect(sleeves).toContain('href="/pages/videos/modal/580"');
    expect(sleeves).toContain('data-video-id="580"');
    expect(sleeves).toContain('data-content-id="580"');
    expect(sleeves).toContain("Set In Sleeve Perfection");
    expect(shoulders).not.toContain("<iframe");
    expect(sleeves).not.toContain("<iframe");
    expect(shoulders.match(/data-video-id="202"/g)).toHaveLength(1);
    expect(sleeves.match(/data-video-id="580"/g)).toHaveLength(1);
    expect(setInCatalogVideoModalLinkHtml(999999)).toBe("");
  });

  it("is a dismissible Bind Off Trick tip for catalog video 5002", () => {
    const tip = setInBackArmholeBindOffTrickTip();
    const html = patternTipWrapperHtml(tip);
    expect(tip.tipId).toBe(SET_IN_BACK_ARMHOLE_BIND_OFF_TIP_ID);
    expect(html).toContain(`data-tip-id="${SET_IN_BACK_ARMHOLE_BIND_OFF_TIP_ID}"`);
    expect(html).toContain("Bind Off Trick");
    expect(html).toContain('data-sleeveless-help-video="bindOffTrick"');
    expect(html).toContain('data-content-id="5002"');
    expect(html).toContain("no-print");
    expect(html).not.toContain("hold stitches or use short-row shaping");
  });

  it("reuses the existing orientation help card", () => {
    const block = setInNecklineOrientationTipBlock();
    expect(block.tipId).toBe(SET_IN_NECKLINE_ORIENTATION_TIP_ID);
    expect(block.tipHtml).toContain("Understanding Left, Right & Diagram Orientation");
    expect(block.tipPresentation).toBe("help-card");
  });
});

describe("set-in page wiring leaves sleeveless on the shared card", () => {
  const page = readFileSync(new URL("../../scripts/sleevelessPatternPageShared.ts", import.meta.url), "utf8");

  it("passes set-in help cards only inside the set-in mount", () => {
    expect(page).toContain("const frontHelpCardHtml = setInFrontNeckHelpCard;");
    expect(page).toContain("const frontHelpCardHtml = necklineChartMachineHelpCardHtml();");
    expect(page).toContain("glossaryTooltip(250, \"Short Rows\")");
  });

  it("opens one deferred pattern-video player and does not embed it in the pattern", () => {
    const opener = page.slice(page.indexOf("function openPatternContentVideoModal"), page.indexOf("function openShapingNotationFromPreview"));
    expect(opener).toContain("const src = `/pages/videos/modal/${cleanId}`");
    expect(opener.match(/<iframe/g)).toHaveLength(1);
    expect(opener).not.toContain("querySelectorAll");
    const modalPage = readFileSync(new URL("../../pages/videos/modal/[id].astro", import.meta.url), "utf8");
    const aliasPage = readFileSync(new URL("../../pages/pages/videos/modal/[id].astro", import.meta.url), "utf8");
    expect(modalPage).toContain("loadMergedVideoCatalog");
    expect(modalPage).toContain("GatedVimeoEmbed");
    expect(modalPage).not.toContain("151858956");
    expect(aliasPage).toContain("/videos/modal/");
  });
});
