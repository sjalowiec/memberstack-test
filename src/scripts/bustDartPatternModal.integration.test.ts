/**
 * Browser integration: Add/Update/Remove Bust Dart through the real modal markup + client event path.
 *
 * Uses Playwright (already a repo dependency) against the Astro/Vite dev origin so the test
 * imports the same client module the browser loads. This is not a source-string test.
 *
 * Limitation: requires a reachable Vite/Astro origin (`KBM_DEV_URL` or http://127.0.0.1:4321).
 * When the origin is down, the suite is skipped with an explicit reason — there is no jsdom
 * harness in this repo that can fire real HTMLFormElement submit / dialog events.
 */
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DEV_ORIGIN = (process.env.KBM_DEV_URL || "http://127.0.0.1:4321").replace(/\/$/, "");

async function canReachDevOrigin(): Promise<boolean> {
  try {
    const res = await fetch(`${DEV_ORIGIN}/patterns/sleeveless/pattern`, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    return res.status > 0 && res.status < 500;
  } catch {
    return false;
  }
}

const hasDev = await canReachDevOrigin();

function seedCompleteWomenPattern(unit: "in" | "cm" = "in"): Record<string, unknown> {
  const now = new Date().toISOString();
  const style = {
    patternMode: "custom-build",
    recipientCategory: "misses",
    bodyShape: "straight",
    frontStyle: "closed",
    garmentStyle: "pullover",
    neckline: "round",
    construction: "sleeveless",
  };
  const fit = {
    selectedSize: "3",
    easeChoice: "standard",
    sizingChart: "misses",
    selectedMeasurements: {
      finished_bust_chest: 40,
      back_neck_to_hem: 22,
      armhole_depth: 8,
      neck_opening: 6,
      shoulder_width: 4.25,
      front_neck_depth: 3,
      back_neck_depth: 1,
    },
    cbMeasurementOverrides: {
      chestBust: "40",
      finishedLength: "22",
      armholeDepth: "8",
      shoulderWidth: "4.25",
      finishedNeckOpeningWidth: "6",
    },
  };
  const yarnGauge = {
    stitchGauge: "5",
    rowGauge: "7",
    gaugeStitchRaw: unit === "cm" ? "20" : "20",
    gaugeRowRaw: unit === "cm" ? "28" : "28",
    gaugeRawUnit: unit,
  };
  const yarnGaugeMachine = {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    gaugeStitchRaw: 20,
    gaugeRowRaw: 28,
    gaugeRawUnit: unit,
    availableNeedles: 200,
  };
  return { now, style, fit, yarnGauge, yarnGaugeMachine };
}

async function unlockGateAndSeed(page: Page, unit: "in" | "cm" = "in"): Promise<void> {
  const seed = seedCompleteWomenPattern(unit);
  const seedId = await page.evaluate((payload) => {
    const { now, style, fit, yarnGauge, yarnGaugeMachine } = payload as {
      now: string;
      style: Record<string, unknown>;
      fit: Record<string, unknown>;
      yarnGauge: Record<string, unknown>;
      yarnGaugeMachine: Record<string, unknown>;
    };
    const id = "bust-dart-integration-" + Date.now();
    localStorage.removeItem("kbm_custom_pattern_active_project_id");
    localStorage.removeItem("kbm_custom_pattern_active_project_name");
    // Inactive Optional Bust Dart is a `.pattern-tip` — keep Show Tips ON so Add is visible.
    localStorage.setItem("sleeveless-show-tips", "true");
    // Clear prior tip dismissals so the optional prompt is present after a re-seed.
    localStorage.removeItem("sleeveless-show-tips-dismissed");
    // Seed with bust dart explicitly off so a prior active dart cannot linger via merge.
    const styleOff = {
      ...style,
      bustDart: { enabled: false, cupSize: null, dartWidthInches: null, dartDepthInches: null },
    };
    localStorage.setItem(
      "kbm_current_pattern",
      JSON.stringify({
        id,
        status: "draft",
        version: 1,
        createdAt: now,
        updatedAt: now,
        style: styleOff,
        fit,
        yarnGauge,
        measurements: {},
        machine: { availableNeedles: "200" },
        calculations: {},
        instructions: {},
        patternProject: { title: "Bust Dart Integration", notes: "" },
      }),
    );
    localStorage.setItem(
      "patternBuilderData",
      JSON.stringify({
        style: styleOff,
        fit,
        yarnGauge,
        yarnGaugeMachine,
        createdAt: now,
        updatedAt: now,
      }),
    );
    localStorage.setItem("kbm_cb_wizard_garment_type", "pullover");
    localStorage.setItem("kbm_cb_wizard_neckline", "round");

    const unlockGate = () => {
      const root = document.querySelector("[data-sleeveless-pattern-gate]");
      if (!(root instanceof HTMLElement)) return;
      root.dataset.gateState = "member";
      root.removeAttribute("data-gate-pending");
      const content = root.querySelector("[data-sleeveless-pattern-gate-content]");
      const locked = root.querySelector("[data-sleeveless-pattern-gate-locked]");
      if (content instanceof HTMLElement) {
        content.hidden = false;
        content.removeAttribute("inert");
        content.setAttribute("aria-hidden", "false");
      }
      if (locked instanceof HTMLElement) locked.hidden = true;
    };
    unlockGate();

    document.querySelectorAll("[data-show-tips]").forEach((el) => {
      el.setAttribute("data-show-tips", "true");
    });
    return id;
  }, seed);

  await page.evaluate(async () => {
    const unlockGate = () => {
      const root = document.querySelector("[data-sleeveless-pattern-gate]");
      if (!(root instanceof HTMLElement)) return;
      root.dataset.gateState = "member";
      root.removeAttribute("data-gate-pending");
      const content = root.querySelector("[data-sleeveless-pattern-gate-content]");
      const locked = root.querySelector("[data-sleeveless-pattern-gate-locked]");
      if (content instanceof HTMLElement) {
        content.hidden = false;
        content.removeAttribute("inert");
        content.setAttribute("aria-hidden", "false");
      }
      if (locked instanceof HTMLElement) locked.hidden = true;
    };
    unlockGate();
    if (typeof window.kbmInvalidateSleevelessPatternRender === "function") {
      window.kbmInvalidateSleevelessPatternRender();
    }
    if (typeof window.kbmRefreshSleevelessPattern === "function") {
      await window.kbmRefreshSleevelessPattern();
    }
    unlockGate();
    document.querySelectorAll("[data-show-tips]").forEach((el) => {
      el.setAttribute("data-show-tips", "true");
    });
    localStorage.setItem("sleeveless-show-tips", "true");
    document.querySelectorAll("[data-show-tips]").forEach((el) => {
      el.setAttribute("data-show-tips", "true");
    });
    const tip = document.querySelector("[data-bust-dart-front-slot]");
    if (tip instanceof HTMLElement) {
      tip.hidden = false;
      tip.style.setProperty("display", "block", "important");
      tip.removeAttribute("data-tip-dismissed");
    }
  });

  // Wait for this seed's inactive Optional Bust Dart prompt — not leftover Update buttons
  // from a prior active dart (refresh may return before the mount swaps).
  await page.waitForFunction(
    (expectedId) => {
      const canonId = (() => {
        try {
          return JSON.parse(localStorage.getItem("kbm_current_pattern") || "{}")?.id;
        } catch {
          return null;
        }
      })();
      if (canonId !== expectedId) return false;
      const optional = document.querySelector(
        '[data-bust-dart-front-slot][data-bust-dart-active="false"]',
      );
      const hint = optional?.querySelector(".bust-dart-front-slot__hint")?.textContent || "";
      const active = document.querySelector(
        '[data-bust-dart-front-slot][data-bust-dart-active="true"]',
      );
      const mountLen = (document.querySelector("[data-sleeveless-mount]")?.innerHTML || "").length;
      return !active && !!optional && hint.length > 20 && mountLen > 1000;
    },
    seedId,
    { timeout: 30000 },
  );
}

async function clickOpenBustDart(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem("sleeveless-show-tips", "true");
    document.querySelectorAll("[data-show-tips]").forEach((el) => {
      el.setAttribute("data-show-tips", "true");
    });
    const tip = document.querySelector("[data-bust-dart-front-slot]");
    if (tip instanceof HTMLElement) {
      tip.hidden = false;
      tip.style.setProperty("display", "block", "important");
      tip.removeAttribute("data-tip-dismissed");
    }
    // Prefer a real click via the DOM when CSS still treats the tip as hidden.
    const open = document.querySelector(
      "[data-bust-dart-pattern-open]",
    ) as HTMLButtonElement | null;
    open?.click();
  });
  await page.waitForFunction(
    () => (document.querySelector("[data-bust-dart-pattern-modal]") as HTMLDialogElement | null)?.open === true,
    { timeout: 10000 },
  );
  await page.waitForTimeout(200);
}

