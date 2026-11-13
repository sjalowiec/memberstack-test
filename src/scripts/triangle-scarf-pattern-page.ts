/**
 * Finished Triangle Scarf page.
 * Share URLs and the local draft both render through buildTriangleScarfPatternHtml,
 * which is also what prints.
 */
import { mountPatternPrintAction, syncPatternInpageNav } from "../lib/patterns/patternInpageNav";
import type { ViewerAccessState } from "../lib/memberAccess";
import {
  applySavedPatternUnavailableMessage,
  ensureUrlRequestedSavedPatternHydrated,
} from "../lib/patterns/ensureUrlRequestedSavedPattern";
import { SAVED_PATTERN_UNAVAILABLE_BODY } from "../lib/patterns/savedPatternAccessState";
import { readSavedPatternProjectIdFromUrl } from "../lib/patterns/savedPatternViewUrl";
import {
  applyPatternProjectOnlineNotes,
  TRIANGLE_SCARF_PATTERN_ONLINE_NOTES_SELECTORS,
} from "../lib/patterns/patternProjectOnlineNotes";
import { getSleevelessPatternOnlineNotesText } from "../lib/patterns/sleevelessPatternProjectMeta";
import {
  bindHatPatternWorkspaceAccessLifecycle,
  readHatPatternAccessSnapshot,
} from "../lib/patterns/hat/hatPatternWorkspaceAccess";
import {
  HAT_PATTERN_LEAVE_WARNING_EMPHASIS,
  HAT_PATTERN_LEAVE_WARNING_LEAD,
} from "../lib/patterns/hat/hatPatternLeaveWarning";
import {
  buildTriangleScarfAtAGlanceHtml,
  buildTriangleScarfPatternHtml,
  calculateTriangleScarf,
  parseTriangleScarfSearchParams,
  type TriangleScarfInputs,
  type TriangleScarfOk,
} from "../lib/patterns/triangleScarfMath";
import { readTriangleScarfDraft, writeTriangleScarfDraft } from "../lib/patterns/triangleScarf/triangleScarfDraft";
import { triangleScarfDraftFromFields, triangleScarfInputsFromFields } from "../lib/patterns/triangleScarf/triangleScarfForm";
import {
  TRIANGLE_SCARF_BUILDER_HREF,
  buildTriangleScarfBuilderNewPatternHref,
  buildTriangleScarfPatternHref,
  buildTriangleScarfShareHref,
  buildTriangleScarfSummaryEditFromPatternHref,
} from "../lib/patterns/triangleScarf/triangleScarfNavigation";
import { applyTriangleScarfPatternPersistNotice, shouldShowTriangleScarfTemporaryPatternNotice } from "../lib/patterns/triangleScarf/triangleScarfPatternPersistNotice";
import {
  applyTriangleScarfPatternMyPatternsAccess,
  bindTriangleScarfPatternMyPatternsDisabledGuard,
} from "../lib/patterns/triangleScarf/triangleScarfPatternMyPatternsAccess";
import {
  resolveTriangleScarfPatternOnlineHeading,
  resolveTriangleScarfPatternPrintFields,
} from "../lib/patterns/triangleScarf/triangleScarfPatternPrintTitle";
import {
  isEditingSavedTriangleScarfProject,
  readTriangleScarfActiveProjectId,
  resolveTriangleScarfPatternProjectNotes,
  startFreshTriangleScarfPattern,
} from "../lib/patterns/triangleScarf/triangleScarfSavedProject";
import {
  TRIANGLE_SCARF_PATTERN_INPAGE_NAV_ITEMS,
  buildTriangleScarfYarnDimensionsDetail,
  triangleScarfYarnHeadingForResult,
} from "../lib/patterns/triangleScarf/triangleScarfPatternView";
import {
  initGarmentPatternYarnDrawer,
  setGarmentPatternYarnActionVisible,
} from "./garment-pattern-yarn-drawer.ts";
import { triggerPatternPrint, applyPatternPrintPersonalizationToDom } from "./patternPrintPersonalization.ts";

function setVisible(selector: string, visible: boolean): void {
  const el = document.querySelector(selector);
  if (el instanceof HTMLElement) el.hidden = !visible;
}

function inputsFromDraft(): TriangleScarfInputs | null {
  const draft = readTriangleScarfDraft();
  if (!draft) return null;
  const inputs = triangleScarfInputsFromFields({
    length: draft.length,
    depth: draft.depth,
    stitchGauge: draft.stitchGauge,
    rowGauge: draft.rowGauge,
    needles: draft.needles,
    unit: draft.unit,
  });
  if (
    !Number.isFinite(inputs.length) ||
    !Number.isFinite(inputs.depth) ||
    !Number.isFinite(inputs.stitchGauge) ||
    !Number.isFinite(inputs.rowGauge) ||
    !Number.isFinite(inputs.needles)
  ) {
    return null;
  }
  return inputs;
}

let viewerAccessState: ViewerAccessState =
  readHatPatternAccessSnapshot()?.viewerAccessState ?? "loggedOut";

function savedProjectId(): string {
  return readSavedPatternProjectIdFromUrl() || readTriangleScarfActiveProjectId();
}

