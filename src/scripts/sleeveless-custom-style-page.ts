/**
 * Custom Build — Style & Shaping (`/patterns/sleeveless/custom-style`).
 * Accordions for neckline, fit, body shape, and garment type.
 * Neckline + fit share `kbm_sleeveless_express_builder` → `values` with Quick Build / Foundation (keys `neckline`, `fit`).
 * Body shape + garment type use dedicated localStorage keys for the style step.
 */

import { SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "../lib/patterns/patternStorage";
import { syncCustomBuildToPatternStorage } from "../lib/patterns/syncCustomBuildToPatternStorage";

const STORAGE = {
  neckline: "necklineStyle",
  bodyShape: "bodyShape",
  garmentType: "garmentType",
} as const;

const DEFAULTS = {
  neckline: "round",
  bodyShape: "straight",
  garmentType: "pullover",
  fit: "standard",
} as const;

const NECKLINE_VALUES = new Set(["round", "v-neck"]);
const FIT_VALUES = new Set(["close", "standard", "relaxed"]);
const BODY_VALUES = new Set(["straight", "aline", "shaped"]);
const GARMENT_VALUES = new Set(["pullover", "cardigan"]);

const SUMMARY: Record<string, Record<string, string>> = {
  neckline: {
    round: "Round neck",
    "v-neck": "V-neck",
  },
  fit: {
    close: "Close fit",
    standard: "Standard fit",
    relaxed: "Relaxed fit",
  },
  bodyShape: {
    straight: "Straight",
    aline: "A-line",
    shaped: "Shaped waist",
  },
  garmentType: {
    pullover: "Pullover",
    cardigan: "Cardigan",
  },
};

function readExpressPersisted(): Record<string, unknown> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    return p as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readExpressValues(): Record<string, string> {
  const p = readExpressPersisted();
  const v = p?.values;
  if (v && typeof v === "object" && !Array.isArray(v)) return { ...(v as Record<string, string>) };
  return {};
}

function patchExpressBuilderValues(partial: Record<string, string>): void {
  if (typeof localStorage === "undefined") return;
  try {
    const prev = readExpressPersisted() ?? {};
    const oldVals =
      prev.values && typeof prev.values === "object" && !Array.isArray(prev.values)
        ? { ...(prev.values as Record<string, string>) }
        : {};
    const values = { ...oldVals, ...partial };
    localStorage.setItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY, JSON.stringify({ ...prev, values }));
  } catch {
    /* quota */
  }
}

function syncBasicsFromExpressValues(_ev: Record<string, string>): void {
  syncCustomBuildToPatternStorage();
}

function readStored(key: string, allowed: Set<string>, fallback: string): string {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = raw.trim();
    if (allowed.has(v)) return v;
  } catch {
    /* ignore */
  }
  return fallback;
}

function writeStored(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota */
  }
}

function initAccordions(root: HTMLElement): void {
  root.querySelectorAll("[data-cb-style-acc]").forEach((section) => {
    if (!(section instanceof HTMLElement)) return;
    const header = section.querySelector("[data-cb-style-header]");
    const body = section.querySelector("[data-cb-style-body]");
    const chevron = section.querySelector("[data-cb-style-chevron]");
    if (!(header instanceof HTMLElement) || !(body instanceof HTMLElement)) return;

    const setOpen = (open: boolean) => {
      section.classList.toggle("express-acc--open", open);
      header.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) body.removeAttribute("hidden");
      else body.setAttribute("hidden", "");
      if (chevron instanceof HTMLElement)
        chevron.setAttribute("aria-label", open ? "Collapse section" : "Expand section");
    };

    const toggle = () => setOpen(!section.classList.contains("express-acc--open"));

    header.addEventListener("click", () => toggle());
    header.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });
}

