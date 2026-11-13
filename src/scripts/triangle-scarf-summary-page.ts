/**
 * Triangle Scarf Summary/Edit.
 * Members Save or Update a My Patterns project and stay for confirmation.
 * Guests write the local draft and open the finished pattern.
 * Cancel never writes.
 */
import type { ViewerAccessState } from "../lib/memberAccess";
import { bindPatternProjectNotesField } from "../lib/patterns/patternProjectNotesField";
import { hashRequestsNotesEditing } from "../lib/patterns/sleevelessPatternNotesCollapse";
import { promptEditPatternSaveConfirmation } from "../lib/patterns/sleevelessPatternEditSaveConfirmation";
import {
  applySavedPatternUnavailableMessage,
  ensureUrlRequestedSavedPatternHydrated,
} from "../lib/patterns/ensureUrlRequestedSavedPattern";
import {
  bindHatPatternWorkspaceAccessLifecycle,
  hatPatternHasMemberSavedProjectPrivileges,
  readHatPatternAccessSnapshot,
} from "../lib/patterns/hat/hatPatternWorkspaceAccess";
import { triangleScarfFieldsFromDraft, triangleScarfFormError, triangleScarfInputsFromFields } from "../lib/patterns/triangleScarf/triangleScarfForm";
import {
  resolveTriangleScarfSummaryEntryPath,
  triangleScarfSummaryCancelHref,
  triangleScarfSummaryCancelLabel,
  triangleScarfSummaryPrimarySuccessHref,
} from "../lib/patterns/triangleScarf/triangleScarfNavigation";
import {
  persistTriangleScarfPatternProject,
  resolveTriangleScarfPatternPersistActionFromViewer,
  resolveTriangleScarfSummaryAfterPersistNext,
  triangleScarfSummaryShouldShowProjectDetails,
} from "../lib/patterns/triangleScarf/triangleScarfPatternProjectSave";
import { readTriangleScarfDraft, writeTriangleScarfDraft } from "../lib/patterns/triangleScarf/triangleScarfDraft";
import {
  applyTriangleScarfPatternProjectDetailsToDraft,
  buildDefaultTriangleScarfPatternTitle,
  isEditingSavedTriangleScarfProject,
  readTriangleScarfActiveProjectId,
  resolveTriangleScarfPatternProjectNotes,
  resolveTriangleScarfSavedPatternName,
} from "../lib/patterns/triangleScarf/triangleScarfSavedProject";
import {
  applyTriangleScarfFields,
  bindTriangleScarfFieldChrome,
  readTriangleScarfFormFields,
  showTriangleScarfFormError,
} from "./triangle-scarf-form.ts";

function showWorkspace(): void {
  const empty = document.querySelector("[data-triangle-scarf-summary-empty]");
  const workspace = document.querySelector("[data-triangle-scarf-summary-workspace]");
  if (empty instanceof HTMLElement) empty.hidden = true;
  if (workspace instanceof HTMLElement) workspace.hidden = false;
}

function showEmpty(): void {
  const empty = document.querySelector("[data-triangle-scarf-summary-empty]");
  const workspace = document.querySelector("[data-triangle-scarf-summary-workspace]");
  if (empty instanceof HTMLElement) empty.hidden = false;
  if (workspace instanceof HTMLElement) workspace.hidden = true;
}

function start(): void {
  if (!document.querySelector("[data-triangle-scarf-summary-page]")) return;
  void (async () => {
    const hydrateOutcome = await ensureUrlRequestedSavedPatternHydrated();
    if (hydrateOutcome === "load-failed") {
      applySavedPatternUnavailableMessage();
      showEmpty();
      return;
    }
    bindSummary();
  })();
}

