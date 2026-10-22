import { installHelpHubAdminBrowser } from "./adminEditorClient";
import { editorTargetForPreviewSection, htmlForHelpHubEditorFrame } from "./adminLivePreview";
import {
  applyAdminFormToDocument,
  helpHubAdminEditorCanInit,
  helpHubChooserPlacement,
  helpHubSaveActionLabel,
  isHelpHubImageUrl,
  missingRequiredAdminFields,
  sanitizeHelpHubSlug,
  shouldAutofillSlug,
  slugFromQuestion,
  statusForHelpHubSave,
  type HelpHubAdminFormValues,
  type HelpHubSaveIntent,
} from "./adminForm";
import { openerPreviewBaseHref, requestHelpHubPreview } from "./adminEditorClient";
import {
  addMemberResource,
  describeSelectedMemberResources,
  memberResourceOptionLabel,
  memberResourcePickerResults,
  memberResourceSourceLabel,
  moveMemberResource,
  removeMemberResourceAt,
  selectedLessonNumberLabel,
  serializeMemberResources,
  selectionDisplayOrder,
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

function readTrySteps(form: HTMLFormElement): string[] {
  const list = form.querySelector("[data-try-step-list]");
  if (list) {
    return Array.from(list.querySelectorAll<HTMLTextAreaElement>("[data-try-step]"))
      .map((row) => row.value.trim())
      .filter((step) => step && step !== "...");
  }
  return splitLines(fieldValue(form, "trySteps"));
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
    publicVideoUrl: fieldValue(form, "publicVideoUrl").trim(),
    publicVideoTitle: fieldValue(form, "publicVideoTitle").trim(),
    tryThis: fieldValue(form, "tryThis").trim(),
    trySteps: readTrySteps(form),
    tryNote: fieldValue(form, "tryNote").trim(),
    tryImage: fieldValue(form, "tryImage").trim(),
    tryImageAlt: fieldValue(form, "tryImageAlt").trim(),
    tryImageCaption: fieldValue(form, "tryImageCaption").trim(),
    mediaUrl: fieldValue(form, "mediaUrl").trim(),
    mediaAlt: fieldValue(form, "mediaAlt").trim(),
    mediaCaption: fieldValue(form, "mediaCaption").trim(),
    relatedToolEyebrow: fieldValue(form, "relatedToolEyebrow").trim(),
    relatedToolTitle: fieldValue(form, "relatedToolTitle").trim(),
    relatedToolNote: fieldValue(form, "relatedToolNote").trim(),
    relatedToolLabel: fieldValue(form, "relatedToolLabel").trim(),
    relatedToolUrl: fieldValue(form, "relatedToolUrl").trim(),
    relatedLessons: serialized.relatedLessons,
    relatedLibraryVideos: serialized.relatedLibraryVideos,
    memberResourceOrder: serialized.memberResourceOrder,
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
}

function storedHelpHubStatus(): string {
  const status = window.currentHelpHub?.status;
  return typeof status === "string" && status.trim() ? status : "draft";
}

function updateSaveButtonLabel(form: HTMLFormElement): void {
  const selected = fieldValue(form, "status");
  const stored = storedHelpHubStatus();
  const saveBtn = document.getElementById("saveHelpHubBtn");
  const publishBtn = document.getElementById("publishHelpHubBtn");
  if (saveBtn) {
    saveBtn.textContent = helpHubSaveActionLabel({
      intent: "keep",
      selectedStatus: selected,
      storedStatus: stored,
    });
  }
  if (publishBtn) {
    publishBtn.textContent = helpHubSaveActionLabel({
      intent: "publish",
      selectedStatus: selected,
      storedStatus: stored,
    });
  }
  const hint = document.getElementById("helpHubSaveHint");
  if (hint) {
    hint.textContent =
      stored.trim().toLowerCase() === "published"
        ? "Update keeps this published entry public unless you change Status. Publish also saves it as published."
        : "Save draft keeps this private. Publish makes it public. Neither runs on its own.";
  }
}

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  question: "Question",
  slug: "URL name",
  status: "Status",
  category: "Category",
};