function applyRadiogroup(root: HTMLElement, group: string, value: string): void {
  const section = root.querySelector(`[data-cb-style-group="${group}"]`);
  if (!section) return;

  section.querySelectorAll<HTMLButtonElement>("[data-cb-style-value]").forEach((btn) => {
    const v = btn.getAttribute("data-cb-style-value") ?? "";
    const selected = v === value;
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
    btn.classList.toggle("is-selected", selected);
  });

  const summaryEl = root.querySelector(`[data-style-summary="${group}"]`);
  if (summaryEl) {
    const map = SUMMARY[group];
    summaryEl.textContent = map?.[value] ?? "";
  }
}

function wireRadiogroup(root: HTMLElement, group: string, allowed: Set<string>, onPick: (v: string) => void): void {
  const section = root.querySelector(`[data-cb-style-group="${group}"]`);
  if (!section) return;

  section.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-cb-style-value]");
    if (!t || t.disabled) return;
    const v = t.getAttribute("data-cb-style-value") ?? "";
    if (!allowed.has(v)) return;
    onPick(v);
    applyRadiogroup(root, group, v);
  });
}

function resolveInitialNeckline(): string {
  const ev = readExpressValues();
  if (ev.neckline && NECKLINE_VALUES.has(ev.neckline)) return ev.neckline;
  return readStored(STORAGE.neckline, NECKLINE_VALUES, DEFAULTS.neckline);
}

function resolveInitialFit(): string {
  const ev = readExpressValues();
  if (ev.fit && FIT_VALUES.has(ev.fit)) return ev.fit;
  return DEFAULTS.fit;
}

function initCustomStylePage(): void {
  const root = document.querySelector("[data-cb-custom-style-root]");
  if (!(root instanceof HTMLElement)) return;

  let neckline = resolveInitialNeckline();
  let fit = resolveInitialFit();
  let bodyShape = readStored(STORAGE.bodyShape, BODY_VALUES, DEFAULTS.bodyShape);
  let garmentType = readStored(STORAGE.garmentType, GARMENT_VALUES, DEFAULTS.garmentType);

  const ev0 = readExpressValues();
  if (!ev0.neckline || !NECKLINE_VALUES.has(ev0.neckline)) {
    patchExpressBuilderValues({ neckline });
  }
  if (!ev0.fit || !FIT_VALUES.has(ev0.fit)) {
    patchExpressBuilderValues({ fit });
    fit = resolveInitialFit();
  }

  if (bodyShape === "aline" || bodyShape === "shaped") {
    bodyShape = DEFAULTS.bodyShape;
    writeStored(STORAGE.bodyShape, bodyShape);
  }
  if (garmentType === "cardigan") {
    garmentType = DEFAULTS.garmentType;
    writeStored(STORAGE.garmentType, garmentType);
  }

  initAccordions(root);

  const syncNeckline = (v: string) => {
    neckline = v;
    writeStored(STORAGE.neckline, v);
    patchExpressBuilderValues({ neckline: v });
    syncBasicsFromExpressValues(readExpressValues());
  };
  const syncFit = (v: string) => {
    fit = v;
    patchExpressBuilderValues({ fit: v });
    syncBasicsFromExpressValues(readExpressValues());
  };
  const syncBody = (v: string) => {
    bodyShape = v;
    writeStored(STORAGE.bodyShape, v);
  };
  const syncGarment = (v: string) => {
    garmentType = v;
    writeStored(STORAGE.garmentType, v);
  };

  applyRadiogroup(root, "neckline", neckline);
  applyRadiogroup(root, "fit", fit);
  applyRadiogroup(root, "bodyShape", bodyShape);
  applyRadiogroup(root, "garmentType", garmentType);

  wireRadiogroup(root, "neckline", NECKLINE_VALUES, syncNeckline);
  wireRadiogroup(root, "fit", FIT_VALUES, syncFit);
  wireRadiogroup(root, "bodyShape", new Set(["straight"]), syncBody);
  wireRadiogroup(root, "garmentType", new Set(["pullover"]), syncGarment);

  syncBasicsFromExpressValues(readExpressValues());
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCustomStylePage, { once: true });
  } else {
    initCustomStylePage();
  }
}
