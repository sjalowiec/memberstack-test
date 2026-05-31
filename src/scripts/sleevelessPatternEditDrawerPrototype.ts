/**
 * Edit Pattern drawer + Measurement editor for the saved sleeveless pattern view.
 *
 * Two surfaces:
 *  1. Edit Pattern drawer (right-side desktop / full-screen mobile) — the primary place to edit
 *     pattern settings (Pattern Setup: size, garment, neckline, fit/ease; Gauge: stitch, row,
 *     needles). "Apply Changes" reuses the existing sleeveless build workflow end-to-end:
 *       - writes the same wizard storage keys (express builder `values`, `garmentType`,
 *         `necklineStyle`) and gauge sections used by Custom Build / Express,
 *       - runs `syncCustomBuildToPatternStorage()` (re-derives chart measurements),
 *       - validates with `validatePatternBuilderRequired` + `isValidExpressSizeForAudience`,
 *       - regenerates via `window.kbmRefreshSleevelessPattern()` (no second pipeline).
 *     "Who you are knitting for" (Women / Men / Kids / Babies) is shown locked — it fixes the
 *     drafting system / sizing chart and is never edited here.
 *  2. Full-screen Measurement editor workspace, reached from the drawer. This hosts the REAL
 *     Custom Build measurement editor (`initCustomBuildMeasurementsPage`). Its layout + behavior
 *     are intentionally left unchanged (the workspace snapshots/restores storage so its edits are
 *     applied there, not from this drawer).
 */
import { initCustomBuildMeasurementsPage } from "./sleeveless-custom-build-measurements-page";
import { applySleevelessPatternOnlineProjectHeader } from "./sleevelessPatternOnlineProjectHeader";
import {
  PATTERN_BUILDER_DATA_KEY,
  PATTERN_STORAGE_KEY,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
  getCurrentPattern,
  getPatternData,
  getSleevelessChartAudience,
  saveCurrentPattern,
  savePatternData,
} from "../lib/patterns/patternStorage";
import { LEGACY_STANDALONE_MEASUREMENTS_KEY } from "../lib/patterns/sleevelessCustomMeasurementStorage";
import { syncCustomBuildToPatternStorage } from "../lib/patterns/syncCustomBuildToPatternStorage";
import {
  isPositiveNumericMeasurement,
  validatePatternBuilderRequired,
} from "../lib/patterns/patternBuilderValidation";
import {
  formatBustChestDisplay,
  getExpressChartRowsForAudience,
  getExpressUiUnit,
  isValidExpressSizeForAudience,
  loadExpressSweaterCharts,
  normalizeChartRowSize,
} from "../lib/patterns/sleevelessExpressSizeChartClient";
import {
  readCustomBuildWizardGarmentType,
  readCustomBuildWizardNeckline,
  CUSTOM_BUILD_NECKLINE_STYLE_KEY,
} from "../lib/patterns/sleevelessCustomBuildWizardNeckline";
import {
  writeSleevelessGarmentTypeLocalStorage,
  type SleevelessGarmentType,
} from "../lib/patterns/writeSleevelessGarmentSelection";

/** localStorage keys the reused measurement editor may write to (snapshot/restore for discard). */
const MEASURE_STORAGE_KEYS = [
  PATTERN_STORAGE_KEY,
  PATTERN_BUILDER_DATA_KEY,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
  LEGACY_STANDALONE_MEASUREMENTS_KEY,
] as const;

/** Ease (inches) applied per fit preference — mirrors `computeDefaultMeasurementsFromChartRow`. */
const EASE_INCHES_BY_FIT: Record<string, number> = { close: 1, standard: 3, relaxed: 5 };

const AUDIENCE_DISPLAY_LABELS: Record<string, string> = {
  misses: "Women",
  plus: "Women",
  men: "Men",
  kids: "Kids",
  baby: "Babies",
};

type StorageSnapshot = Map<string, string | null>;