function bindSummary(): void {
  const root = document.querySelector<HTMLElement>("[data-triangle-scarf-summary-page]");
  const workspace = document.querySelector<HTMLElement>("[data-triangle-scarf-summary-workspace]");
  if (!root || !workspace || root.dataset.triangleScarfSummaryBound === "true") return;
  root.dataset.triangleScarfSummaryBound = "true";

  const entryPath = resolveTriangleScarfSummaryEntryPath();
  const draft = readTriangleScarfDraft();
  if (!draft || !draft.length.trim()) {
    showEmpty();
    return;
  }
  showWorkspace();

  const titleField = workspace.querySelector<HTMLElement>("[data-triangle-scarf-edit-title-field]");
  const titleInput = workspace.querySelector<HTMLInputElement>("[data-triangle-scarf-edit-title]");
  const notesFieldApi = bindPatternProjectNotesField(workspace);
  const updateBtn = workspace.querySelector<HTMLButtonElement>("[data-triangle-scarf-summary-primary]");
  const cancel = workspace.querySelector<HTMLAnchorElement>("[data-triangle-scarf-summary-cancel]");
  let viewerAccessState: ViewerAccessState =
    readHatPatternAccessSnapshot()?.viewerAccessState ?? "loggedOut";

  function savedProjectId(): string {
    return readTriangleScarfActiveProjectId();
  }

  function applyPersistChrome(): void {
    const action = resolveTriangleScarfPatternPersistActionFromViewer({
      viewerAccessState,
      activeProjectId: savedProjectId(),
      entryPath,
    });
    const hint = workspace.querySelector("[data-triangle-scarf-summary-hint]");
    if (hint) hint.textContent = action.hint;
    if (updateBtn) updateBtn.textContent = action.label;
    if (cancel) {
      cancel.textContent = triangleScarfSummaryCancelLabel(entryPath);
      cancel.href = triangleScarfSummaryCancelHref(entryPath, savedProjectId());
    }
    const showProjectDetails = triangleScarfSummaryShouldShowProjectDetails(
      hatPatternHasMemberSavedProjectPrivileges(viewerAccessState),
    );
    if (titleField) titleField.hidden = !showProjectDetails;
    if (titleInput && showProjectDetails && !titleInput.value.trim()) {
      titleInput.value =
        resolveTriangleScarfSavedPatternName(readTriangleScarfDraft()) ||
        buildDefaultTriangleScarfPatternTitle();
    }
  }

  const apply = () => {
    const current = readTriangleScarfDraft();
    if (!current) return;
    applyTriangleScarfFields(triangleScarfFieldsFromDraft(current));
    if (titleInput) {
      const showProjectDetails = triangleScarfSummaryShouldShowProjectDetails(
        hatPatternHasMemberSavedProjectPrivileges(viewerAccessState),
      );
      titleInput.value = showProjectDetails
        ? resolveTriangleScarfSavedPatternName(current) || buildDefaultTriangleScarfPatternTitle()
        : "";
    }
    notesFieldApi.setNotes(resolveTriangleScarfPatternProjectNotes(current), {
      deepLinkToNotes: hashRequestsNotesEditing(window.location.hash),
    });
    applyPersistChrome();
  };
  const run = () => window.setTimeout(apply, 0);
  if (document.readyState === "complete") run();
  else document.addEventListener("DOMContentLoaded", run);
  bindTriangleScarfFieldChrome(() => showTriangleScarfFormError(""));

  bindHatPatternWorkspaceAccessLifecycle({
    apply: (state) => {
      viewerAccessState = state;
      applyPersistChrome();
    },
  });

  updateBtn?.addEventListener("click", () => {
    void updatePattern();
  });

  async function updatePattern(): Promise<void> {
    const fields = readTriangleScarfFormFields();
    const message = triangleScarfFormError(fields);
    if (message) {
      showTriangleScarfFormError(message);
      return;
    }
    showTriangleScarfFormError("");
    const previous = readTriangleScarfDraft();
    if (!previous) {
      showTriangleScarfFormError("Create a triangle scarf pattern first.");
      return;
    }
    const action = resolveTriangleScarfPatternPersistActionFromViewer({
      viewerAccessState,
      activeProjectId: savedProjectId(),
      entryPath,
    });
    const requestedName =
      titleInput?.value?.trim() ||
      resolveTriangleScarfSavedPatternName(previous) ||
      buildDefaultTriangleScarfPatternTitle();
    const requestedNotes =
      titleField && !titleField.hidden
        ? notesFieldApi.getNotes()
        : resolveTriangleScarfPatternProjectNotes(previous);
    let next = {
      ...previous,
      length: fields.length.trim(),
      depth: fields.depth.trim(),
      stitchGauge: fields.stitchGauge.trim(),
      rowGauge: fields.rowGauge.trim(),
      needles: fields.needles.trim(),
      unit: fields.unit,
      patternType: "triangle-scarf" as const,
      patternSystem: "triangle-scarf" as const,
    };
    if (action.persist !== "local-only") {
      next = applyTriangleScarfPatternProjectDetailsToDraft(next, {
        title: requestedName,
        notes: requestedNotes,
      });
    } else if (titleField && !titleField.hidden) {
      next = applyTriangleScarfPatternProjectDetailsToDraft(next, { notes: requestedNotes });
    } else if (previous.patternProject) {
      next = { ...next, patternProject: previous.patternProject };
    }
    writeTriangleScarfDraft(next);

    if (updateBtn) updateBtn.disabled = true;
    try {
      if (action.persist === "create" || action.persist === "update") {
        const persistRes = await persistTriangleScarfPatternProject({
          draft: next,
          name: requestedName,
          mode: action.persist,
        });
        if (!persistRes.ok) {
          showTriangleScarfFormError(persistRes.error);
          return;
        }
        applyPersistChrome();
        if (resolveTriangleScarfSummaryAfterPersistNext(action.persist) === "confirm") {
          const confirmationChoice = await promptEditPatternSaveConfirmation(root);
          if (confirmationChoice === "view") {
            window.location.assign(
              triangleScarfSummaryPrimarySuccessHref(
                triangleScarfInputsFromFields(fields),
                readTriangleScarfActiveProjectId(),
              ),
            );
          }
          return;
        }
      }
      window.location.assign(
        triangleScarfSummaryPrimarySuccessHref(
          triangleScarfInputsFromFields(fields),
          isEditingSavedTriangleScarfProject() ? savedProjectId() : "",
        ),
      );
    } finally {
      if (updateBtn) updateBtn.disabled = false;
    }
  }
}

start();
