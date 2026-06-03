/**
 * Edit Pattern — ONE combined editing workspace for the saved sleeveless pattern view.
 *
 * A single full-width overlay holds both halves at once (no extra "Edit Measurements" click):
 *  - LEFT: quick edits (Size, Front style, Neckline, Fit, Gauge, Available needles).
 *  - RIGHT: the REAL Custom Build measurement SVG editor (`initCustomBuildMeasurementsPage`),
 *    reused as-is (same pattern_summary.svg, labels, field names, overlay positions). It is
 *    initialised lazily the first time the workspace opens.
 *
 * "Update Pattern" reuses the existing sleeveless build workflow end-to-end:
 *   - writes the same wizard storage keys (express builder `values`, `garmentType`,
 *     `necklineStyle`) and gauge sections used by Custom Build / Express,
 *   - runs `syncCustomBuildToPatternStorage()` — which already folds the measurement editor's
 *     `cbMeasurementOverrides` into pattern data, so SVG edits flow through the same pipeline
 *     (no new pattern math here),
 *   - validates with `validatePatternBuilderRequired` + `isValidExpressSizeForAudience`,
 *   - regenerates via `window.kbmRefreshSleevelessPattern()` (no second pipeline).
 *
 * Cancel/Esc discards both the quick-edit field changes and any measurement edits (storage
 * baseline is snapshotted on open and restored on discard). Update keeps them.
 * The recipient/audience ("Who") is intentionally NOT editable here — it fixes the sizing chart.
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
import {
  LEGACY_STANDALONE_MEASUREMENTS_KEY,
  loadMeasurementOverrides,
  persistMeasurementOverrides,
} from "../lib/patterns/sleevelessCustomMeasurementStorage";
import { computeFitDerivedMeasurementOverrides } from "../lib/patterns/sleevelessEditFitRecalc";
import { syncCustomBuildToPatternStorage } from "../lib/patterns/syncCustomBuildToPatternStorage";
import {
  isPositiveNumericMeasurement,
  validatePatternBuilderRequired,
} from "../lib/patterns/patternBuilderValidation";
import {
  findExpressChartRow,
  getExpressChartRowsForAudience,
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
import { rawSwatchToPerInch } from "../lib/patterns/syncExpressWizardToPatternStorage";
import {
  formatSwatchCountForGaugeInput,
  swatchCountFromPerInchForDisplay,
  type GaugeSwatchBasis,
} from "../lib/patterns/gaugeDisplayFormat";
import { canEditSleevelessPatternSettings } from "../lib/patterns/sleevelessPatternSystemAccess";
import { resolveSleevelessUserAccess } from "../lib/patterns/sleevelessPatternSystemAccessClient";

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

/**
 * Swatch-basis gauge convention used throughout the sleeveless experience: machine knitters
 * read gauge as stitches/rows over 4" (or 10 cm), never per-inch. The drawer therefore shows
 * and collects swatch counts; per-inch values for the pattern engine are derived on save.
 */
function gaugeBasisLabelSuffix(basis: GaugeSwatchBasis): string {
  return basis === "cm" ? 'per 10cm' : 'per 4"';
}