function snapshotMeasureStorage(): StorageSnapshot {
  const snap: StorageSnapshot = new Map();
  if (typeof localStorage === "undefined") return snap;
  for (const key of MEASURE_STORAGE_KEYS) {
    snap.set(key, localStorage.getItem(key));
  }
  return snap;
}

function restoreMeasureStorage(snap: StorageSnapshot | null): void {
  if (!snap || typeof localStorage === "undefined") return;
  snap.forEach((value, key) => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* quota / ignore */
    }
  });
}

type FieldSnapshot = {
  inputs: Map<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, string>;
  checks: Map<HTMLInputElement, boolean>;
};

function snapshotFields(scope: HTMLElement | null): FieldSnapshot {
  const inputs = new Map<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, string>();
  const checks = new Map<HTMLInputElement, boolean>();
  if (!scope) return { inputs, checks };
  scope
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select",
    )
    .forEach((el) => {
      if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) {
        checks.set(el, el.checked);
      } else {
        inputs.set(el, el.value);
      }
    });
  return { inputs, checks };
}

function restoreFields(snap: FieldSnapshot | null): void {
  if (!snap) return;
  snap.inputs.forEach((value, el) => {
    el.value = value;
  });
  snap.checks.forEach((checked, el) => {
    el.checked = checked;
  });
}

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj as Record<string, unknown>;
  return {};
}

function readExpressValues(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    const v = (p as { values?: unknown })?.values;
    if (v && typeof v === "object" && !Array.isArray(v)) return { ...(v as Record<string, string>) };
  } catch {
    /* ignore */
  }
  return {};
}

/** Merge a partial into the express builder `values` (same shape Custom Build / Express write). */
function patchExpressValues(partial: Record<string, string>): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const prevVals =
      prev.values && typeof prev.values === "object" && !Array.isArray(prev.values)
        ? { ...(prev.values as Record<string, string>) }
        : {};
    const values = { ...prevVals, ...partial };
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({ ...prev, values }),
    );
  } catch {
    /* quota */
  }
}

function writeLocalStorageString(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota */
  }
}

function readCurrentBodyShape(): "straight" | "aline" {
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem("bodyShape")?.trim();
      if (raw === "aline" || raw === "straight") return raw;
    } catch {
      /* ignore */
    }
  }
  const canon = String(section(getCurrentPattern().style).bodyShape ?? "").trim().toLowerCase();
  return canon === "aline" ? "aline" : "straight";
}

/** Express `values.front` / `values.style` pair Custom Build relies on (mirror of style page). */
function expressStyleKeyFor(bodyShape: string, garment: string): { front: "open" | "closed"; style: string } {
  const shape = bodyShape === "aline" ? "aline" : "straight";
  const front: "open" | "closed" = garment === "cardigan" ? "open" : "closed";
  const style =
    shape === "straight" && front === "closed"
      ? "straight-pullover"
      : shape === "aline" && front === "closed"
        ? "shaped-pullover"
        : shape === "straight" && front === "open"
          ? "straight-cardigan"
          : "shaped-cardigan";
  return { front, style };
}

