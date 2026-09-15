import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  bindSkillBuilderPracticeBackLinks,
  handleSkillBuilderPracticeBackLinkClick,
  isSkillBuildersCatalogPath,
  isSkillBuildersCatalogReferrer,
  shouldUseSkillBuildersCatalogHistoryBack,
  SKILL_BUILDERS_CATALOG_PATH,
  type SkillBuilderPracticeBackLinkElement,
} from "./skillBuilderPracticeBackLink";

const ORIGIN = "https://knititnow.com";
const componentsDir = join(process.cwd(), "src/components/skill-builders");
const backLinkSource = readFileSync(
  join(componentsDir, "SkillBuilderPracticeBackLink.astro"),
  "utf8",
);
const feedbackSource = readFileSync(
  join(componentsDir, "SkillBuilderFeedback.astro"),
  "utf8",
);

const PRACTICE_PAGES = [
  "ShortRowsSkillBuilder.astro",
  "EWrapCastOnSkillBuilder.astro",
  "JoiningShoulderSeamsSkillBuilder.astro",
  "RoundNecklineSkillBuilderLanding.astro",
] as const;

function readComponent(name: string): string {
  return readFileSync(join(componentsDir, name), "utf8");
}

function clickEvent(
  overrides: Partial<{
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    button: number;
    defaultPrevented: boolean;
  }> = {},
) {
  const preventDefault = vi.fn();
  return {
    preventDefault,
    defaultPrevented: overrides.defaultPrevented ?? false,
    button: overrides.button ?? 0,
    metaKey: overrides.metaKey ?? false,
    ctrlKey: overrides.ctrlKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
    altKey: overrides.altKey ?? false,
  };
}

function fakeLink(): SkillBuilderPracticeBackLinkElement & {
  listeners: Array<(event: ReturnType<typeof clickEvent>) => void>;
} {
  const listeners: Array<(event: ReturnType<typeof clickEvent>) => void> = [];
  return {
    href: SKILL_BUILDERS_CATALOG_PATH,
    listeners,
    addEventListener(_type, listener) {
      listeners.push(listener as (event: ReturnType<typeof clickEvent>) => void);
    },
  };
}

describe("shouldUseSkillBuildersCatalogHistoryBack", () => {
  it("uses browser history after Skill Builders catalog → practice page", () => {
    expect(
      shouldUseSkillBuildersCatalogHistoryBack({
        referrer: `${ORIGIN}/learn/skill-builders`,
        historyLength: 2,
        currentOrigin: ORIGIN,
      }),
    ).toBe(true);
    expect(isSkillBuildersCatalogPath("/learn/skill-builders/")).toBe(true);
    expect(
      isSkillBuildersCatalogReferrer(`${ORIGIN}/learn/skill-builders/`, ORIGIN),
    ).toBe(true);
  });

  it("does not use history.back() for a direct / pasted / bookmarked practice URL", () => {
    expect(
      shouldUseSkillBuildersCatalogHistoryBack({
        referrer: "",
        historyLength: 1,
        currentOrigin: ORIGIN,
      }),
    ).toBe(false);
    expect(
      shouldUseSkillBuildersCatalogHistoryBack({
        referrer: "",
        historyLength: 4,
        currentOrigin: ORIGIN,
      }),
    ).toBe(false);
    expect(
      shouldUseSkillBuildersCatalogHistoryBack({
        referrer: `${ORIGIN}/learn/skill-builders`,
        historyLength: 1,
        currentOrigin: ORIGIN,
      }),
    ).toBe(false);
  });

  it("does not use unrelated previous history", () => {
    expect(
      shouldUseSkillBuildersCatalogHistoryBack({
        referrer: `${ORIGIN}/tools`,
        historyLength: 5,
        currentOrigin: ORIGIN,
      }),
    ).toBe(false);
    expect(
      shouldUseSkillBuildersCatalogHistoryBack({
        referrer: `${ORIGIN}/videos`,
        historyLength: 5,
        currentOrigin: ORIGIN,
      }),
    ).toBe(false);
    expect(
      shouldUseSkillBuildersCatalogHistoryBack({
        referrer: `${ORIGIN}/learn/skill-builders/short-rows`,
        historyLength: 5,
        currentOrigin: ORIGIN,
      }),
    ).toBe(false);
    expect(
      shouldUseSkillBuildersCatalogHistoryBack({
        referrer: "https://www.google.com/search?q=skill+builders",
        historyLength: 5,
        currentOrigin: ORIGIN,
      }),
    ).toBe(false);
    expect(isSkillBuildersCatalogPath("/learn/skill-builders/short-rows")).toBe(false);
    expect(isSkillBuildersCatalogPath("/learn")).toBe(false);
  });
});