async function addCupDart(page: Page, cup: string): Promise<void> {
  await clickOpenBustDart(page);
  await page.locator("#bust-dart-pattern-cup").selectOption(cup);
  await page.waitForTimeout(200);
  await page.locator("[data-bust-dart-modal-add]").click();
  await page.waitForFunction(
    () => !!document.querySelector('[data-bust-dart-front-slot][data-bust-dart-active="true"]'),
    { timeout: 15000 },
  );
}

function readActiveSlotState() {
  const active = document.querySelector(
    '[data-bust-dart-front-slot][data-bust-dart-active="true"]',
  ) as HTMLElement | null;
  const optional = document.querySelector(
    '[data-bust-dart-front-slot][data-bust-dart-active="false"]',
  ) as HTMLElement | null;
  const guides = document.querySelector(".ns-visual-guides, [id^='ns-visual-guides-heading']");
  const slotRect = (active || optional)?.getBoundingClientRect();
  const guidesRect = guides instanceof HTMLElement ? guides.getBoundingClientRect() : null;
  let bustDart = null;
  try {
    bustDart = JSON.parse(localStorage.getItem("kbm_current_pattern") || "null")?.style?.bustDart;
  } catch {
    /* ignore */
  }
  const steps = active?.querySelectorAll(".bust-dart-front-slot__steps > li") || [];
  return {
    dialogOpen: (document.querySelector("[data-bust-dart-pattern-modal]") as HTMLDialogElement)
      ?.open,
    hasActive: !!active,
    hasOptional: !!optional,
    cupText: active?.querySelector(".bust-dart-front-slot__cup")?.textContent?.trim() || "",
    titleText: active?.querySelector(".bust-dart-front-slot__title")?.textContent?.trim() || "",
    instructionText: active?.querySelector(".bust-dart-front-slot__instructions")?.textContent || "",
    stepCount: steps.length,
    stepTexts: Array.from(steps).map((li) => li.textContent?.trim() || ""),
    bustDart,
    slotTop: slotRect?.top ?? null,
    guidesTop: guidesRect?.top ?? null,
    slotId: (active || optional)?.id || "",
    scrollTarget: (active || optional)?.getAttribute("data-bust-dart-scroll-target") || "",
  };
}

