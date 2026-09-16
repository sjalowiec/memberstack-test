import { installHelpHubAdminBrowser } from "./adminEditorClient";
import {
  applyAdminFormToDocument,
  helpHubAdminEditorCanInit,
  missingRequiredAdminFields,
  sanitizeHelpHubSlug,
  saveButtonLabelForStatus,
  shouldAutofillSlug,
  slugFromQuestion,
  type HelpHubAdminFormValues,
} from "./adminForm";
import {
  describeSelectedMemberResources,
  filterMemberResourcePickerItems,
  memberResourceSourceLabel,
  selectedResourceConfirmation,
  serializeMemberResources,
  selectionFromStoredResources,
  type MemberResourcePickerItem,
  type MemberResourceSelection,
  type SelectedMemberResource,
} from "./memberResources";
import type { HelpHubLessonRecord } from "../helpHubMemberLesson";

type PickerPayload = {
  lessons?: MemberResourcePickerItem[];
  library?: MemberResourcePickerItem[];
  allLessons?: HelpHubLessonRecord[];
};

function readJsonScript<T>(id: string, fallback: T): T {
  const el = document.getElementById(id);
  if (!el?.textContent) return fallback;
  try {
    return JSON.parse(el.textContent) as T;
  } catch {
    return fallback;
  }
}

function fieldValue(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  if (!el || !("value" in el)) return "";
  return String((el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value);
}

function splitLines(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && s !== "...");
}

function readFormValues(
  form: HTMLFormElement,
  selection: MemberResourceSelection,
): HelpHubAdminFormValues {
  const isNewEl = form.elements.namedItem("isNew");
  const isNew = Boolean(isNewEl && "checked" in isNewEl && (isNewEl as HTMLInputElement).checked);
  const serialized = serializeMemberResources(selection);
  return {
    question: fieldValue(form, "question").trim(),
    bubbleAnswer: fieldValue(form, "bubbleAnswer").trim(),
    hook: fieldValue(form, "hook").trim(),
    aboutTitle: fieldValue(form, "aboutTitle").trim(),
    solutionText: fieldValue(form, "solutionText").trim(),
    tryThis: fieldValue(form, "tryThis").trim(),
    trySteps: splitLines(fieldValue(form, "trySteps")),
    tryNote: fieldValue(form, "tryNote").trim(),
    tryImage: fieldValue(form, "tryImage").trim(),
    tryImageAlt: fieldValue(form, "tryImageAlt").trim(),
    tryImageCaption: fieldValue(form, "tryImageCaption").trim(),
    relatedLessons: serialized.relatedLessons,
    relatedLibraryVideos: serialized.relatedLibraryVideos,
    category: fieldValue(form, "category").trim(),
    isNew,
    slug: sanitizeHelpHubSlug(fieldValue(form, "slug")),
    status: fieldValue(form, "status").trim() || "draft",
  };
}

function snapshotForm(form: HTMLFormElement): Record<string, string | boolean> {
  const data: Record<string, string | boolean> = {};
  const els = form.elements;
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    const name = el instanceof HTMLElement ? el.getAttribute("name") : null;
    if (!name) continue;
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      data[name] = el.checked;
      continue;
    }
    if ("value" in el) data[name] = String((el as HTMLInputElement).value);
  }
  return data;
}

function applySnapshot(form: HTMLFormElement, data: Record<string, string | boolean>): void {
  Object.keys(data).forEach((name) => {
    const el = form.elements.namedItem(name);
    if (!el) return;
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      el.checked = Boolean(data[name]);
      return;
    }
    if ("value" in el) (el as HTMLInputElement).value = String(data[name] ?? "");
  });
}