function missingFieldsMessage(missing: string[]): string {
  const labels = missing.map((name) => REQUIRED_FIELD_LABELS[name] || name);
  return `Add ${labels.join(", ")} before saving. The rest of your text is still here.`;
}

function renderSelectedResources(
  selectedEl: HTMLElement,
  resources: SelectedMemberResource[],
  orderCount: number,
  onRemove: (index: number) => void,
  onMove: (index: number, delta: -1 | 1) => void,
): void {
  selectedEl.replaceChildren();
  if (!resources.length) {
    const empty = document.createElement("li");
    empty.className = "related-lessons-picker__empty";
    empty.textContent = "No related lessons selected yet.";
    selectedEl.appendChild(empty);
    return;
  }
  resources.forEach((resource, index) => {
    const li = document.createElement("li");
    li.className = "member-resource-picker__card";
    if (resource.state !== "published") {
      li.classList.add(resource.state === "unpublished" ? "is-unpublished" : "is-missing");
    }
    const copy = document.createElement("div");
    copy.className = "member-resource-picker__copy";
    const title = document.createElement("p");
    title.className = "member-resource-picker__title";
    title.textContent = resource.title;
    const number = document.createElement("p");
    number.className = "member-resource-picker__number";
    number.textContent = selectedLessonNumberLabel(resource);
    const source = document.createElement("p");
    source.className = "member-resource-picker__source";
    source.textContent = memberResourceSourceLabel(resource.source);
    copy.appendChild(title);
    copy.appendChild(number);
    copy.appendChild(source);
    li.appendChild(copy);
    if (resource.state !== "published") {
      const warn = document.createElement("p");
      warn.className = "related-lessons-picker__warn";
      warn.textContent =
        resource.state === "unpublished"
          ? "Unpublished — this lesson will not appear on the public Help Hub."
          : "Missing — no published lesson matches this reference.";
      li.appendChild(warn);
    }
    const actions = document.createElement("div");
    actions.className = "member-resource-picker__actions";
    if (resources.length > 1 && index < orderCount) {
      const up = document.createElement("button");
      up.type = "button";
      up.className = "related-lessons-picker__move";
      up.textContent = "Move up";
      up.disabled = index === 0;
      up.setAttribute("aria-label", `Move ${resource.title} up`);
      up.addEventListener("click", () => onMove(index, -1));
      const down = document.createElement("button");
      down.type = "button";
      down.className = "related-lessons-picker__move";
      down.textContent = "Move down";
      down.disabled = index >= orderCount - 1;
      down.setAttribute("aria-label", `Move ${resource.title} down`);
      down.addEventListener("click", () => onMove(index, 1));
      actions.appendChild(up);
      actions.appendChild(down);
    }
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "related-lessons-picker__remove";
    rm.textContent = "Remove";
    rm.setAttribute("aria-label", `Remove ${resource.title}`);
    rm.addEventListener("click", () => onRemove(index));
    actions.appendChild(rm);
    li.appendChild(actions);
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
    title.textContent = memberResourceOptionLabel(item);
    const meta = document.createElement("span");
    meta.className = "related-lessons-picker__id";
    meta.textContent = memberResourceSourceLabel(item.source);
    li.appendChild(title);
    li.appendChild(meta);
    li.addEventListener("click", () => onToggle(item));
    optionsEl.appendChild(li);
  });
}

function resourceKey(source: string, id: number): string {
  return `${source}:${id}`;
}

function helpHubEditHref(slug: string): string {
  return `/admin/help-hub-edit?slug=${encodeURIComponent(slug)}`;
}

function findChooserItem(root: ParentNode, slug: string): HTMLElement | null {
  const wanted = slug.trim();
  for (const item of root.querySelectorAll<HTMLElement>("[data-entry-slug]")) {
    if ((item.dataset.entrySlug || "") === wanted) return item;
  }
  return null;
}