/** Swatch count to show in a gauge input: prefer the stored raw count, else derive from per-inch. */
function swatchDisplayValue(raw: unknown, perInch: unknown, basis: GaugeSwatchBasis): string {
  const r = parseFloat(String(raw ?? "").trim());
  if (Number.isFinite(r) && r > 0) return formatSwatchCountForGaugeInput(r);
  const p = parseFloat(String(perInch ?? "").trim());
  if (Number.isFinite(p) && p > 0) return swatchCountFromPerInchForDisplay(p, basis);
  return "";
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
  const notesInput = drawer.querySelector<HTMLTextAreaElement>("#sl-edit-notes");
  const audienceEl = drawer.querySelector<HTMLElement>("[data-sl-edit-audience]");
  const sizeSelect = drawer.querySelector<HTMLSelectElement>("[data-sl-edit-size]");
  const easeEl = drawer.querySelector<HTMLElement>("[data-sl-edit-ease]");
  const spiInput = drawer.querySelector<HTMLInputElement>("#sl-edit-spi");
  const rpiInput = drawer.querySelector<HTMLInputElement>("#sl-edit-rpi");
  const spiLabel = drawer.querySelector<HTMLElement>("[data-sl-edit-spi-label]");
  const rpiLabel = drawer.querySelector<HTMLElement>("[data-sl-edit-rpi-label]");
  const needlesInput = drawer.querySelector<HTMLInputElement>("#sl-edit-needles");

  // Measurement SVG editor lives in the right column of the SAME workspace now
  // (no separate full-screen surface). `.sl-measure-workspace__body` is kept so the
  // existing scoped diagram-sizing CSS still applies.
  const measurePane = drawer.querySelector<HTMLElement>("[data-sl-measure-pane]");
  const measureBody = measurePane?.querySelector<HTMLElement>(".sl-measure-workspace__body") ?? null;

  let drawerSnapshot: FieldSnapshot | null = null;
  let chartsLoaded = false;
  let chartsLoadStarted = false;
  // Entitlement gate: gauge / measurements / style edits + regeneration are only available to
  // users with active Sleeveless Pattern System access. Resolved async below; defaults to
  // unlocked so members aren't briefly blocked, then locks the drawer if access is absent.
  // (Title/notes stay editable for everyone via the Pattern Setup tab → Customize page.)
  let settingsEditingLocked = false;

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

  /** Swatch basis (4" vs 10 cm) the saved gauge was entered in — mirrors the pattern summary. */
  function resolveGaugeBasis(): GaugeSwatchBasis {
    const yg = section(getCurrentPattern().yarnGauge);
    const ygm = section(getPatternData().yarnGaugeMachine);
    return ygm.gaugeRawUnit === "cm" || yg.gaugeRawUnit === "cm" ? "cm" : "in";
  }

  function updateGaugeLabels(basis: GaugeSwatchBasis): void {
    const suffix = gaugeBasisLabelSuffix(basis);
    if (spiLabel) spiLabel.textContent = `Stitch gauge (${suffix})`;
    if (rpiLabel) rpiLabel.textContent = `Row gauge (${suffix})`;
  }

  function updateEaseReadout(): void {
    if (!easeEl) return;
    const fit = radioValue("sl-edit-fit") || "standard";
    const ease = EASE_INCHES_BY_FIT[fit] ?? EASE_INCHES_BY_FIT.standard;
    const label = fit.charAt(0).toUpperCase() + fit.slice(1);
    easeEl.textContent = `${label} fit · about +${ease}″ ease (applied to the chart measurements).`;
  }

  /** Write a recomputed inches value into a measurement diagram input (when it has rendered). */
  function setMeasurementInputValue(key: string, displayInches: string): void {
    if (!measureBody || !displayInches) return;
    const input = measureBody.querySelector<HTMLInputElement>(`[data-cb-measure-input="${key}"]`);
    if (input) input.value = displayInches;
  }

  /**
   * Fit is a LIVE recalculation control: changing it must refresh the finished bust/chest and hip
   * from the body chart row + new ease, both in the visible measurement diagram and in the stored
   * `cbMeasurementOverrides` that the save/regeneration pipeline reads. Without this, the finished
   * circumference stays at the value captured when the pattern was first built (e.g. Close 22″
   * never moves to Standard 24″). Non-ease fields (shoulder, armhole, neck, length, hem) are left
   * untouched.
   */
  function recalcFitDerivedMeasurements(): void {
    if (typeof localStorage === "undefined") return;
    if (!chartsLoaded) {
      // Charts power the body row lookup; load once then retry so the first fit change still applies.
      void loadExpressSweaterCharts()
        .then(() => {
          chartsLoaded = true;
          recalcFitDerivedMeasurements();
        })
        .catch(() => {});
      return;
    }

    const audience = resolveAudience();
    const ft = section(getCurrentPattern().fit);
    const size =
      sizeSelect?.value.trim() ||
      (typeof ft.selectedSize === "string" ? ft.selectedSize.trim() : "");
    if (!size || !isValidExpressSizeForAudience(audience, size)) return;

    const row = findExpressChartRow(audience, size);
    if (!row) return;

    const fit = radioValue("sl-edit-fit") || "standard";
    const bodyShape = readCurrentBodyShape();
    const overrides = computeFitDerivedMeasurementOverrides(row, fit, {
      bodyShape,
      existingOverrides: loadMeasurementOverrides(),
    });

    // Persist so the save/regeneration pipeline (and any re-render of the diagram) uses the new
    // values even if the diagram inputs have not finished rendering yet. Restored on Cancel via
    // the measurement-storage baseline snapshotted on open.
    persistMeasurementOverrides(overrides);
    setMeasurementInputValue("chestBust", overrides.chestBust ?? "");
    setMeasurementInputValue("hip", overrides.hip ?? "");
  }

  function populateSizeOptions(audience: string, currentSize: string): void {
    if (!sizeSelect) return;
    const rows = getExpressChartRowsForAudience(audience);
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
        // Show only the size label here. The finished garment measurements live on the
        // SVG (the source of truth); displaying the chart bust/chest here too created a
        // confusing "two sources of truth" alongside the SVG's Finished Bust Circ.
        return `<option value="${escapeAttr(sz)}">${escapeHtml(`Size ${sz}`)}</option>`;
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

    if (notesInput) {
      const notes =
        pattern.patternProject && typeof pattern.patternProject.notes === "string"
          ? pattern.patternProject.notes
          : "";
      notesInput.value = notes;
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

    // Gauge is shown in the machine-knitting convention (sts/rows over 4" or 10 cm), matching
    // the pattern summary. Per-inch values used by the engine are derived on save.
    const gaugeBasis = resolveGaugeBasis();
    updateGaugeLabels(gaugeBasis);
    if (spiInput) {
      spiInput.value = swatchDisplayValue(
        yg.gaugeStitchRaw ?? ygm.gaugeStitchRaw,
        yg.stitchGauge ?? ygm.gaugeStitchesPerInch,
        gaugeBasis,
      );
    }
    if (rpiInput) {
      rpiInput.value = swatchDisplayValue(
        yg.gaugeRowRaw ?? ygm.gaugeRowRaw,
        yg.rowGauge ?? ygm.gaugeRowsPerInch,
        gaugeBasis,
      );
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

  // Anchor the workspace panel directly below the REAL fixed site chrome (env banner +
  // header + "What's New" beta strip). The CSS fallback uses --header-offset, which is
  // floored at 170px, so when the live header is shorter the panel sat too low and the dark
  // backdrop showed through as a grey strip. Measuring .kbm-header-wrap's rendered bottom
  // keeps the editor as high as possible without sliding under the fixed header.
  const syncPanelTop = (): void => {
    const header = document.querySelector<HTMLElement>(".kbm-header-wrap");
    if (!header) return;
    const bottom = Math.max(0, Math.round(header.getBoundingClientRect().bottom));
    drawer!.style.setProperty("--sl-edit-panel-top", `${bottom}px`);
  };

  const lockScroll = (): void => {
    document.body.style.overflow = "hidden";
  };
  const unlockScroll = (): void => {
    document.body.style.overflow = "";
  };

  function openDrawer(): void {
    if (settingsEditingLocked) return;
    if (drawer!.classList.contains("is-open")) return;
    clearNotes();
    populateFromStorage();
    ensureChartsLoaded();
    // Snapshot after populating so Cancel/Esc reverts to the freshly-loaded values.
    drawerSnapshot = snapshotFields(drawerBody);
    // Snapshot measurement storage now (before any lazy init writes) so Cancel discards
    // measurement edits made in this session, while Apply keeps them.
    measureStorageBaseline = snapshotMeasureStorage();
    syncPanelTop();
    drawer!.classList.add("is-open");
    drawer!.setAttribute("aria-hidden", "false");
    lockScroll();
    window.requestAnimationFrame(() => {
      // Re-measure after layout/fonts settle so the panel stays flush with the header.
      syncPanelTop();
      // The measurement SVG editor is part of the workspace — initialise it lazily the
      // first time the workspace opens (after layout so its overlay anchors measure correctly).
      if (!measureInitialized && measurePane) {
        measureInitialized = true;
        initCustomBuildMeasurementsPage();
      }
      captureMeasureFieldBaseline();
      (drawerPanel ?? drawer!).focus();
    });
  }

  function closeDrawer(opts: { discardEdits?: boolean } = {}): void {
    if (!drawer!.classList.contains("is-open")) return;
    if (opts.discardEdits !== false) {
      restoreFields(drawerSnapshot);
      // Discard any measurement edits made while the workspace was open.
      restoreMeasureFieldBaseline();
      restoreMeasureStorage(measureStorageBaseline);
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
    // Inputs hold swatch counts (sts/rows over 4" or 10 cm); the engine consumes per-inch.
    const gaugeBasis = resolveGaugeBasis();
    const stitchSwatch = spiInput?.value.trim() ?? "";
    const rowSwatch = rpiInput?.value.trim() ?? "";
    const needles = needlesInput?.value.trim() ?? "";

    const errors: string[] = [];
    if (!size || !isValidExpressSizeForAudience(audience, size)) {
      errors.push("Choose a size.");
    }
    if (!isPositiveNumericMeasurement(stitchSwatch)) errors.push("Enter a stitch gauge greater than 0.");
    if (!isPositiveNumericMeasurement(rowSwatch)) errors.push("Enter a row gauge greater than 0.");
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

      // Title + notes (online project header) — reuses patternProject meta. Notes come from the
      // editable Notes textarea; fall back to any previously saved notes if the field is absent.
      if (titleInput) {
        const prevProject = getCurrentPattern().patternProject;
        const prevNotes =
          prevProject && typeof prevProject.notes === "string" ? prevProject.notes : "";
        const notes = notesInput ? notesInput.value : prevNotes;
        saveCurrentPattern({
          patternProject: { title: titleInput.value.trim(), notes, titleCustomized: true },
        });
      }

      // 2) Map wizard selections into canonical + patternBuilderData (re-derives measurements).
      syncCustomBuildToPatternStorage({ awaitCharts: false });

      // 3) Gauge → same canonical + patternBuilderData sections the gauge step / Express write.
      // Convert the swatch counts the user sees (28 / 44 over 4") into the per-inch values the
      // engine expects (7 / 11), and persist the raw counts + basis so summaries stay in sync.
      const { gaugeStitchesPerInch, gaugeRowsPerInch } = rawSwatchToPerInch(
        stitchSwatch,
        rowSwatch,
        gaugeBasis,
      );
      const prevYgm = section(getPatternData().yarnGaugeMachine);
      saveCurrentPattern({
        yarnGauge: {
          stitchGauge: gaugeStitchesPerInch,
          rowGauge: gaugeRowsPerInch,
          gaugeUnits: "per_inch",
          gaugeStitchRaw: stitchSwatch,
          gaugeRowRaw: rowSwatch,
          gaugeRawUnit: gaugeBasis,
        },
        machine: { availableNeedles: needles },
      });
      savePatternData("yarnGauge", {
        stitchGauge: gaugeStitchesPerInch,
        rowGauge: gaugeRowsPerInch,
        gaugeUnits: "per_inch",
        gaugeStitchRaw: stitchSwatch,
        gaugeRowRaw: rowSwatch,
        gaugeRawUnit: gaugeBasis,
      });
      savePatternData("yarnGaugeMachine", {
        ...prevYgm,
        gaugeStitchesPerInch,
        gaugeRowsPerInch,
        gaugeStitchRaw: stitchSwatch,
        gaugeRowRaw: rowSwatch,
        gaugeRawUnit: gaugeBasis,
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

  // Keep the panel flush with the header when the chrome height changes (resize, font load).
  syncPanelTop();
  window.addEventListener("resize", syncPanelTop);
  if (document.fonts && document.fonts.ready) {
    void document.fonts.ready.then(syncPanelTop).catch(() => {});
  }

  // Lock the in-place editor (gauge, measurements, style choices, regeneration) when the user
  // lacks active system access. The button is hidden rather than shown-disabled so the locked
  // state reads as intentional; renaming/notes remain available on the Customize page.
  void resolveSleevelessUserAccess().then((access) => {
    settingsEditingLocked = !canEditSleevelessPatternSettings(access);
    if (!settingsEditingLocked) return;
    if (drawer.classList.contains("is-open")) closeDrawer();
    openBtn.hidden = true;
    openBtn.setAttribute("aria-hidden", "true");
    openBtn.setAttribute("tabindex", "-1");
    // Reveal the workspace read-only notice that explains why editing is unavailable.
    const lockedBanner = document.querySelector<HTMLElement>(
      "[data-sleeveless-workspace-locked-banner]",
    );
    if (lockedBanner) lockedBanner.hidden = false;
  });

  drawer.querySelectorAll<HTMLInputElement>('input[name="sl-edit-fit"]').forEach((el) => {
    el.addEventListener("change", () => {
      updateEaseReadout();
      recalcFitDerivedMeasurements();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (drawer.classList.contains("is-open")) {
      closeDrawer();
    }
  });

  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      void applyChanges();
    });
  }

  // Auto-open the workspace when arrived via My Patterns → Edit (`?edit=1`). View opens the same
  // page without the flag and stays read-only. The query is stripped so a refresh/back doesn't
  // re-open the drawer, and `openDrawer()` already no-ops when settings editing is locked.
  function maybeAutoOpenFromQuery(): void {
    if (typeof window === "undefined") return;
    let shouldOpen = false;
    try {
      shouldOpen = new URLSearchParams(window.location.search).get("edit") === "1";
    } catch {
      shouldOpen = false;
    }
    if (!shouldOpen) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("edit");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {
      /* history unavailable — harmless */
    }
    openDrawer();
  }

  maybeAutoOpenFromQuery();
}

if (typeof document !== "undefined") {
  const boot = (): void => initSleevelessPatternEditDrawer();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