describe("handleSkillBuilderPracticeBackLinkClick", () => {
  it("prevents default and history.back() from the Skill Builders catalog", () => {
    const event = clickEvent();
    const back = vi.fn();
    const usedHistory = handleSkillBuilderPracticeBackLinkClick(event, {
      referrer: `${ORIGIN}/learn/skill-builders`,
      historyLength: 2,
      currentOrigin: ORIGIN,
      back,
    });
    expect(usedHistory).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("leaves the /learn/skill-builders href fallback for a direct practice-page visit", () => {
    const event = clickEvent();
    const back = vi.fn();
    expect(
      handleSkillBuilderPracticeBackLinkClick(event, {
        referrer: "",
        historyLength: 1,
        currentOrigin: ORIGIN,
        back,
      }),
    ).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it("leaves the href fallback for an unrelated referrer", () => {
    const event = clickEvent();
    const back = vi.fn();
    expect(
      handleSkillBuilderPracticeBackLinkClick(event, {
        referrer: `${ORIGIN}/tools`,
        historyLength: 5,
        currentOrigin: ORIGIN,
        back,
      }),
    ).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it("preserves normal link behavior for modified clicks", () => {
    for (const overrides of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
    ]) {
      const event = clickEvent(overrides);
      const back = vi.fn();
      expect(
        handleSkillBuilderPracticeBackLinkClick(event, {
          referrer: `${ORIGIN}/learn/skill-builders`,
          historyLength: 2,
          currentOrigin: ORIGIN,
          back,
        }),
      ).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(back).not.toHaveBeenCalled();
    }
  });
});

describe("bindSkillBuilderPracticeBackLinks", () => {
  it("keeps the catalog href and uses history.back() from a catalog visit", () => {
    const link = fakeLink();
    const back = vi.fn();
    const href = bindSkillBuilderPracticeBackLinks({
      links: [link],
      referrer: `${ORIGIN}/learn/skill-builders`,
      historyLength: 2,
      currentOrigin: ORIGIN,
      back,
    });
    expect(href).toBe("/learn/skill-builders");
    expect(link.href).toBe("/learn/skill-builders");

    const event = clickEvent();
    link.listeners[0]?.(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("keeps the fallback href when previous history is not the Skill Builders catalog", () => {
    const link = fakeLink();
    const back = vi.fn();
    bindSkillBuilderPracticeBackLinks({
      links: [link],
      referrer: `${ORIGIN}/patterns`,
      historyLength: 8,
      currentOrigin: ORIGIN,
      back,
    });
    expect(link.href).toBe("/learn/skill-builders");

    const event = clickEvent();
    link.listeners[0]?.(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });
});

describe("Skill Builder practice return-link placement", () => {
  it("places Back to Skill Builders at the top of each practice page and not at the bottom", () => {
    for (const name of PRACTICE_PAGES) {
      const source = readComponent(name);
      expect(source).toContain("SkillBuilderPracticeBackLink");
      const backIdx = source.indexOf("<SkillBuilderPracticeBackLink");
      const titleIdx = source.indexOf("<SkillBuilderPageHeader");
      expect(backIdx).toBeGreaterThan(-1);
      expect(titleIdx).toBeGreaterThan(-1);
      expect(backIdx).toBeLessThan(titleIdx);
      expect(source).not.toContain("sb-practice-eyebrow");
      expect(source).not.toContain("sb-landing__back");
      expect(source).not.toContain("Back to Skill Builders");
    }

    expect(feedbackSource).not.toContain("Back to Skill Builders");
    expect(feedbackSource).not.toContain("sb-practice-back");
    expect(feedbackSource).not.toContain("includeBackLink");
    expect(feedbackSource).not.toContain("SkillBuilderPracticeBackLink");
  });
});

describe("Skill Builder practice return-link wiring", () => {
  it("binds the practice-page helper instead of a full document load or a blind history.back()", () => {
    expect(backLinkSource).toContain('from "../../lib/skillBuilders/skillBuilderPracticeBackLink"');
    expect(backLinkSource).toContain("bindSkillBuilderPracticeBackLinks");
    expect(backLinkSource).toContain('class="sb-practice-back back-to-skill-builders-link"');
    expect(backLinkSource).toContain('href="/learn/skill-builders"');
    expect(backLinkSource).toContain("Back to Skill Builders");
    expect(backLinkSource).not.toMatch(
      /if\s*\(\s*window\.history\.length\s*>\s*1\s*\)\s*\{\s*event\.preventDefault\(\);\s*window\.history\.back\(\);/,
    );
    expect(backLinkSource).not.toContain("WizardBackLink");
  });
});