function setChooserItemAction(item: HTMLElement, slug: string, status: string, current: boolean): void {
  const placement = helpHubChooserPlacement(status);
  const existing = item.querySelector("[data-chooser-action]");
  if (current) {
    const marker = document.createElement("span");
    marker.className = "help-hub-edit__chooser-current";
    marker.dataset.chooserAction = "current";
    marker.textContent = "Open now";
    if (existing) existing.replaceWith(marker);
    else item.appendChild(marker);
    item.classList.add("is-current");
    item.setAttribute("aria-current", "true");
    return;
  }
  const link = document.createElement("a");
  link.className = "kbm-btn kbm-btn-outline help-hub-edit__chooser-action";
  link.dataset.chooserAction = "link";
  link.href = helpHubEditHref(slug);
  link.textContent = placement.action;
  if (existing) existing.replaceWith(link);
  else item.appendChild(link);
  item.classList.remove("is-current");
  item.removeAttribute("aria-current");
}

function buildChooserItem(slug: string, label: string, status: string): HTMLLIElement {
  const placement = helpHubChooserPlacement(status);
  const item = document.createElement("li");
  item.className = "help-hub-edit__chooser-item";
  item.dataset.entrySlug = slug;
  item.dataset.entryStatus = placement.key;
  const main = document.createElement("div");
  main.className = "help-hub-edit__chooser-main";
  const title = document.createElement("span");
  title.className = "help-hub-edit__chooser-label";
  title.textContent = label;
  const badge = document.createElement("span");
  badge.className = "help-hub-edit__chooser-badge";
  badge.textContent = "Needs review";
  badge.hidden = placement.key !== "review";
  main.append(title, badge);
  item.append(main);
  setChooserItemAction(item, slug, status, false);
  return item;
}

function refreshChooserEmpty(chooser: ParentNode): void {
  chooser.querySelectorAll<HTMLElement>("[data-chooser-box]").forEach((box) => {
    const list = box.querySelector("[data-chooser-list]");
    const empty = box.querySelector<HTMLElement>("[data-chooser-empty]");
    if (!list || !empty) return;
    empty.hidden = list.querySelectorAll("[data-entry-slug]").length > 0;
  });
}

function setOpenEntryBanner(label: string, status: string): void {
  const placement = helpHubChooserPlacement(status);
  const title = document.getElementById("helpHubCurrentTitle");
  const pill = document.getElementById("helpHubCurrentStatus");
  const context = document.getElementById("helpHubEditingContext");
  if (title) title.textContent = label;
  if (pill) {
    pill.textContent = placement.statusLabel;
    pill.dataset.status = placement.key;
  }
  if (context) context.textContent = `Editing: ${label} — ${placement.statusLabel}`;
}

