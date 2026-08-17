/**
 * Shared Notes field controller for the Pattern Project Details Lego block.
 * Wires collapse / preview / deep-link using the existing notes-collapse helpers.
 */
import {
  buildNotesCollapsedPreview,
  resolveNotesDefaultExpanded,
} from "./sleevelessPatternNotesCollapse";

export type PatternProjectNotesFieldApi = {
  notesInput: HTMLTextAreaElement | null;
  getNotes: () => string;
  setNotes: (notes: string, options?: { deepLinkToNotes?: boolean }) => void;
  setExpanded: (expanded: boolean) => void;
};

export function bindPatternProjectNotesField(root: ParentNode): PatternProjectNotesFieldApi {
  const notesInput =
    root.querySelector<HTMLTextAreaElement>("[data-pattern-project-notes]") ??
    root.querySelector<HTMLTextAreaElement>("#sl-edit-notes");
  const notesField = root.querySelector<HTMLElement>("[data-sl-notes-field]");
  const notesToggle = root.querySelector<HTMLButtonElement>("[data-sl-notes-toggle]");
  const notesRegion = root.querySelector<HTMLElement>("[data-sl-notes-region]");
  const notesPreview = root.querySelector<HTMLElement>("[data-sl-notes-preview]");

  function updateNotesPreview(): void {
    if (!notesPreview) return;
    const collapsed = notesField?.dataset.collapsed !== "false";
    const preview = collapsed ? buildNotesCollapsedPreview(notesInput?.value ?? "") : "";
    notesPreview.textContent = preview;
    notesPreview.hidden = preview === "";
  }

  function setExpanded(expanded: boolean): void {
    if (notesField) notesField.dataset.collapsed = expanded ? "false" : "true";
    if (notesToggle) notesToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    if (notesRegion) notesRegion.hidden = !expanded;
    updateNotesPreview();
  }

  notesToggle?.addEventListener("click", () => {
    const willExpand = notesField?.dataset.collapsed !== "false";
    setExpanded(willExpand);
    if (willExpand && notesInput) {
      window.requestAnimationFrame(() => notesInput.focus());
    }
  });
  notesInput?.addEventListener("input", updateNotesPreview);

  return {
    notesInput,
    getNotes: () => notesInput?.value ?? "",
    setNotes: (notes, options) => {
      if (notesInput) notesInput.value = notes;
      setExpanded(resolveNotesDefaultExpanded(notes, options));
    },
    setExpanded,
  };
}