function escapeAttr(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getRequestRefresh(): (() => unknown) | null {
  const fn = (window as unknown as { kbmRefreshSleevelessPattern?: () => unknown })
    .kbmRefreshSleevelessPattern;
  return typeof fn === "function" ? fn : null;
}

function initSleevelessPatternEditDrawer(): void {
  const drawer = document.querySelector<HTMLElement>("[data-sl-edit-drawer]");
  const openBtn = document.querySelector<HTMLElement>("[data-sl-edit-open]");
  if (!drawer || !openBtn) return;

  const drawerPanel = drawer.querySelector<HTMLElement>(".sl-edit-drawer__panel");
  const drawerBody = drawer.querySelector<HTMLElement>(".sl-edit-drawer__body");
  const savedNote = drawer.querySelector<HTMLElement>("[data-sl-edit-note]");
  const errorNote = drawer.querySelector<HTMLElement>("[data-sl-edit-errors]");
  const applyBtn = drawer.querySelector<HTMLButtonElement>("[data-sl-edit-apply]");
  const drawerCloseEls = Array.from(drawer.querySelectorAll<HTMLElement>("[data-sl-edit-close]"));

  const titleInput = drawer.querySelector<HTMLInputElement>("#sl-edit-title");
  const audienceEl = drawer.querySelector<HTMLElement>("[data-sl-edit-audience]");
  const sizeSelect = drawer.querySelector<HTMLSelectElement>("[data-sl-edit-size]");
  const easeEl = drawer.querySelector<HTMLElement>("[data-sl-edit-ease]");
  const spiInput = drawer.querySelector<HTMLInputElement>("#sl-edit-spi");
  const rpiInput = drawer.querySelector<HTMLInputElement>("#sl-edit-rpi");
  const needlesInput = drawer.querySelector<HTMLInputElement>("#sl-edit-needles");

  const measure = document.querySelector<HTMLElement>("[data-sl-measure-workspace]");
  const measureInner = measure?.querySelector<HTMLElement>(".sl-measure-workspace__inner") ?? null;
  const measureBody = measure?.querySelector<HTMLElement>(".sl-measure-workspace__body") ?? null;
  const measureNote = measure?.querySelector<HTMLElement>("[data-sl-measure-note]") ?? null;
  const measureOpenBtn = drawer.querySelector<HTMLElement>("[data-sl-measure-open]");
  const measureApplyBtn = measure?.querySelector<HTMLElement>("[data-sl-measure-apply]") ?? null;
  const measureCloseEls = measure
    ? Array.from(
        measure.querySelectorAll<HTMLElement>("[data-sl-measure-back], [data-sl-measure-cancel]"),
      )
    : [];

  let drawerSnapshot: FieldSnapshot | null = null;
  let chartsLoaded = false;
  let chartsLoadStarted = false;

  function radioValue(name: string): string {
    const el = drawer!.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);
    return el?.value ?? "";
  }

  function setRadio(name: string, value: string): void {
    const els = drawer!.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`);
    let matched = false;
    els.forEach((el) => {
      const on = el.value === value;
      el.checked = on;
      if (on) matched = true;
    });
    if (!matched && els.length > 0) els[0].checked = true;
  }

  function resolveAudience(): string {
    return getSleevelessChartAudience(getCurrentPattern()) || "misses";
  }

  function updateEaseReadout(): void {
    if (!easeEl) return;
    const fit = radioValue("sl-edit-fit") || "standard";
    const ease = EASE_INCHES_BY_FIT[fit] ?? EASE_INCHES_BY_FIT.standard;
    const label = fit.charAt(0).toUpperCase() + fit.slice(1);
    easeEl.textContent = `${label} fit · about +${ease}″ ease (applied to the chart measurements).`;
  }

  function populateSizeOptions(audience: string, currentSize: string): void {
    if (!sizeSelect) return;
    const rows = getExpressChartRowsForAudience(audience);
    const unit = getExpressUiUnit();
    if (rows.length === 0) {
      sizeSelect.innerHTML = `<option value="">${escapeHtml(
        chartsLoaded ? "No sizes available" : "Loading sizes…",
      )}</option>`;
      return;
    }
    const opts = rows
      .map((row) => {
        const sz = normalizeChartRowSize(row);
        if (!sz) return "";
        const meas = formatBustChestDisplay(row, unit);
        return `<option value="${escapeAttr(sz)}">${escapeHtml(`${sz} — ${meas}`)}</option>`;
      })
      .join("");
    sizeSelect.innerHTML = `<option value="">${escapeHtml("Choose a size…")}</option>${opts}`;
    sizeSelect.value =
      currentSize && isValidExpressSizeForAudience(audience, currentSize) ? currentSize : "";
  }

  /** Fill every drawer control from the current pattern storage (source of truth). */
  function populateFromStorage(): void {
    const pattern = getCurrentPattern();
    const st = section(pattern.style);
    const ft = section(pattern.fit);
    const yg = section(pattern.yarnGauge);
    const machine = section(pattern.machine);
    const ygm = section(getPatternData().yarnGaugeMachine);
    const ev = readExpressValues();

    if (titleInput) {
      const title =
        pattern.patternProject && typeof pattern.patternProject.title === "string"
          ? pattern.patternProject.title
          : "";
      titleInput.value = title;
    }

    const audience = resolveAudience();
    if (audienceEl) audienceEl.textContent = AUDIENCE_DISPLAY_LABELS[audience] ?? "Women";

    populateSizeOptions(audience, typeof ft.selectedSize === "string" ? ft.selectedSize : "");

    const garment =
      readCustomBuildWizardGarmentType() ||
      (st.garmentStyle === "cardigan" || st.frontStyle === "open" ? "cardigan" : "pullover");
    setRadio("sl-edit-garment", garment);

    const neckline =
      readCustomBuildWizardNeckline() || (st.neckline === "v" ? "v-neck" : "round");
    setRadio("sl-edit-neckline", neckline === "v" ? "v-neck" : neckline);

    const fit =
      ev.fit === "close" || ev.fit === "standard" || ev.fit === "relaxed"
        ? ev.fit
        : ft.easeChoice === "close" || ft.easeChoice === "standard" || ft.easeChoice === "relaxed"
          ? (ft.easeChoice as string)
          : ft.fitChoice === "close" || ft.fitChoice === "standard" || ft.fitChoice === "relaxed"
            ? (ft.fitChoice as string)
            : "standard";
    setRadio("sl-edit-fit", fit);
    updateEaseReadout();

    if (spiInput) {
      spiInput.value = String(yg.stitchGauge ?? ygm.gaugeStitchesPerInch ?? "");
    }
    if (rpiInput) {
      rpiInput.value = String(yg.rowGauge ?? ygm.gaugeRowsPerInch ?? "");
    }
    if (needlesInput) {
      needlesInput.value = String(machine.availableNeedles ?? ygm.availableNeedles ?? "");
    }
  }

  function ensureChartsLoaded(): void {
    if (chartsLoaded || chartsLoadStarted) {
      if (chartsLoaded) populateSizeOptions(resolveAudience(), sizeSelect?.value ?? "");
      return;
    }
    chartsLoadStarted = true;
    void loadExpressSweaterCharts()
      .then(() => {
        chartsLoaded = true;
        const ft = section(getCurrentPattern().fit);
        populateSizeOptions(resolveAudience(), typeof ft.selectedSize === "string" ? ft.selectedSize : "");
      })
      .catch(() => {
        chartsLoadStarted = false;
        if (sizeSelect) {
          sizeSelect.innerHTML = `<option value="">${escapeHtml(
            "Could not load sizes — refresh and try again.",
          )}</option>`;
        }
      });
  }

  function clearNotes(): void {
    if (savedNote) savedNote.hidden = true;
    if (errorNote) {
      errorNote.hidden = true;
      errorNote.textContent = "";
    }
  }

  function showErrors(messages: string[]): void {
    if (!errorNote) return;
    errorNote.innerHTML = messages.map((m) => escapeHtml(m)).join("<br />");
    errorNote.hidden = false;
    if (savedNote) savedNote.hidden = true;
  }

  const lockScroll = (): void => {
    document.body.style.overflow = "hidden";
  };
  const unlockScroll = (): void => {
    document.body.style.overflow = "";
  };

  function openDrawer(): void {
    if (drawer!.classList.contains("is-open")) return;
    clearNotes();
    populateFromStorage();
    ensureChartsLoaded();
    // Snapshot after populating so Cancel/Esc reverts to the freshly-loaded values.
    drawerSnapshot = snapshotFields(drawerBody);
    drawer!.classList.add("is-open");
    drawer!.setAttribute("aria-hidden", "false");
    lockScroll();
    window.requestAnimationFrame(() => {
      (drawerPanel ?? drawer!).focus();
    });
  }

  // Hide the drawer without discarding its values (used when stepping into measurements).
  function hideDrawerForHandoff(): void {
    drawer!.classList.remove("is-open");
    drawer!.setAttribute("aria-hidden", "true");
  }

  function closeDrawer(opts: { discardEdits?: boolean } = {}): void {
    if (!drawer!.classList.contains("is-open")) return;
    if (opts.discardEdits !== false) {
      restoreFields(drawerSnapshot);
    }
    drawerSnapshot = null;
    drawer!.classList.remove("is-open");
    drawer!.setAttribute("aria-hidden", "true");
    unlockScroll();
    if (typeof openBtn!.focus === "function") openBtn!.focus();
  }

  /** Validate, persist (reusing the build workflow), regenerate, and return to the pattern. */
  async function applyChanges(): Promise<void> {
    if (!applyBtn) return;
    const audience = resolveAudience();
    const size = sizeSelect?.value.trim() ?? "";
    const garment = (radioValue("sl-edit-garment") || "pullover") as SleevelessGarmentType;
    const neckline = radioValue("sl-edit-neckline") === "v-neck" ? "v-neck" : "round";
    const fit = radioValue("sl-edit-fit") || "standard";
    const spi = spiInput?.value.trim() ?? "";
    const rpi = rpiInput?.value.trim() ?? "";
    const needles = needlesInput?.value.trim() ?? "";

    const errors: string[] = [];
    if (!size || !isValidExpressSizeForAudience(audience, size)) {
      errors.push("Choose a size.");
    }
    if (!isPositiveNumericMeasurement(spi)) errors.push("Enter a stitch gauge greater than 0.");
    if (!isPositiveNumericMeasurement(rpi)) errors.push("Enter a row gauge greater than 0.");
    if (!isPositiveNumericMeasurement(needles)) errors.push("Enter the number of needles.");
    if (errors.length > 0) {
      showErrors(errors);
      return;
    }

    applyBtn.disabled = true;
    try {
      const bodyShape = readCurrentBodyShape();
      const { front, style } = expressStyleKeyFor(bodyShape, garment);

      // 1) Pattern Setup → same wizard storage the Custom Build / Express steps write.
      patchExpressValues({
        selectedSize: size,
        neckline,
        fit,
        front,
        style,
        shape: bodyShape,
      });
      writeSleevelessGarmentTypeLocalStorage(garment);
      writeLocalStorageString(CUSTOM_BUILD_NECKLINE_STYLE_KEY, neckline);
      writeLocalStorageString("bodyShape", bodyShape);

      // Title (online project header) — reuses patternProject meta (preserve existing notes).
      if (titleInput) {
        const prevProject = getCurrentPattern().patternProject;
        const notes = prevProject && typeof prevProject.notes === "string" ? prevProject.notes : "";
        saveCurrentPattern({
          patternProject: { title: titleInput.value.trim(), notes, titleCustomized: true },
        });
      }

      // 2) Map wizard selections into canonical + patternBuilderData (re-derives measurements).
      syncCustomBuildToPatternStorage({ awaitCharts: false });

      // 3) Gauge → same canonical + patternBuilderData sections the gauge step / Express write.
      const prevYgm = section(getPatternData().yarnGaugeMachine);
      saveCurrentPattern({
        yarnGauge: { stitchGauge: spi, rowGauge: rpi, gaugeUnits: "per_inch" },
        machine: { availableNeedles: needles },
      });
      savePatternData("yarnGauge", { stitchGauge: spi, rowGauge: rpi, gaugeUnits: "per_inch" });
      savePatternData("yarnGaugeMachine", {
        ...prevYgm,
        gaugeStitchesPerInch: spi,
        gaugeRowsPerInch: rpi,
        availableNeedles: needles,
      });

      // Defensive: confirm the shared validator agrees before regenerating.
      const validation = validatePatternBuilderRequired(getPatternData());
      if (!validation.ok) {
        showErrors(validation.missingItems.map((m) => m.label));
        return;
      }

      // 4) Refresh the visible title, then regenerate using the existing pipeline only.
      applySleevelessPatternOnlineProjectHeader();
      const refresh = getRequestRefresh();
      if (refresh) await refresh();

      // 5) Return to the updated pattern view.
      if (savedNote) savedNote.hidden = false;
      closeDrawer({ discardEdits: false });
      const top = document.getElementById("sleeveless-pattern-top");
      if (top) {
        top.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (err) {
      console.error("[Edit Pattern] Apply Changes failed:", err);
      showErrors(["We couldn't update the pattern. Please try again."]);
    } finally {
      applyBtn.disabled = false;
    }
  }

  function openMeasure(): void {
    if (!measure || measure.classList.contains("is-open")) return;
    hideDrawerForHandoff();
    if (measureNote) measureNote.hidden = true;
    measure.classList.add("is-open");
    measure.setAttribute("aria-hidden", "false");
    lockScroll();

    if (!measureInitialized) {
      measureInitialized = true;
      measureStorageBaseline = snapshotMeasureStorage();
      window.requestAnimationFrame(() => {
        initCustomBuildMeasurementsPage();
        captureMeasureFieldBaseline();
      });
    }

    window.requestAnimationFrame(() => {
      (measureInner ?? measure).focus();
    });
  }

  function closeMeasure(): void {
    if (!measure || !measure.classList.contains("is-open")) return;
    // Measurements are applied within the workspace itself; discard temporary edits here.
    restoreMeasureFieldBaseline();
    restoreMeasureStorage(measureStorageBaseline);
    if (measureNote) measureNote.hidden = true;
    measure.classList.remove("is-open");
    measure.setAttribute("aria-hidden", "true");
    unlockScroll();
    if (measureOpenBtn && typeof measureOpenBtn.focus === "function") {
      measureOpenBtn.focus();
    } else if (openBtn && typeof openBtn.focus === "function") {
      openBtn.focus();
    }
  }

  // Reused measurement editor is initialised once, lazily, the first time the workspace opens.
  let measureInitialized = false;
  let measureStorageBaseline: StorageSnapshot | null = null;
  let measureFieldBaseline: Map<string, string> | null = null;

  function captureMeasureFieldBaseline(attempts = 0): void {
    if (!measureBody) return;
    const inputs = measureBody.querySelectorAll<HTMLInputElement>("[data-cb-measure-input]");
    if (inputs.length === 0) {
      if (attempts >= 360) return;
      window.requestAnimationFrame(() => captureMeasureFieldBaseline(attempts + 1));
      return;
    }
    const baseline = new Map<string, string>();
    inputs.forEach((el) => {
      const key = el.getAttribute("data-cb-measure-input");
      if (key) baseline.set(key, el.value);
    });
    measureFieldBaseline = baseline;
  }

  function restoreMeasureFieldBaseline(): void {
    if (!measureBody || !measureFieldBaseline) return;
    measureFieldBaseline.forEach((value, key) => {
      const el = measureBody.querySelector<HTMLInputElement>(`[data-cb-measure-input="${key}"]`);
      if (el) el.value = value;
    });
  }

  openBtn.addEventListener("click", openDrawer);
  drawerCloseEls.forEach((el) => el.addEventListener("click", () => closeDrawer()));

  drawer.querySelectorAll<HTMLInputElement>('input[name="sl-edit-fit"]').forEach((el) => {
    el.addEventListener("change", updateEaseReadout);
  });

  if (measureOpenBtn) measureOpenBtn.addEventListener("click", openMeasure);
  measureCloseEls.forEach((el) => el.addEventListener("click", closeMeasure));

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (measure && measure.classList.contains("is-open")) {
      closeMeasure();
    } else if (drawer.classList.contains("is-open")) {
      closeDrawer();
    }
  });

  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      void applyChanges();
    });
  }

  if (measureApplyBtn) {
    measureApplyBtn.addEventListener("click", () => {
      console.log(
        "[Measurement editor] Apply Measurements clicked — measurement workspace handling is unchanged.",
      );
      if (measureNote) measureNote.hidden = false;
    });
  }
}

if (typeof document !== "undefined") {
  const boot = (): void => initSleevelessPatternEditDrawer();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