/** Move a saved entry into the Draft or Published box and keep it marked open. */
export function syncOpenHelpHubChooser(entry: { slug: string; label: string; status: string }): void {
  const chooser = document.querySelector<HTMLElement>('[data-help-hub-chooser="split"]');
  if (!chooser) return;
  const slug = entry.slug.trim();
  if (!slug) return;
  const placement = helpHubChooserPlacement(entry.status);
  const list = chooser.querySelector<HTMLElement>(`[data-chooser-list="${placement.box}"]`);
  if (!list) return;

  let item = findChooserItem(chooser, slug);
  if (!item) {
    item = chooser.querySelector<HTMLElement>(".help-hub-edit__chooser-item.is-current");
  }
  if (!item) item = buildChooserItem(slug, entry.label, entry.status);

  item.dataset.entrySlug = slug;
  item.dataset.entryStatus = placement.key;
  item.hidden = false;
  const labelEl = item.querySelector(".help-hub-edit__chooser-label");
  if (labelEl) labelEl.textContent = entry.label || slug;
  const badge = item.querySelector<HTMLElement>(".help-hub-edit__chooser-badge");
  if (badge) badge.hidden = placement.key !== "review";
  list.appendChild(item);

  chooser.querySelectorAll<HTMLElement>(".help-hub-edit__chooser-item").forEach((row) => {
    setChooserItemAction(row, row.dataset.entrySlug || "", row.dataset.entryStatus || "draft", row === item);
  });
  refreshChooserEmpty(chooser);
  setOpenEntryBanner(entry.label || slug, entry.status);
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
    window.currentHelpHub.memberResourceOrder,
  );

  const isNewEntry = window.currentHelpHub.id == null;
  let slugManuallyEdited = !isNewEntry;
  let suppressUnload = false;

  const hiddenLessons = document.getElementById("help-hub-related-lessons") as HTMLInputElement | null;
  const hiddenLibrary = document.getElementById("help-hub-related-library") as HTMLInputElement | null;
  const hiddenOrder = document.getElementById("help-hub-member-resource-order") as HTMLInputElement | null;
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

  function writeHidden(notify = true): void {
    const serialized = serializeMemberResources(selection);
    if (hiddenLessons) hiddenLessons.value = JSON.stringify(serialized.relatedLessons);
    if (hiddenLibrary) hiddenLibrary.value = JSON.stringify(serialized.relatedLibraryVideos);
    if (hiddenOrder) hiddenOrder.value = JSON.stringify(serialized.memberResourceOrder);
    if (notify) form.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function renderPicker(): void {
    if (!selectedEl || !optionsEl) return;
    const resources = describeSelectedMemberResources(selection, allLessons, libraryItems);
    const orderCount = selectionDisplayOrder(selection).length;
    renderSelectedResources(
      selectedEl,
      resources,
      orderCount,
      (index) => {
        selection = removeMemberResourceAt(selection, index);
        writeHidden();
        renderPicker();
      },
      (index, delta) => {
        selection = moveMemberResource(selection, index, delta);
        writeHidden();
        renderPicker();
      },
    );
    const q = search?.value ?? "";
    const filtered = memberResourcePickerResults(combinedItems, q);
    optionsEl.hidden = filtered.length === 0;
    const selectedKeys = new Set<string>([
      ...selection.libraryContentIds.map((id) => resourceKey("library", id)),
      ...selection.lessonIds.map((id) => resourceKey("lesson", id)),
    ]);
    renderResourceOptions(optionsEl, filtered, selectedKeys, (item) => {
      const next = addMemberResource(selection, item);
      if (next === selection) return;
      selection = next;
      if (search) search.value = "";
      writeHidden();
      renderPicker();
    });
  }

  function payloadFromForm(statusOverride?: string) {
    const values = readFormValues(form, selection);
    if (statusOverride) values.status = statusOverride;
    return applyAdminFormToDocument(window.currentHelpHub, values);
  }

  const stepList = form.querySelector<HTMLElement>("[data-try-step-list]");
  const addStepBtn = document.getElementById("helpHubAddStep");
  const previewFrame = document.getElementById("helpHubLivePreview");
  const previewPlaceholder = document.getElementById("helpHubPreviewPlaceholder");
  const previewStatus = document.getElementById("helpHubPreviewStatus");
  const publishBtn = document.getElementById("publishHelpHubBtn");
  const workspace = document.querySelector<HTMLElement>(".help-hub-edit__workspace");
  let previewAudience: "member" | "visitor" = "visitor";
  let previewTimer = 0;
  let previewRequest = 0;
  let promptedPreviewSignIn = false;

  function syncTryStepsStore(): void {
    const store = form.querySelector<HTMLTextAreaElement>('[name="trySteps"]');
    if (!store || !stepList) return;
    store.value = Array.from(stepList.querySelectorAll<HTMLTextAreaElement>("[data-try-step]"))
      .map((row) => row.value.replace(/\r?\n/g, " ").trim())
      .filter((step) => step && step !== "...")
      .join("\n");
  }

  function renumberSteps(): void {
    if (!stepList) return;
    const rows = Array.from(stepList.querySelectorAll<HTMLElement>("[data-try-step-row]"));
    rows.forEach((row, index) => {
      const label = row.querySelector(".help-hub-edit__step-label");
      if (label) label.textContent = `Step ${index + 1}`;
      const up = row.querySelector<HTMLButtonElement>('[data-step-action="up"]');
      const down = row.querySelector<HTMLButtonElement>('[data-step-action="down"]');
      if (up) up.disabled = index === 0;
      if (down) down.disabled = index === rows.length - 1;
    });
  }

  function createStepRow(value: string): HTMLElement {
    const row = document.createElement("div");
    row.className = "help-hub-edit__step";
    row.dataset.tryStepRow = "true";
    const label = document.createElement("span");
    label.className = "help-hub-edit__step-label";
    const area = document.createElement("textarea");
    area.className = "help-hub-edit__textarea";
    area.dataset.tryStep = "true";
    area.rows = 2;
    area.value = value;
    const actions = document.createElement("div");
    actions.className = "help-hub-edit__step-actions";
    for (const [action, text] of [
      ["up", "Move up"],
      ["down", "Move down"],
      ["remove", "Remove"],
    ] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.stepAction = action;
      button.textContent = text;
      actions.appendChild(button);
    }
    row.append(label, area, actions);
    return row;
  }

  function rebuildStepsFromStore(): void {
    if (!stepList) return;
    const store = form.querySelector<HTMLTextAreaElement>('[name="trySteps"]');
    const lines = splitLines(store?.value || "");
    stepList.replaceChildren();
    lines.forEach((line) => stepList.appendChild(createStepRow(line)));
    renumberSteps();
  }

  function syncImageFields(root: ParentNode = form): void {
    root.querySelectorAll<HTMLElement>("[data-image-fields]").forEach((group) => {
      const urlInput = group.querySelector<HTMLInputElement>("[data-image-url]");
      const altInput = group.querySelector<HTMLInputElement>("[data-image-alt]");
      const thumb = group.querySelector<HTMLElement>("[data-image-thumb]");
      const img = thumb?.querySelector("img");
      if (!urlInput || !thumb || !(img instanceof HTMLImageElement)) return;
      const url = urlInput.value.trim();
      if (!isHelpHubImageUrl(url)) {
        thumb.hidden = true;
        img.removeAttribute("src");
        return;
      }
      img.src = url;
      img.alt = altInput?.value.trim() || "";
      thumb.hidden = false;
    });
  }

  function setPreviewStatus(message: string, kind: "ok" | "err" | null): void {
    if (!previewStatus) return;
    previewStatus.textContent = message;
    previewStatus.classList.toggle("is-error", kind === "err");
    previewStatus.classList.toggle("is-ok", kind === "ok");
  }

  function showPreviewFrame(html: string): void {
    if (!(previewFrame instanceof HTMLIFrameElement)) return;
    previewFrame.srcdoc = htmlForHelpHubEditorFrame(html, openerPreviewBaseHref());
    previewFrame.hidden = false;
    if (previewPlaceholder) previewPlaceholder.hidden = true;
  }

  function bindPreviewFrame(frame: HTMLIFrameElement): void {
    const doc = frame.contentDocument;
    if (!doc || doc.documentElement.dataset.editorBound === "true") return;
    doc.documentElement.dataset.editorBound = "true";
    doc.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!target || typeof (target as Element).closest !== "function") return;
        const link = (target as Element).closest("a");
        if (link) {
          event.preventDefault();
          event.stopPropagation();
        }
        const sectionEl = target.closest("[data-help-hub-section]");
        const section = sectionEl?.getAttribute("data-help-hub-section") || "";
        if (!section) return;
        doc.querySelectorAll("[data-help-hub-section].is-editor-selected").forEach((el) => {
          el.classList.remove("is-editor-selected");
        });
        doc.querySelectorAll(`[data-help-hub-section="${CSS.escape(section)}"]`).forEach((el) => {
          el.classList.add("is-editor-selected");
        });
        focusEditorSection(section);
      },
      true,
    );
    doc.addEventListener("submit", (event) => event.preventDefault(), true);
    const frameWindow = frame.contentWindow;
    if (frameWindow) {
      frameWindow.open = (() => null) as typeof frameWindow.open;
    }
  }

  function focusEditorSection(section: string): void {
    const target = editorTargetForPreviewSection(section);
    if (!target) return;
    if (workspace && window.matchMedia("(max-width: 1099px)").matches) {
      setEditorMode("edit");
    }
    const group = form.querySelector(`[data-editor-group="${target.group}"]`);
    if (group instanceof HTMLDetailsElement) group.open = true;
    const field = document.getElementById(target.fieldId);
    window.setTimeout(() => {
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (field instanceof HTMLElement) field.focus({ preventScroll: true });
    }, 0);
  }

  function setEditorMode(mode: "edit" | "preview"): void {
    if (workspace) workspace.dataset.mode = mode;
    document.getElementById("helpHubModeEdit")?.setAttribute("aria-selected", mode === "edit" ? "true" : "false");
    document
      .getElementById("helpHubModePreview")
      ?.setAttribute("aria-selected", mode === "preview" ? "true" : "false");
  }

  async function refreshLivePreview(): Promise<void> {
    const requestId = ++previewRequest;
    const values = readFormValues(form, selection);
    if (!values.question.trim() || !values.slug.trim()) {
      setPreviewStatus("", null);
      if (previewPlaceholder) {
        previewPlaceholder.hidden = false;
        previewPlaceholder.textContent = "Add a question to see the public page.";
      }
      if (previewFrame instanceof HTMLIFrameElement) previewFrame.hidden = true;
      return;
    }
    setPreviewStatus("Updating preview…", null);
    try {
      const result = await requestHelpHubPreview({
        document: payloadFromForm(),
        audience: previewAudience,
      });
      if (requestId !== previewRequest) return;
      if (result.needsSignIn) {
        setPreviewStatus(result.error || "Sign in to preview this draft.", "err");
        if (!promptedPreviewSignIn) {
          promptedPreviewSignIn = true;
          window.kbmHelpHubAdmin?.promptSignIn?.();
        }
        return;
      }
      if (!result.ok || !result.html) {
        setPreviewStatus(result.error || "The preview could not be updated. Your text is still in the editor.", "err");
        return;
      }
      showPreviewFrame(result.html);
      setPreviewStatus("Preview updated", "ok");
    } catch {
      if (requestId !== previewRequest) return;
      setPreviewStatus("The preview could not be updated because of a network problem. Your text is still in the editor.", "err");
    }
  }

  function schedulePreview(): void {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      void refreshLivePreview();
    }, 400);
  }

  writeHidden(false);
  renumberSteps();
  syncTryStepsStore();
  syncImageFields();

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
    if (t instanceof HTMLTextAreaElement && t.hasAttribute("data-try-step")) syncTryStepsStore();
    syncImageFields();
    updateSaveButtonLabel(form);
    saveDraft();
    schedulePreview();
  }

  form.addEventListener("input", onFormActivity);
  form.addEventListener("change", onFormActivity);
  search?.addEventListener("input", () => renderPicker());
  renderPicker();
  updateSaveButtonLabel(form);
  schedulePreview();

  stepList?.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-step-action]") : null;
    const row = button?.closest<HTMLElement>("[data-try-step-row]");
    if (!button || !row || !stepList) return;
    const action = button.dataset.stepAction;
    if (action === "remove") row.remove();
    if (action === "up" && row.previousElementSibling) stepList.insertBefore(row, row.previousElementSibling);
    if (action === "down" && row.nextElementSibling) stepList.insertBefore(row.nextElementSibling, row);
    renumberSteps();
    syncTryStepsStore();
    form.dispatchEvent(new Event("input", { bubbles: true }));
  });
  addStepBtn?.addEventListener("click", () => {
    if (!stepList) return;
    const tryGroup = form.querySelector('[data-editor-group="try"]');
    if (tryGroup instanceof HTMLDetailsElement) tryGroup.open = true;
    const row = createStepRow("");
    stepList.appendChild(row);
    renumberSteps();
    row.querySelector("textarea")?.focus();
  });
  function readImageFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read that image."));
      reader.readAsDataURL(file);
    });
  }

  async function uploadImageFile(group: HTMLElement, file: File): Promise<void> {
    const status = group.querySelector<HTMLElement>("[data-image-upload-status]");
    const urlInput = group.querySelector<HTMLInputElement>("[data-image-url]");
    const setStatus = (message: string) => {
      if (status) status.textContent = message;
    };
    if (!urlInput) return;
    const admin = window.kbmHelpHubAdmin;
    if (!admin?.request) {
      setStatus("Help Hub admin is still loading. Try Choose image again.");
      return;
    }
    setStatus("Uploading image…");
    try {
      const dataBase64 = await readImageFile(file);
      const result = await admin.request("/api/admin/help-hub/images", {
        method: "POST",
        body: { filename: file.name, mimeType: file.type || "", dataBase64 },
      });
      if (result.needsSignIn) {
        setStatus(result.error || "Sign in with your Knit it Now account to upload an image.");
        admin.promptSignIn?.();
        return;
      }
      if (!admin.saveSucceeded(result)) {
        setStatus(result.error || "Could not upload that image. The other fields are unchanged.");
        return;
      }
      const url = typeof result.data.url === "string" ? result.data.url.trim() : "";
      if (!url) {
        setStatus("Upload did not return an image address. The other fields are unchanged.");
        return;
      }
      urlInput.value = url;
      setStatus("Image address filled in. Save the draft to keep it on this entry.");
      syncImageFields(group);
      form.dispatchEvent(new Event("input", { bubbles: true }));
    } catch {
      setStatus("Could not upload that image. The other fields are unchanged.");
    }
  }

  form.addEventListener("click", (event) => {
    const choose = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-image-choose]") : null;
    if (choose) {
      choose.closest("[data-image-fields]")?.querySelector<HTMLInputElement>("[data-image-file]")?.click();
      return;
    }
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-image-remove]") : null;
    const group = button?.closest<HTMLElement>("[data-image-fields]");
    if (!button || !group) return;
    group.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-image-url], [data-image-alt], [data-image-caption]").forEach((field) => {
      field.value = "";
    });
    syncImageFields(group);
    form.dispatchEvent(new Event("input", { bubbles: true }));
  });
  form.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.matches("[data-image-file]")) return;
    const file = input.files?.[0];
    const group = input.closest<HTMLElement>("[data-image-fields]");
    input.value = "";
    if (!file || !group) return;
    void uploadImageFile(group, file);
  });
  if (previewFrame instanceof HTMLIFrameElement) {
    previewFrame.addEventListener("load", () => bindPreviewFrame(previewFrame));
  }
  document.getElementById("helpHubModeEdit")?.addEventListener("click", () => setEditorMode("edit"));
  document.getElementById("helpHubModePreview")?.addEventListener("click", () => setEditorMode("preview"));
  document.querySelectorAll<HTMLButtonElement>("[data-preview-audience]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.previewAudience === "member" ? "member" : "visitor";
      previewAudience = next;
      document.querySelectorAll<HTMLButtonElement>("[data-preview-audience]").forEach((other) => {
        other.setAttribute("aria-pressed", other === button ? "true" : "false");
      });
      void refreshLivePreview();
    });
  });
  const entrySelect = document.getElementById("helpHubOpenEntry");
  const entrySearch = document.getElementById("helpHubEntrySearch");
  if (entrySearch instanceof HTMLInputElement && entrySelect instanceof HTMLSelectElement) {
    entrySearch.addEventListener("input", () => {
      const query = entrySearch.value.trim().toLowerCase();
      entrySelect.querySelectorAll("optgroup").forEach((group) => {
        let visible = 0;
        group.querySelectorAll("option").forEach((option) => {
          const show =
            !query ||
            (option.textContent || "").toLowerCase().includes(query) ||
            option.value.toLowerCase().includes(query);
          option.hidden = !show;
          if (show) visible += 1;
        });
        (group as HTMLOptGroupElement).hidden = visible === 0;
      });
    });
  }
  if (entrySearch instanceof HTMLInputElement && !(entrySelect instanceof HTMLSelectElement)) {
    entrySearch.addEventListener("input", () => {
      const query = entrySearch.value.trim().toLowerCase();
      document.querySelectorAll<HTMLElement>("[data-entry-slug]").forEach((item) => {
        const text = (item.textContent || "").toLowerCase();
        const itemSlug = (item.dataset.entrySlug || "").toLowerCase();
        item.hidden = Boolean(query) && !text.includes(query) && !itemSlug.includes(query);
      });
    });
  }
  if (entrySelect instanceof HTMLSelectElement) {
    const currentSlug = new URL(window.location.href).searchParams.get("slug")?.trim() || "";
    entrySelect.addEventListener("change", () => {
      const next = entrySelect.value.trim();
      if (next === currentSlug) return;
      if (JSON.stringify(snapshotForm(form)) !== savedSnapshot) {
        if (!window.confirm("You have unsaved changes. Leave this page without saving?")) {
          entrySelect.value = currentSlug;
          return;
        }
      }
      suppressUnload = true;
      window.location.href = next
        ? `/admin/help-hub-edit?slug=${encodeURIComponent(next)}`
        : "/admin/help-hub-edit";
    });
  }

  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(link instanceof HTMLAnchorElement)) return;
    const href = link.getAttribute("href") || "";
    if (!href || href.startsWith("#")) return;
    if (JSON.stringify(snapshotForm(form)) === savedSnapshot) return;
    if (!window.confirm("You have unsaved changes. Leave this page without saving?")) {
      event.preventDefault();
      return;
    }
    suppressUnload = true;
  });

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
      rebuildStepsFromStore();
      syncImageFields();
      updateSaveButtonLabel(form);
      saveDraft();
      schedulePreview();
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

  function setSaving(disabled: boolean): void {
    if (disabled) {
      saveBtn.setAttribute("disabled", "true");
      publishBtn?.setAttribute("disabled", "true");
    } else {
      saveBtn.removeAttribute("disabled");
      publishBtn?.removeAttribute("disabled");
    }
  }

  async function saveEntry(intent: HelpHubSaveIntent): Promise<boolean> {
    syncTryStepsStore();
    const nextStatus = statusForHelpHubSave({
      intent,
      selectedStatus: fieldValue(form, "status"),
      storedStatus: storedHelpHubStatus(),
    });
    const values = readFormValues(form, selection);
    values.status = nextStatus;
    const missing = missingRequiredAdminFields(values);
    if (missing.length) {
      setSaveStatus(missingFieldsMessage(missing), "err");
      return false;
    }
    const payload = payloadFromForm(nextStatus);
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
    setSaving(true);
    setSaveStatus("Saving…", null);
    try {
      const result = await admin.request(url, { method, body: payload });
      if (result.needsSignIn) {
        setSaveStatus(
          `${result.error || "Sign in with your Knit it Now account to save."} Your text is still in the editor.`,
          "signin",
        );
        admin.promptSignIn?.();
        return false;
      }
      if (!admin.saveSucceeded(result)) {
        setSaveStatus(
          `${result.error || `Save failed (${result.status})`} Your text is still in the editor.`,
          "err",
        );
        return false;
      }
      const data = result.data || {};
      const tip = (data as { tip?: Record<string, unknown> }).tip;
      if (tip && typeof tip === "object") {
        window.currentHelpHub = JSON.parse(JSON.stringify(tip));
      }
      const statusEl = form.elements.namedItem("status");
      if (statusEl && "value" in statusEl) (statusEl as HTMLSelectElement).value = nextStatus;
      if (window.currentHelpHub && typeof window.currentHelpHub === "object") {
        window.currentHelpHub.status = nextStatus;
      }
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      updateSaveButtonLabel(form);
      setSaveStatus(nextStatus === "published" ? "Published" : "Saved", "ok");
      savedSnapshot = JSON.stringify(snapshotForm(form));
      const savedSlug =
        tip && typeof tip.slug === "string" && tip.slug.trim()
          ? tip.slug.trim()
          : fieldValue(form, "slug").trim();
      const savedLabel = fieldValue(form, "question").trim() || savedSlug;
      syncOpenHelpHubChooser({ slug: savedSlug, label: savedLabel, status: nextStatus });
      if (method === "POST" && tip?.slug) {
        suppressUnload = true;
        window.setTimeout(() => {
          window.location.href = `/admin/help-hub-edit?slug=${encodeURIComponent(String(tip.slug))}`;
        }, 400);
      }
      return true;
    } catch {
      setSaveStatus("Could not save because of a network problem. Your text is still in the editor.", "err");
      return false;
    } finally {
      setSaving(false);
    }
  }

  saveBtn.addEventListener("click", () => {
    void saveEntry("keep");
  });
  publishBtn?.addEventListener("click", () => {
    void saveEntry("publish");
  });

  previewBtn?.addEventListener("click", async () => {
    const values = readFormValues(form, selection);
    if (!values.question.trim() || !values.slug.trim()) {
      setSaveStatus("Add a question before opening the full page. Your text is still in the editor.", "err");
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
        { document: payloadFromForm(), audience: previewAudience },
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