function applyMembershipChrome(): void {
  applyTriangleScarfPatternPersistNotice(document, viewerAccessState, {
    isEditingSavedProject: isEditingSavedTriangleScarfProject(),
  });
  applyTriangleScarfPatternMyPatternsAccess(document, viewerAccessState);
}

function rememberInputs(inputs: TriangleScarfInputs): void {
  const previous = readTriangleScarfDraft();
  writeTriangleScarfDraft(
    triangleScarfDraftFromFields(
      {
        length: String(inputs.length),
        depth: String(inputs.depth),
        stitchGauge: String(inputs.stitchGauge),
        rowGauge: String(inputs.rowGauge),
        needles: String(inputs.needles),
        unit: inputs.unit,
      },
      previous,
    ),
  );
}

function showEmpty(message: string): void {
  const msg = document.querySelector("[data-triangle-scarf-pattern-empty-message]");
  if (msg) msg.textContent = message;
  setVisible("[data-triangle-scarf-pattern-empty]", true);
  setVisible("[data-triangle-scarf-pattern-results]", false);
  setGarmentPatternYarnActionVisible(false);
  const share = document.querySelector("[data-triangle-scarf-share]");
  if (share instanceof HTMLElement) share.hidden = true;
}

function showResults(): void {
  setVisible("[data-triangle-scarf-pattern-empty]", false);
  setVisible("[data-triangle-scarf-pattern-results]", true);
  setGarmentPatternYarnActionVisible(true);
  const share = document.querySelector("[data-triangle-scarf-share]");
  if (share instanceof HTMLElement) share.hidden = false;
  const edit = document.querySelector("[data-triangle-scarf-edit]");
  if (edit instanceof HTMLElement) edit.hidden = false;
}

function publishYarn(result: TriangleScarfOk): void {
  const detail = buildTriangleScarfYarnDimensionsDetail(result);
  const headingText = triangleScarfYarnHeadingForResult(result);
  window.dispatchEvent(new CustomEvent("kbm:yarnDimensions", { detail }));
  const drawerBody = document.querySelector("#express-yarn-drawer .hat-yarn-drawer-body");
  let heading = document.getElementById("yarn-heading");
  if (!heading && drawerBody) {
    heading = document.createElement("h2");
    heading.id = "yarn-heading";
    heading.className = "yarn-heading triangle-scarf-yarn-heading";
    drawerBody.prepend(heading);
  }
  if (heading) heading.textContent = headingText;
}

function bindSectionCollapse(root: HTMLElement): void {
  root.querySelectorAll(".pattern-section").forEach((section) => {
    if (!(section instanceof HTMLElement)) return;
    const id = section.dataset.sectionId;
    const checkbox = section.querySelector("input.pattern-section__collapse");
    if (!id || !(checkbox instanceof HTMLInputElement)) return;
    const collapsed = localStorage.getItem(`triangleScarf_section_${id}`) === "true";
    checkbox.checked = collapsed;
    section.classList.toggle("is-collapsed", collapsed);
  });
  if (root.dataset.triangleScarfCollapseBound === "true") return;
  root.dataset.triangleScarfCollapseBound = "true";
  root.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.classList.contains("pattern-section__collapse")) return;
    const section = target.closest(".pattern-section");
    if (!(section instanceof HTMLElement)) return;
    const id = section.dataset.sectionId;
    if (!id) return;
    localStorage.setItem(`triangleScarf_section_${id}`, target.checked ? "true" : "false");
    section.classList.toggle("is-collapsed", target.checked);
  });
}

