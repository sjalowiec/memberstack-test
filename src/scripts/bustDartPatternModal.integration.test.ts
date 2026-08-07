/**
 * Browser integration: Add/Update Bust Dart through the real modal markup + client event path.
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

function seedCompleteWomenPattern(): Record<string, unknown> {
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
    gaugeStitchRaw: "20",
    gaugeRowRaw: "28",
    gaugeRawUnit: "in",
  };
  const yarnGaugeMachine = {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    gaugeStitchRaw: 20,
    gaugeRowRaw: 28,
    gaugeRawUnit: "in",
    availableNeedles: 200,
  };
  return { now, style, fit, yarnGauge, yarnGaugeMachine };
}

async function unlockGateAndSeed(page: Page): Promise<void> {
  const seed = seedCompleteWomenPattern();
  await page.evaluate((payload) => {
    const { now, style, fit, yarnGauge, yarnGaugeMachine } = payload as {
      now: string;
      style: Record<string, unknown>;
      fit: Record<string, unknown>;
      yarnGauge: Record<string, unknown>;
      yarnGaugeMachine: Record<string, unknown>;
    };
    localStorage.removeItem("kbm_custom_pattern_active_project_id");
    localStorage.removeItem("kbm_custom_pattern_active_project_name");
    // Inactive Optional Bust Dart is a `.pattern-tip` — keep Show Tips ON so Add is visible.
    localStorage.setItem("sleeveless-show-tips", "true");
    localStorage.setItem(
      "kbm_current_pattern",
      JSON.stringify({
        id: "bust-dart-integration-" + Date.now(),
        status: "draft",
        version: 1,
        createdAt: now,
        updatedAt: now,
        style,
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
      JSON.stringify({ style, fit, yarnGauge, yarnGaugeMachine, createdAt: now, updatedAt: now }),
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

    // Keep tips visible if the tips scope is already mounted.
    document.querySelectorAll("[data-show-tips]").forEach((el) => {
      el.setAttribute("data-show-tips", "true");
    });
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
  });

  // Wait until Front optional dart control is in the mount (may be tip-hidden until tips forced).
  await page.waitForFunction(
    () => {
      const open = document.querySelectorAll("[data-bust-dart-pattern-open]").length;
      const mountLen = (document.querySelector("[data-sleeveless-mount]")?.innerHTML || "").length;
      return open > 0 && mountLen > 1000;
    },
    { timeout: 30000 },
  );
}

async function clickOpenBustDart(page: Page): Promise<void> {
  await page.evaluate(() => {
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
  // force: tip visibility CSS can still hide the control in headless without layout scroll
  await page.locator("[data-bust-dart-pattern-open]").first().click({ force: true });
  await page.waitForTimeout(300);
}

describe.skipIf(!hasDev)("BustDartPatternModal browser integration (Add / Update)", () => {
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

  it("Add to Pattern commits and inserts active bust-dart knitting instructions", async () => {
    await unlockGateAndSeed(page);

    const openCount = await page.locator("[data-bust-dart-pattern-open]").count();
    expect(openCount).toBeGreaterThan(0);

    // Trace commit callback / state update
    await page.evaluate(() => {
      window.__bustDartIntegration = { commits: 0, refreshes: 0 };
      const origRefresh = window.kbmRefreshSleevelessPattern;
      window.kbmRefreshSleevelessPattern = async (...args: unknown[]) => {
        window.__bustDartIntegration!.refreshes += 1;
        return origRefresh?.(...(args as []));
      };
    });

    await clickOpenBustDart(page);

    const dialogOpen = await page.evaluate(
      () => (document.querySelector("[data-bust-dart-pattern-modal]") as HTMLDialogElement)?.open,
    );
    expect(dialogOpen).toBe(true);
    const addLabel = (await page.locator("[data-bust-dart-modal-add]").textContent())?.trim() || "";
    expect(addLabel).toMatch(/Add to Pattern/i);

    // Select a valid cup preset (fills width/depth via client change handler)
    await page.locator("#bust-dart-pattern-cup").selectOption("C");
    await page.waitForTimeout(200);
    const widthVal = await page.locator("#bust-dart-pattern-width").inputValue();
    const depthVal = await page.locator("#bust-dart-pattern-depth").inputValue();
    expect(widthVal.length).toBeGreaterThan(0);
    expect(depthVal.length).toBeGreaterThan(0);

    // Activate the real Add to Pattern control (delegated click + submit path)
    await page.locator("[data-bust-dart-modal-add]").click();
    await page.waitForTimeout(2000);

    const afterAdd = await page.evaluate(() => {
      const active = document.querySelector(
        '[data-bust-dart-front-slot][data-bust-dart-active="true"]',
      );
      const instructions = active?.querySelector(".bust-dart-front-slot__instructions");
      let bustDart = null;
      try {
        bustDart = JSON.parse(localStorage.getItem("kbm_current_pattern") || "null")?.style
          ?.bustDart;
      } catch {
        /* ignore */
      }
      return {
        dialogOpen: (document.querySelector("[data-bust-dart-pattern-modal]") as HTMLDialogElement)
          ?.open,
        hasActive: !!active,
        instructionText: instructions?.textContent || "",
        bustDart,
        refreshes: window.__bustDartIntegration?.refreshes ?? 0,
        addLabel: document
          .querySelector("[data-bust-dart-modal-add]")
          ?.textContent?.trim(),
      };
    });

    expect(afterAdd.dialogOpen).toBe(false);
    expect(afterAdd.bustDart).toMatchObject({
      enabled: true,
      cupSize: "C",
    });
    expect(afterAdd.hasActive).toBe(true);
    expect(afterAdd.instructionText).toMatch(/Work the short-row bust darts, Cup C\./i);
    expect(afterAdd.instructionText).toMatch(/place .+ needles in hold/i);
    expect(afterAdd.refreshes).toBeGreaterThan(0);
  }, 120000);

  it("Update Pattern changes the saved cup and regenerates knitting instructions", async () => {
    // Continues from Add test state when run in order; re-seed+add if needed.
    let hasActive = await page.locator('[data-bust-dart-active="true"]').count();
    if (hasActive === 0) {
      await unlockGateAndSeed(page);
      await clickOpenBustDart(page);
      await page.locator("#bust-dart-pattern-cup").selectOption("C");
      await page.locator("[data-bust-dart-modal-add]").click();
      await page.waitForTimeout(1500);
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
    await page.waitForTimeout(2000);

    const afterUpdate = await page.evaluate(() => {
      const active = document.querySelector(
        '[data-bust-dart-front-slot][data-bust-dart-active="true"]',
      );
      const instructions = active?.querySelector(".bust-dart-front-slot__instructions");
      let bustDart = null;
      try {
        bustDart = JSON.parse(localStorage.getItem("kbm_current_pattern") || "null")?.style
          ?.bustDart;
      } catch {
        /* ignore */
      }
      return {
        dialogOpen: (document.querySelector("[data-bust-dart-pattern-modal]") as HTMLDialogElement)
          ?.open,
        instructionText: instructions?.textContent || "",
        bustDart,
      };
    });

    expect(afterUpdate.dialogOpen).toBe(false);
    expect(afterUpdate.bustDart).toMatchObject({
      enabled: true,
      cupSize: "B",
    });
    expect(afterUpdate.instructionText).toMatch(/Work the short-row bust darts, Cup B\./i);
    expect(afterUpdate.instructionText).not.toMatch(/Cup C\./);
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
  }
}

if (!hasDev) {
  describe("BustDartPatternModal browser integration (skipped)", () => {
    it(`skips — start Astro/Vite at ${DEV_ORIGIN} (or set KBM_DEV_URL) to run the real browser path`, () => {
      expect(hasDev).toBe(false);
    });
  });
}