function setSaveStatus(message: string, kind: "ok" | "err" | "signin" | null): void {
  const els = [
    document.getElementById("saveHelpHubStatus"),
    document.getElementById("saveHelpHubStatusTop"),
  ];
  els.forEach((el) => {
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("is-error", kind === "err" || kind === "signin");
    el.classList.toggle("is-ok", kind === "ok");
  });
  const signInBtn = document.getElementById("helpHubAdminSignIn");
  if (signInBtn) signInBtn.hidden = kind !== "signin";
}

function updateSaveButtonLabel(form: HTMLFormElement): void {
  const saveBtn = document.getElementById("saveHelpHubBtn");
  if (!saveBtn) return;
  saveBtn.textContent = saveButtonLabelForStatus(fieldValue(form, "status"));
}

function renderSelectedResources(
  selectedEl: HTMLElement,
  resources: SelectedMemberResource[],
  onRemove: (resource: SelectedMemberResource, index: number) => void,
): void {
  selectedEl.replaceChildren();
  resources.forEach((resource, index) => {
    const li = document.createElement("li");
    li.className = "member-resource-picker__card";
    if (resource.state !== "published") {
      li.classList.add(resource.state === "unpublished" ? "is-unpublished" : "is-missing");
    }
    const title = document.createElement("p");
    title.className = "member-resource-picker__confirm";
    title.textContent = selectedResourceConfirmation(resource);
    const source = document.createElement("p");
    source.className = "member-resource-picker__source";
    source.textContent = memberResourceSourceLabel(resource.source);
    li.appendChild(title);
    li.appendChild(source);
    if (resource.state !== "published") {
      const warn = document.createElement("p");
      warn.className = "related-lessons-picker__warn";
      warn.textContent =
        resource.state === "unpublished"
          ? "Unpublished — this lesson will not appear on the public Help Hub."
          : "Missing — no published lesson matches this reference.";
      li.appendChild(warn);
    }
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "related-lessons-picker__remove";
    rm.textContent = "Remove";
    rm.addEventListener("click", () => onRemove(resource, index));
    li.appendChild(rm);
    selectedEl.appendChild(li);
  });
}

function renderResourceOptions(
  optionsEl: HTMLElement,
  items: MemberResourcePickerItem[],
  selectedKeys: Set<string>,
  onToggle: (item: MemberResourcePickerItem) => void,
): void {
  optionsEl.replaceChildren();
  items.forEach((item) => {
    const li = document.createElement("li");
    const key = `${item.source}:${item.id}`;
    li.className = "related-lessons-picker__option";
    if (selectedKeys.has(key)) li.classList.add("is-selected");
    const title = document.createElement("span");
    title.className = "related-lessons-picker__title";
    title.textContent = item.title;
    const meta = document.createElement("span");
    meta.className = "related-lessons-picker__id";
    meta.textContent = `${memberResourceSourceLabel(item.source)} ${item.id}`;
    li.appendChild(title);
    li.appendChild(meta);
    li.addEventListener("click", () => onToggle(item));
    optionsEl.appendChild(li);
  });
}

function resourceKey(source: string, id: number): string {
  return `${source}:${id}`;
}