describe.skipIf(!hasDev)("BustDartPatternModal browser integration (Add / Update / Remove)", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    await page.goto(`${DEV_ORIGIN}/patterns/sleeveless/pattern?member=true`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
  }, 120000);

  afterAll(async () => {
    await browser?.close();
  });

  it("Add to Pattern commits ordered instructions and scrolls to the active card", async () => {
    await unlockGateAndSeed(page, "in");

    await page.evaluate(() => {
      window.__bustDartIntegration = { commits: 0, refreshes: 0 };
      const origRefresh = window.kbmRefreshSleevelessPattern;
      window.kbmRefreshSleevelessPattern = async (...args: unknown[]) => {
        window.__bustDartIntegration!.refreshes += 1;
        return origRefresh?.(...(args as []));
      };
    });

    await addCupDart(page, "C");
    await page.waitForTimeout(400);

    const afterAdd = await page.evaluate(readActiveSlotState);

    expect(afterAdd.dialogOpen).toBe(false);
    expect(afterAdd.bustDart).toMatchObject({ enabled: true, cupSize: "C" });
    expect(afterAdd.hasActive).toBe(true);
    expect(afterAdd.titleText).toBe("Bust Dart");
    expect(afterAdd.cupText).toMatch(/^Cup C$/);
    expect(afterAdd.stepCount).toBeGreaterThanOrEqual(4);
    expect(afterAdd.stepTexts[0]).toMatch(/Stop the row counter at RC \d+, 1″ below the armhole opening/);
    expect(afterAdd.instructionText).toMatch(/place .+ needles in hold/i);
    expect(afterAdd.instructionText).not.toMatch(/Work the short-row bust darts/i);
    expect(afterAdd.slotId).toBe("bust-dart-front-slot");
    expect(afterAdd.scrollTarget).toBe("active");
    // Active card should be nearer the viewport than Visual Guides (no jump to guides).
    expect(afterAdd.slotTop).not.toBeNull();
    if (afterAdd.guidesTop != null && afterAdd.slotTop != null) {
      expect(Math.abs(afterAdd.slotTop)).toBeLessThan(Math.abs(afterAdd.guidesTop) + 80);
      expect(afterAdd.slotTop).toBeLessThan(220);
    }
  }, 120000);

  it("metric pattern shows cm placement with no inch symbol", async () => {
    await unlockGateAndSeed(page, "cm");
    await addCupDart(page, "C");
    const afterAdd = await page.evaluate(readActiveSlotState);
    expect(afterAdd.stepTexts[0]).toMatch(/2\.5 cm below the armhole opening/);
    expect(afterAdd.instructionText).not.toMatch(/″/);
    expect(afterAdd.bustDart).toMatchObject({ enabled: true, cupSize: "C" });
    const rcMatch = afterAdd.stepTexts[0]?.match(/RC (\d+)/);
    expect(rcMatch?.[1]).toBeTruthy();
  }, 120000);

  it("Edit Pattern unit switch updates active dart labels without removing the dart", async () => {
    await unlockGateAndSeed(page, "cm");
    await addCupDart(page, "C");
    let state = await page.evaluate(readActiveSlotState);
    expect(state.hasActive).toBe(true);
    expect(state.stepTexts[0]).toMatch(/2\.5 cm below the armhole opening/);

    // Same writes Edit Pattern applyChanges performs for the gauge unit (working draft).
    await page.evaluate(async () => {
      const patchUnit = (unit: "in" | "cm") => {
        const canon = JSON.parse(localStorage.getItem("kbm_current_pattern") || "{}");
        const pb = JSON.parse(localStorage.getItem("patternBuilderData") || "{}");
        const yarnGauge = {
          ...(canon.yarnGauge || {}),
          stitchGauge: "5",
          rowGauge: "7",
          gaugeUnits: "per_inch",
          gaugeStitchRaw: "20",
          gaugeRowRaw: "28",
          gaugeRawUnit: unit,
        };
        const yarnGaugeMachine = {
          ...(pb.yarnGaugeMachine || {}),
          gaugeStitchesPerInch: 5,
          gaugeRowsPerInch: 7,
          gaugeStitchRaw: 20,
          gaugeRowRaw: 28,
          gaugeRawUnit: unit,
          availableNeedles: 200,
        };
        canon.yarnGauge = yarnGauge;
        pb.yarnGauge = yarnGauge;
        pb.yarnGaugeMachine = yarnGaugeMachine;
        // Leave a stale opposite unit on a secondary mirror — must not win after the fix.
        if (unit === "in") {
          pb.yarnGaugeMachine = { ...yarnGaugeMachine, gaugeRawUnit: "in" };
        }
        localStorage.setItem("kbm_current_pattern", JSON.stringify(canon));
        localStorage.setItem("patternBuilderData", JSON.stringify(pb));
      };
      patchUnit("in");
      // Intentionally re-introduce a stale cm on yarnGaugeMachine only (pre-fix failure mode).
      const pb = JSON.parse(localStorage.getItem("patternBuilderData") || "{}");
      pb.yarnGaugeMachine = { ...(pb.yarnGaugeMachine || {}), gaugeRawUnit: "cm" };
      localStorage.setItem("patternBuilderData", JSON.stringify(pb));
      window.kbmInvalidateSleevelessPatternRender?.();
      await window.kbmRefreshSleevelessPattern?.();
    });

    await page.waitForFunction(
      () =>
        (document.querySelector(".bust-dart-front-slot__instructions")?.textContent || "").includes(
          "1″",
        ),
      { timeout: 15000 },
    );
    state = await page.evaluate(readActiveSlotState);
    expect(state.hasActive).toBe(true);
    expect(state.bustDart?.enabled).toBe(true);
    expect(state.stepTexts[0]).toMatch(/1″ below the armhole opening/);
    expect(state.instructionText).not.toMatch(/cm/);

    // Switch back to centimeters — dart stays active.
    await page.evaluate(async () => {
      const canon = JSON.parse(localStorage.getItem("kbm_current_pattern") || "{}");
      const pb = JSON.parse(localStorage.getItem("patternBuilderData") || "{}");
      for (const store of [canon, pb]) {
        store.yarnGauge = { ...(store.yarnGauge || {}), gaugeRawUnit: "cm" };
      }
      pb.yarnGaugeMachine = { ...(pb.yarnGaugeMachine || {}), gaugeRawUnit: "cm" };
      localStorage.setItem("kbm_current_pattern", JSON.stringify(canon));
      localStorage.setItem("patternBuilderData", JSON.stringify(pb));
      window.kbmInvalidateSleevelessPatternRender?.();
      await window.kbmRefreshSleevelessPattern?.();
    });
    await page.waitForFunction(
      () =>
        (document.querySelector(".bust-dart-front-slot__instructions")?.textContent || "").includes(
          "2.5 cm",
        ),
      { timeout: 15000 },
    );
    state = await page.evaluate(readActiveSlotState);
    expect(state.hasActive).toBe(true);
    expect(state.stepTexts[0]).toMatch(/2\.5 cm below the armhole opening/);
    expect(state.instructionText).not.toMatch(/″/);
  }, 120000);

  it("Edit Pattern unit switch updates inactive Optional Bust Dart prompt", async () => {
    await unlockGateAndSeed(page, "cm");
    // No dart added — inactive prompt visible with tips on.
    await page.waitForFunction(
      () =>
        (document.querySelector('[data-bust-dart-active="false"] .bust-dart-front-slot__hint')
          ?.textContent || "").includes("2.5 cm"),
      { timeout: 15000 },
    );
    let hint = await page.evaluate(() => {
      const tip = document.querySelector('[data-bust-dart-active="false"] .bust-dart-front-slot__hint');
      return tip?.textContent || "";
    });
    expect(hint).toMatch(/2\.5 cm \/ \d+ rows before the armhole/);
    expect(hint).not.toMatch(/″/);

    await page.evaluate(async () => {
      const canon = JSON.parse(localStorage.getItem("kbm_current_pattern") || "{}");
      const pb = JSON.parse(localStorage.getItem("patternBuilderData") || "{}");
      canon.yarnGauge = { ...(canon.yarnGauge || {}), gaugeRawUnit: "in" };
      pb.yarnGauge = { ...(pb.yarnGauge || {}), gaugeRawUnit: "in" };
      // Stale cm left on machine section must not keep the prompt in cm.
      pb.yarnGaugeMachine = { ...(pb.yarnGaugeMachine || {}), gaugeRawUnit: "cm" };
      localStorage.setItem("kbm_current_pattern", JSON.stringify(canon));
      localStorage.setItem("patternBuilderData", JSON.stringify(pb));
      window.kbmInvalidateSleevelessPatternRender?.();
      await window.kbmRefreshSleevelessPattern?.();
      document.querySelectorAll("[data-show-tips]").forEach((el) => {
        el.setAttribute("data-show-tips", "true");
      });
      const tip = document.querySelector("[data-bust-dart-front-slot]");
      if (tip instanceof HTMLElement) {
        tip.hidden = false;
        tip.style.display = "";
        tip.removeAttribute("data-tip-dismissed");
      }
    });

    await page.waitForFunction(
      () =>
        (document.querySelector('[data-bust-dart-active="false"] .bust-dart-front-slot__hint')
          ?.textContent || "").includes("1″"),
      { timeout: 15000 },
    );
    hint = await page.evaluate(() => {
      const tip = document.querySelector('[data-bust-dart-active="false"] .bust-dart-front-slot__hint');
      return tip?.textContent || "";
    });
    expect(hint).toMatch(/1″ \/ \d+ rows before the armhole/);
    expect(hint).not.toMatch(/cm/);

    // Reverse: inches → centimeters on the same inactive prompt.
    await page.evaluate(async () => {
      const canon = JSON.parse(localStorage.getItem("kbm_current_pattern") || "{}");
      const pb = JSON.parse(localStorage.getItem("patternBuilderData") || "{}");
      canon.yarnGauge = { ...(canon.yarnGauge || {}), gaugeRawUnit: "cm" };
      pb.yarnGauge = { ...(pb.yarnGauge || {}), gaugeRawUnit: "cm" };
      pb.yarnGaugeMachine = { ...(pb.yarnGaugeMachine || {}), gaugeRawUnit: "in" };
      localStorage.setItem("kbm_current_pattern", JSON.stringify(canon));
      localStorage.setItem("patternBuilderData", JSON.stringify(pb));
      window.kbmInvalidateSleevelessPatternRender?.();
      await window.kbmRefreshSleevelessPattern?.();
      document.querySelectorAll("[data-show-tips]").forEach((el) => {
        el.setAttribute("data-show-tips", "true");
      });
      const tip = document.querySelector("[data-bust-dart-front-slot]");
      if (tip instanceof HTMLElement) {
        tip.hidden = false;
        tip.style.display = "";
        tip.removeAttribute("data-tip-dismissed");
      }
    });
    await page.waitForFunction(
      () =>
        (document.querySelector('[data-bust-dart-active="false"] .bust-dart-front-slot__hint')
          ?.textContent || "").includes("2.5 cm"),
      { timeout: 15000 },
    );
    hint = await page.evaluate(() => {
      const tip = document.querySelector('[data-bust-dart-active="false"] .bust-dart-front-slot__hint');
      return tip?.textContent || "";
    });
    expect(hint).toMatch(/2\.5 cm \/ \d+ rows before the armhole/);
    expect(hint).not.toMatch(/″/);
  }, 120000);

  it("Update Pattern changes the saved cup and keeps the active card in view", async () => {
    let hasActive = await page.locator('[data-bust-dart-active="true"]').count();
    if (hasActive === 0) {
      await unlockGateAndSeed(page, "in");
      await addCupDart(page, "C");
      hasActive = await page.locator('[data-bust-dart-active="true"]').count();
    }
    expect(hasActive).toBeGreaterThan(0);

    await clickOpenBustDart(page);
    const updateLabel =
      (await page.locator("[data-bust-dart-modal-add]").textContent())?.trim() || "";
    expect(updateLabel).toMatch(/Update Pattern/i);

    await page.locator("#bust-dart-pattern-cup").selectOption("B");
    await page.waitForTimeout(200);
    await page.locator("[data-bust-dart-modal-add]").click();
    await page.waitForFunction(
      () =>
        (document.querySelector(".bust-dart-front-slot__cup")?.textContent || "").includes("Cup B"),
      { timeout: 15000 },
    );
    await page.waitForTimeout(400);

    const afterUpdate = await page.evaluate(readActiveSlotState);
    expect(afterUpdate.dialogOpen).toBe(false);
    expect(afterUpdate.bustDart).toMatchObject({ enabled: true, cupSize: "B" });
    expect(afterUpdate.cupText).toMatch(/^Cup B$/);
    expect(afterUpdate.instructionText).not.toMatch(/Cup C/);
    expect(afterUpdate.scrollTarget).toBe("active");
    expect(afterUpdate.slotTop).not.toBeNull();
    if (afterUpdate.slotTop != null) {
      expect(afterUpdate.slotTop).toBeLessThan(220);
    }
  }, 120000);

  it("Remove Bust Dart works with one click and returns the optional prompt", async () => {
    let hasActive = await page.locator('[data-bust-dart-active="true"]').count();
    if (hasActive === 0) {
      await unlockGateAndSeed(page, "in");
      await addCupDart(page, "C");
      hasActive = await page.locator('[data-bust-dart-active="true"]').count();
    }
    expect(hasActive).toBeGreaterThan(0);

    // Exactly one click on the live Remove control.
    await page.locator("[data-bust-dart-pattern-remove]").click({ force: true });
    await page.waitForFunction(
      () => !!document.querySelector('[data-bust-dart-front-slot][data-bust-dart-active="false"]'),
      { timeout: 15000 },
    );
    await page.waitForTimeout(300);

    const afterRemove = await page.evaluate(() => {
      const optional = document.querySelector(
        '[data-bust-dart-front-slot][data-bust-dart-active="false"]',
      ) as HTMLElement | null;
      const active = document.querySelector(
        '[data-bust-dart-front-slot][data-bust-dart-active="true"]',
      );
      const guides = document.querySelector(".ns-visual-guides, [id^='ns-visual-guides-heading']");
      let bustDart = null;
      try {
        bustDart = JSON.parse(localStorage.getItem("kbm_current_pattern") || "null")?.style
          ?.bustDart;
      } catch {
        /* ignore */
      }
      return {
        hasActive: !!active,
        hasOptional: !!optional,
        optionalTitle: optional?.querySelector(".bust-dart-front-slot__title")?.textContent?.trim(),
        bustDart,
        slotTop: optional?.getBoundingClientRect().top ?? null,
        guidesTop:
          guides instanceof HTMLElement ? guides.getBoundingClientRect().top : null,
        scrollTarget: optional?.getAttribute("data-bust-dart-scroll-target") || "",
      };
    });

    expect(afterRemove.hasActive).toBe(false);
    expect(afterRemove.hasOptional).toBe(true);
    expect(afterRemove.optionalTitle).toBe("Optional Bust Dart");
    expect(afterRemove.bustDart?.enabled === true).toBe(false);
    expect(afterRemove.scrollTarget).toBe("optional");
    if (afterRemove.slotTop != null) {
      expect(afterRemove.slotTop).toBeLessThan(220);
    }
  }, 120000);

  it("Remove also clears a dart loaded from saved local draft data with one click", async () => {
    await unlockGateAndSeed(page, "in");
    // Seed an already-active dart as if loaded from saved data, then refresh once.
    await page.evaluate(async () => {
      const canon = JSON.parse(localStorage.getItem("kbm_current_pattern") || "{}");
      const pb = JSON.parse(localStorage.getItem("patternBuilderData") || "{}");
      const dart = {
        enabled: true,
        cupSize: "C",
        dartWidthInches: 3.25,
        dartDepthInches: 1,
      };
      canon.style = { ...(canon.style || {}), bustDart: dart };
      pb.style = { ...(pb.style || {}), bustDart: dart };
      localStorage.setItem("kbm_current_pattern", JSON.stringify(canon));
      localStorage.setItem("patternBuilderData", JSON.stringify(pb));
      window.kbmInvalidateSleevelessPatternRender?.();
      await window.kbmRefreshSleevelessPattern?.();
    });
    await page.waitForFunction(
      () => !!document.querySelector('[data-bust-dart-active="true"]'),
      { timeout: 15000 },
    );

    await page.locator("[data-bust-dart-pattern-remove]").click({ force: true });
    await page.waitForFunction(
      () => !!document.querySelector('[data-bust-dart-active="false"]'),
      { timeout: 15000 },
    );

    const after = await page.evaluate(() => {
      let bustDart = null;
      try {
        bustDart = JSON.parse(localStorage.getItem("kbm_current_pattern") || "null")?.style
          ?.bustDart;
      } catch {
        /* ignore */
      }
      return {
        hasActive: !!document.querySelector('[data-bust-dart-active="true"]'),
        hasOptional: !!document.querySelector('[data-bust-dart-active="false"]'),
        bustDart,
      };
    });
    expect(after.hasActive).toBe(false);
    expect(after.hasOptional).toBe(true);
    expect(after.bustDart?.enabled === true).toBe(false);
  }, 120000);

  it("Cancel still closes without saving when nothing is selected", async () => {
    await unlockGateAndSeed(page);
    await clickOpenBustDart(page);
    await page.locator("[data-bust-dart-modal-cancel]").click();
    await page.waitForTimeout(200);

    const afterCancel = await page.evaluate(() => ({
      dialogOpen: (document.querySelector("[data-bust-dart-pattern-modal]") as HTMLDialogElement)
        ?.open,
      bustDart: (() => {
        try {
          return JSON.parse(localStorage.getItem("kbm_current_pattern") || "null")?.style?.bustDart;
        } catch {
          return undefined;
        }
      })(),
      inactive: !!document.querySelector('[data-bust-dart-active="false"]'),
    }));

    expect(afterCancel.dialogOpen).toBe(false);
    expect(afterCancel.inactive).toBe(true);
    expect(afterCancel.bustDart?.enabled === true).toBe(false);
  }, 90000);
});

declare global {
  interface Window {
    __bustDartIntegration?: { commits: number; refreshes: number };
    kbmInvalidateSleevelessPatternRender?: () => void;
    kbmRefreshSleevelessPattern?: () => void | Promise<void>;
  }
}

if (!hasDev) {
  describe("BustDartPatternModal browser integration (skipped)", () => {
    it(`skips — start Astro/Vite at ${DEV_ORIGIN} (or set KBM_DEV_URL) to run the real browser path`, () => {
      expect(hasDev).toBe(false);
    });
  });
}