function render(inputs: TriangleScarfInputs): void {
  rememberInputs(inputs);
  const projectId = savedProjectId();
  const canonical = buildTriangleScarfPatternHref(inputs);
  const withProject = projectId
    ? `${canonical}${canonical.includes("?") ? "&" : "?"}project=${encodeURIComponent(projectId)}`
    : canonical;
  const here = `${window.location.pathname}${window.location.search}`;
  if (here !== withProject) {
    window.history.replaceState({}, "", withProject);
  }
  const draft = readTriangleScarfDraft();
  const heading = document.querySelector("[data-triangle-scarf-pattern-heading]");
  if (heading) heading.textContent = resolveTriangleScarfPatternOnlineHeading(draft);
  applyPatternProjectOnlineNotes(
    getSleevelessPatternOnlineNotesText({
      title: draft?.patternProject?.title ?? "",
      notes: resolveTriangleScarfPatternProjectNotes(draft),
    }),
    { selectors: TRIANGLE_SCARF_PATTERN_ONLINE_NOTES_SELECTORS },
  );
  const printFields = resolveTriangleScarfPatternPrintFields({ draft });
  applyPatternPrintPersonalizationToDom(printFields.title, printFields.notes);
  applyMembershipChrome();
  const edit = document.querySelector("[data-triangle-scarf-edit]");
  if (edit instanceof HTMLAnchorElement) {
    edit.href = buildTriangleScarfSummaryEditFromPatternHref(projectId);
  }
  const result = calculateTriangleScarf(inputs);
  const mount = document.querySelector("[data-triangle-scarf-pattern-mount]");
  if (!result.ok) {
    setVisible("[data-triangle-scarf-pattern-empty]", false);
    setVisible("[data-triangle-scarf-pattern-results]", true);
    setGarmentPatternYarnActionVisible(false);
    if (mount instanceof HTMLElement) {
      mount.replaceChildren();
      const error = document.createElement("p");
      error.className = "triangle-scarf-pattern-error";
      error.setAttribute("role", "alert");
      error.textContent = result.message;
      mount.appendChild(error);
    }
    const editOnError = document.querySelector("[data-triangle-scarf-edit]");
    if (editOnError instanceof HTMLAnchorElement) editOnError.hidden = false;
    return;
  }

  showResults();
  const glance = buildTriangleScarfAtAGlanceHtml(result);
  const intro = document.querySelector("[data-sg-pattern-intro]");
  if (intro instanceof HTMLElement) intro.innerHTML = glance;
  const printBasics = document.querySelector("[data-sg-pattern-print-basics-body]");
  if (printBasics instanceof HTMLElement) printBasics.innerHTML = glance;
  if (mount instanceof HTMLElement) {
    mount.innerHTML = buildTriangleScarfPatternHtml(result);
    bindSectionCollapse(mount);
  }
  syncPatternInpageNav({ items: TRIANGLE_SCARF_PATTERN_INPAGE_NAV_ITEMS });
  publishYarn(result);
  const actions = document.querySelector("[data-triangle-scarf-pattern-actions]");
  mountPatternPrintAction({
    host: actions,
    visible: true,
    onPrint: (button) => {
      triggerPatternPrint(button, {});
    },
  });
  const share = document.querySelector("[data-triangle-scarf-share]");
  if (share instanceof HTMLButtonElement && share.dataset.bound !== "true") {
    share.dataset.bound = "true";
    share.addEventListener("click", async () => {
      const url = buildTriangleScarfShareHref(window.location.origin, inputs);
      const status = document.querySelector("[data-triangle-scarf-share-status]");
      try {
        await navigator.clipboard.writeText(url);
        if (status) status.textContent = "Link copied.";
      } catch {
        if (status) status.textContent = url;
      }
    });
  }
}

function bindNewPattern(): void {
  const fresh = document.querySelector("[data-triangle-scarf-new-pattern]");
  if (!(fresh instanceof HTMLButtonElement) || fresh.dataset.bound === "true") return;
  fresh.dataset.bound = "true";
  fresh.addEventListener("click", () => {
    if (
      shouldShowTriangleScarfTemporaryPatternNotice(
        viewerAccessState,
        isEditingSavedTriangleScarfProject(),
      )
    ) {
      const ok = window.confirm(
        `${HAT_PATTERN_LEAVE_WARNING_LEAD}\n\n${HAT_PATTERN_LEAVE_WARNING_EMPHASIS}`,
      );
      if (!ok) return;
    }
    startFreshTriangleScarfPattern();
    window.location.assign(buildTriangleScarfBuilderNewPatternHref());
  });
}

function bindInlinePrintLink(): void {
  const link = document.querySelector("[data-triangle-scarf-pattern-print-link]");
  if (!(link instanceof HTMLElement) || link.dataset.bound === "true") return;
  link.dataset.bound = "true";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const printBtn = document.querySelector("#print-btn");
    triggerPatternPrint(printBtn instanceof HTMLElement ? printBtn : link, {});
  });
}

function showPattern(inputs: TriangleScarfInputs | null): void {
  if (!inputs) {
    showEmpty("Create a triangle scarf pattern first, then come back to view your instructions.");
    const cta = document.querySelector("[data-triangle-scarf-pattern-empty-cta]");
    if (cta instanceof HTMLAnchorElement) cta.href = TRIANGLE_SCARF_BUILDER_HREF;
    applyMembershipChrome();
    return;
  }
  render(inputs);
}

function start(): void {
  if (!document.querySelector("[data-triangle-scarf-pattern-page]")) return;
  bindNewPattern();
  bindInlinePrintLink();
  bindTriangleScarfPatternMyPatternsDisabledGuard(document);
  bindHatPatternWorkspaceAccessLifecycle({
    apply: (state) => {
      viewerAccessState = state;
      applyMembershipChrome();
    },
  });
  initGarmentPatternYarnDrawer({
    onOpen: () => {
      const current = parseTriangleScarfSearchParams(new URLSearchParams(window.location.search)) ?? inputsFromDraft();
      if (!current) return;
      const result = calculateTriangleScarf(current);
      if (result.ok) publishYarn(result);
    },
  });
  void (async () => {
    const hydrateOutcome = await ensureUrlRequestedSavedPatternHydrated();
    if (hydrateOutcome === "load-failed") {
      applySavedPatternUnavailableMessage();
      showEmpty(SAVED_PATTERN_UNAVAILABLE_BODY);
      return;
    }
    const fromUrl =
      hydrateOutcome === "loaded"
        ? null
        : parseTriangleScarfSearchParams(new URLSearchParams(window.location.search));
    showPattern(fromUrl ?? inputsFromDraft());
  })();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