export function initHelpHubAdminEditor(): boolean {
  installHelpHubAdminBrowser();

  const form = document.querySelector<HTMLFormElement>(".help-hub-edit__form");
  const saveBtn = document.getElementById("saveHelpHubBtn");
  if (!helpHubAdminEditorCanInit({ form, saveButton: saveBtn }) || !form || !saveBtn) {
    return false;
  }

  const initialEntry = readJsonScript<Record<string, unknown> | null>("help-hub-current-entry", null);
  const pickerData = readJsonScript<PickerPayload>("help-hub-member-resource-data", {
    lessons: [],
    library: [],
    allLessons: [],
  });
  const libraryItems = Array.isArray(pickerData.library) ? pickerData.library : [];
  const lessonItems = Array.isArray(pickerData.lessons) ? pickerData.lessons : [];
  const allLessons = Array.isArray(pickerData.allLessons) ? pickerData.allLessons : [];
  const combinedItems = [...libraryItems, ...lessonItems];

  window.currentHelpHub =
    initialEntry && typeof initialEntry === "object" ? JSON.parse(JSON.stringify(initialEntry)) : {};

  let selection = selectionFromStoredResources(
    Array.isArray(window.currentHelpHub.relatedLessons)
      ? (window.currentHelpHub.relatedLessons as (string | number)[])
      : [],
    window.currentHelpHub.relatedLibraryVideos,
    allLessons,
    libraryItems,
  );

  const isNewEntry = window.currentHelpHub.id == null;
  let slugManuallyEdited = !isNewEntry;
  let suppressUnload = false;

  const hiddenLessons = document.getElementById("help-hub-related-lessons") as HTMLInputElement | null;
  const hiddenLibrary = document.getElementById("help-hub-related-library") as HTMLInputElement | null;
  const selectedEl = document.getElementById("member-resources-selected");
  const optionsEl = document.getElementById("member-resources-options");
  const search = document.getElementById("member-resources-search") as HTMLInputElement | null;
  const previewBtn = document.getElementById("previewHelpHub");
  const deleteBtn = document.getElementById("deleteHelpHubBtn");
  const recovery = document.getElementById("helpHubDraftRecovery");
  const restoreBtn = document.getElementById("helpHubRestoreDraft");
  const discardBtn = document.getElementById("helpHubDiscardDraft");
  const slugEl = form.elements.namedItem("slug");

  const draftKey = (() => {
    const base = "kbm:helpHubEditDraft:";
    const e = window.currentHelpHub;
    if (e && e.id != null && String(e.id).trim() !== "") return `${base}id:${String(e.id)}`;
    if (typeof e.slug === "string" && e.slug.trim()) return `${base}slug:${e.slug.trim()}`;
    return `${base}new`;
  })();

  function writeHidden(): void {
    const serialized = serializeMemberResources(selection);
    if (hiddenLessons) hiddenLessons.value = JSON.stringify(serialized.relatedLessons);
    if (hiddenLibrary) hiddenLibrary.value = JSON.stringify(serialized.relatedLibraryVideos);
    form.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function renderPicker(): void {
    if (!selectedEl || !optionsEl) return;
    const resources = describeSelectedMemberResources(selection, allLessons, libraryItems);
    renderSelectedResources(selectedEl, resources, (resource) => {
      if (resource.source === "library" && resource.id != null) {
        selection = {
          ...selection,
          libraryContentIds: selection.libraryContentIds.filter((id) => id !== resource.id),
        };
      } else if (resource.source === "lesson" && resource.id != null) {
        selection = {
          ...selection,
          lessonIds: selection.lessonIds.filter((id) => id !== resource.id),
        };
      } else if (resource.ref != null) {
        selection = {
          ...selection,
          unresolvedLessons: selection.unresolvedLessons.filter((ref) => String(ref) !== String(resource.ref)),
        };
      }
      writeHidden();
      renderPicker();
    });
    const q = search?.value ?? "";
    const filtered = filterMemberResourcePickerItems(combinedItems, q);
    const selectedKeys = new Set<string>([
      ...selection.libraryContentIds.map((id) => resourceKey("library", id)),
      ...selection.lessonIds.map((id) => resourceKey("lesson", id)),
    ]);
    renderResourceOptions(optionsEl, filtered, selectedKeys, (item) => {
      const key = resourceKey(item.source, item.id);
      if (item.source === "library") {
        selection = {
          ...selection,
          libraryContentIds: selectedKeys.has(key)
            ? selection.libraryContentIds.filter((id) => id !== item.id)
            : [...selection.libraryContentIds, item.id],
        };
      } else {
        selection = {
          ...selection,
          lessonIds: selectedKeys.has(key)
            ? selection.lessonIds.filter((id) => id !== item.id)
            : [...selection.lessonIds, item.id],
        };
      }
      writeHidden();
      renderPicker();
    });
  }

  function payloadFromForm() {
    const values = readFormValues(form, selection);
    return applyAdminFormToDocument(window.currentHelpHub, values);
  }

  const baselineSnapshot = JSON.stringify(snapshotForm(form));
  let savedSnapshot = baselineSnapshot;
  let pendingDraft: Record<string, string | boolean> | null = null;
  try {
    const raw = localStorage.getItem(draftKey);
    if (raw) {
      const parsed = JSON.parse(raw) as { data?: Record<string, string | boolean> };
      if (parsed?.data && typeof parsed.data === "object") pendingDraft = parsed.data;
    }
  } catch {
    pendingDraft = null;
  }

  function saveDraft(): void {
    try {
      const snap = snapshotForm(form);
      if (JSON.stringify(snap) === baselineSnapshot) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify({ v: 1, ts: Date.now(), data: snap }));
    } catch {
      /* ignore quota */
    }
  }

  function onFormActivity(ev: Event): void {
    const t = ev.target;
    if (t instanceof HTMLInputElement && t.getAttribute("name") === "slug") {
      const after = sanitizeHelpHubSlug(t.value);
      if (after !== t.value) t.value = after;
      slugManuallyEdited = true;
    }
    if (
      t instanceof HTMLTextAreaElement &&
      t.getAttribute("name") === "question" &&
      slugEl &&
      "value" in slugEl &&
      shouldAutofillSlug({ isNewEntry, slugManuallyEdited })
    ) {
      (slugEl as HTMLInputElement).value = slugFromQuestion(t.value);
    }
    updateSaveButtonLabel(form);
    saveDraft();
  }

  form.addEventListener("input", onFormActivity);
  form.addEventListener("change", onFormActivity);
  search?.addEventListener("input", () => renderPicker());
  writeHidden();
  renderPicker();
  updateSaveButtonLabel(form);

  if (pendingDraft && JSON.stringify(pendingDraft) !== baselineSnapshot) {
    if (recovery) recovery.hidden = false;
  } else if (pendingDraft) {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }

  restoreBtn?.addEventListener("click", () => {
    if (pendingDraft) {
      applySnapshot(form, pendingDraft);
      updateSaveButtonLabel(form);
      saveDraft();
    }
    if (recovery) recovery.hidden = true;
  });
  discardBtn?.addEventListener("click", () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    if (recovery) recovery.hidden = true;
  });

  window.addEventListener("beforeunload", (e) => {
    if (suppressUnload) return;
    if (JSON.stringify(snapshotForm(form)) !== savedSnapshot) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  async function saveEntry(): Promise<boolean> {
    const values = readFormValues(form, selection);
    const missing = missingRequiredAdminFields(values);
    if (missing.length) {
      setSaveStatus(`Missing required fields: ${missing.join(", ")}`, "err");
      return false;
    }
    const payload = payloadFromForm();
    const id =
      window.currentHelpHub && window.currentHelpHub.id != null ? window.currentHelpHub.id : null;
    const url =
      id != null && String(id).trim() !== ""
        ? `/api/admin/help-hub/${encodeURIComponent(String(id))}`
        : "/api/admin/help-hub";
    const method = id != null && String(id).trim() !== "" ? "PUT" : "POST";
    const admin = window.kbmHelpHubAdmin;
    if (!admin?.request) {
      setSaveStatus("Help Hub admin is still loading. Try Save again.", "err");
      return false;
    }
    saveBtn.setAttribute("disabled", "true");
    setSaveStatus("Saving…", null);
    try {
      const result = await admin.request(url, { method, body: payload });
      if (result.needsSignIn) {
        setSaveStatus(result.error || "Sign in with your Knit it Now account to save.", "signin");
        admin.promptSignIn?.();
        return false;
      }
      if (!admin.saveSucceeded(result)) {
        setSaveStatus(result.error || `Save failed (${result.status})`, "err");
        return false;
      }
      const data = result.data || {};
      const tip = (data as { tip?: Record<string, unknown> }).tip;
      if (tip && typeof tip === "object") {
        window.currentHelpHub = JSON.parse(JSON.stringify(tip));
      }
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      setSaveStatus("Saved", "ok");
      savedSnapshot = JSON.stringify(snapshotForm(form));
      if (method === "POST" && tip?.slug) {
        suppressUnload = true;
        window.setTimeout(() => {
          window.location.href = `/admin/help-hub-edit?slug=${encodeURIComponent(String(tip.slug))}`;
        }, 400);
      }
      return true;
    } catch {
      setSaveStatus("Save failed — network error", "err");
      return false;
    } finally {
      saveBtn.removeAttribute("disabled");
    }
  }

  saveBtn.addEventListener("click", () => {
    void saveEntry();
  });

  previewBtn?.addEventListener("click", async () => {
    const values = readFormValues(form, selection);
    const missing = missingRequiredAdminFields(values);
    if (missing.length) {
      setSaveStatus(`Missing required fields: ${missing.join(", ")}`, "err");
      return;
    }
    const admin = window.kbmHelpHubAdmin;
    if (!admin?.openPreview) {
      setSaveStatus("Help Hub admin is still loading. Try Preview again.", "err");
      return;
    }
    const previewWindow = window.open("", "_blank");
    setSaveStatus("Opening preview…", null);
    try {
      const result = await admin.openPreview(
        { document: payloadFromForm() },
        { previewWindow },
      );
      if (result.needsSignIn) {
        setSaveStatus(result.error || "Sign in with your Knit it Now account to preview.", "signin");
        admin.promptSignIn?.();
        return;
      }
      if (result.forbidden) {
        setSaveStatus(result.error || "This Knit it Now account does not have admin access.", "err");
        return;
      }
      if (!result.ok) {
        setSaveStatus(result.error || `Preview failed (${result.status})`, "err");
        return;
      }
      setSaveStatus("", null);
    } catch {
      previewWindow?.close();
      setSaveStatus("Preview failed — network error", "err");
    }
  });

  if (deleteBtn) {
    const existingId = window.currentHelpHub.id;
    if (existingId == null || String(existingId).trim() === "") {
      deleteBtn.hidden = true;
    }
    deleteBtn.addEventListener("click", async () => {
      const id = window.currentHelpHub.id;
      if (id == null || String(id).trim() === "") {
        setSaveStatus("Save the entry before deleting.", "err");
        return;
      }
      if (!window.confirm("Delete this Help Hub entry? It can be restored from the database.")) return;
      const admin = window.kbmHelpHubAdmin;
      if (!admin?.request) {
        setSaveStatus("Help Hub admin is still loading. Try Delete again.", "err");
        return;
      }
      deleteBtn.setAttribute("disabled", "true");
      try {
        const result = await admin.request(`/api/admin/help-hub/${encodeURIComponent(String(id))}`, {
          method: "DELETE",
        });
        if (result.needsSignIn) {
          setSaveStatus(result.error || "Sign in with your Knit it Now account to delete.", "signin");
          admin.promptSignIn?.();
          return;
        }
        if (!result.ok) {
          setSaveStatus(result.error || `Delete failed (${result.status})`, "err");
          return;
        }
        suppressUnload = true;
        window.location.href = "/admin/help-hub";
      } catch {
        setSaveStatus("Delete failed — network error", "err");
      } finally {
        deleteBtn.removeAttribute("disabled");
      }
    });
  }

  return true;
}

export function bootHelpHubAdminEditor(): void {
  const run = () => {
    installHelpHubAdminBrowser();
    document.getElementById("helpHubAdminSignIn")?.addEventListener("click", () => {
      window.kbmHelpHubAdmin?.promptSignIn?.();
    });
    initHelpHubAdminEditor();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
}

declare global {
  interface Window {
    currentHelpHub: Record<string, unknown>;
  }
}
