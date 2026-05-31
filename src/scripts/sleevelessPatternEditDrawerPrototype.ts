/**
 * PROTOTYPE ONLY — Edit Pattern drawer + Measurement editor (UX experiment).
 *
 * Two surfaces for the saved sleeveless pattern view:
 *  1. Edit Pattern drawer (right-side desktop / full-screen mobile) for quick settings
 *     (title, neckline, gauge, needles).
 *  2. Full-screen Measurement editor workspace, reached from the drawer. This now hosts the
 *     REAL Custom Build measurement editor (`initCustomBuildMeasurementsPage`) — same
 *     pattern_summary.svg, labels, field names, and overlay positions used during pattern
 *     creation — rather than a placeholder diagram.
 *
 * This is a UX feel test only:
 *  - NOT wired to pattern generation, save/update, the database, or Netlify Blob.
 *  - The reused editor auto-persists field edits to localStorage on blur (and its init runs
 *    `prepareCustomBuildPatternGeneration`). To keep the prototype side-effect free, the
 *    workspace snapshots the relevant storage keys + visible field values before initialising
 *    and restores them whenever the workspace closes (Cancel / Back / Esc) — so temporary
 *    edits are discarded and nothing is persisted or regenerated.
 *  - "Update Pattern" and "Apply Measurements" intentionally do not save or regenerate yet.
 */
import { initCustomBuildMeasurementsPage } from "./sleeveless-custom-build-measurements-page";
import {
  PATTERN_BUILDER_DATA_KEY,
  PATTERN_STORAGE_KEY,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "../lib/patterns/patternStorage";
import { LEGACY_STANDALONE_MEASUREMENTS_KEY } from "../lib/patterns/sleevelessCustomMeasurementStorage";

/** localStorage keys the reused measurement editor may write to (snapshot/restore for discard). */
const MEASURE_STORAGE_KEYS = [
  PATTERN_STORAGE_KEY,
  PATTERN_BUILDER_DATA_KEY,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
  LEGACY_STANDALONE_MEASUREMENTS_KEY,
] as const;

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

function initSleevelessPatternEditDrawerPrototype(): void {
  const drawer = document.querySelector<HTMLElement>("[data-sl-edit-drawer]");
  const openBtn = document.querySelector<HTMLElement>("[data-sl-edit-open]");
  if (!drawer || !openBtn) return;

  const drawerPanel = drawer.querySelector<HTMLElement>(".sl-edit-drawer__panel");
  const drawerBody = drawer.querySelector<HTMLElement>(".sl-edit-drawer__body");
  const drawerNote = drawer.querySelector<HTMLElement>("[data-sl-edit-note]");
  const updateBtn = drawer.querySelector<HTMLElement>("[data-sl-edit-update]");
  const drawerCloseEls = Array.from(drawer.querySelectorAll<HTMLElement>("[data-sl-edit-close]"));

  const measure = document.querySelector<HTMLElement>("[data-sl-measure-workspace]");
  const measureInner = measure?.querySelector<HTMLElement>(".sl-measure-workspace__inner") ?? null;
  const measureBody = measure?.querySelector<HTMLElement>(".sl-measure-workspace__body") ?? null;
  const measureNote = measure?.querySelector<HTMLElement>("[data-sl-measure-note]") ?? null;
  const measureOpenBtn = drawer.querySelector<HTMLElement>("[data-sl-measure-open]");
  const measureApplyBtn = measure?.querySelector<HTMLElement>("[data-sl-measure-apply]") ?? null;
  const measureCloseEls = measure
    ? Array.from(
        measure.querySelectorAll<HTMLElement>(
          "[data-sl-measure-back], [data-sl-measure-cancel]",
        ),
      )
    : [];

  let drawerSnapshot: FieldSnapshot | null = null;

  // Reused measurement editor is initialised once, lazily, the first time the workspace opens.
  let measureInitialized = false;
  // Pristine storage captured before init so init-time prep + blur autosaves can be reverted.
  let measureStorageBaseline: StorageSnapshot | null = null;
  // Visible field values captured after first render so the diagram resets on discard.
  let measureFieldBaseline: Map<string, string> | null = null;

  function captureMeasureFieldBaseline(attempts = 0): void {
    if (!measureBody) return;
    const inputs = measureBody.querySelectorAll<HTMLInputElement>("[data-cb-measure-input]");
    if (inputs.length === 0) {
      // Editor renders asynchronously (chart fetch); poll briefly until fields exist.
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

  const lockScroll = (): void => {
    document.body.style.overflow = "hidden";
  };
  const unlockScroll = (): void => {
    document.body.style.overflow = "";
  };

  function openDrawer(): void {
    if (drawer.classList.contains("is-open")) return;
    // Snapshot current values so closing can discard temporary edits.
    drawerSnapshot = snapshotFields(drawerBody);
    if (drawerNote) drawerNote.hidden = true;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    lockScroll();
    window.requestAnimationFrame(() => {
      (drawerPanel ?? drawer).focus();
    });
  }

  // Hide the drawer without discarding its values (used when stepping into measurements).
  function hideDrawerForHandoff(): void {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    if (drawerNote) drawerNote.hidden = true;
  }

  function closeDrawer(): void {
    if (!drawer.classList.contains("is-open")) return;
    restoreFields(drawerSnapshot);
    drawerSnapshot = null;
    if (drawerNote) drawerNote.hidden = true;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    unlockScroll();
    if (typeof openBtn.focus === "function") openBtn.focus();
  }

  function openMeasure(): void {
    if (!measure || measure.classList.contains("is-open")) return;
    // Step away from the drawer (keep its in-progress values intact).
    hideDrawerForHandoff();
    if (measureNote) measureNote.hidden = true;
    measure.classList.add("is-open");
    measure.setAttribute("aria-hidden", "false");
    lockScroll();

    if (!measureInitialized) {
      measureInitialized = true;
      // Snapshot BEFORE init so the editor's init-time storage prep is reverted on close too.
      measureStorageBaseline = snapshotMeasureStorage();
      // Init after the workspace is visible so SVG measurements / overlay anchoring are correct.
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
    // Prototype: discard temporary edits. Reset the visible diagram fields and revert any
    // values the reused editor auto-persisted to localStorage, then return to the pattern view.
    restoreMeasureFieldBaseline();
    restoreMeasureStorage(measureStorageBaseline);
    if (measureNote) measureNote.hidden = true;
    measure.classList.remove("is-open");
    measure.setAttribute("aria-hidden", "true");
    unlockScroll();
    if (measureOpenBtn && typeof measureOpenBtn.focus === "function") {
      measureOpenBtn.focus();
    } else if (typeof openBtn.focus === "function") {
      openBtn.focus();
    }
  }

  openBtn.addEventListener("click", openDrawer);
  drawerCloseEls.forEach((el) => el.addEventListener("click", closeDrawer));

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

  if (updateBtn) {
    updateBtn.addEventListener("click", () => {
      // Prototype: no save, no regeneration, no persistence.
      console.log("[Edit Pattern prototype] Update Pattern clicked — no save/regeneration wired up.");
      if (drawerNote) drawerNote.hidden = false;
    });
  }

  if (measureApplyBtn) {
    measureApplyBtn.addEventListener("click", () => {
      // Prototype: no save, no regeneration, no persistence.
      console.log(
        "[Measurement editor prototype] Apply Measurements clicked — no save/regeneration wired up.",
      );
      if (measureNote) measureNote.hidden = false;
    });
  }
}

if (typeof document !== "undefined") {
  const boot = (): void => initSleevelessPatternEditDrawerPrototype();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
