import {
  addCourse111ComponentToBlock,
  cloneCourse111Data,
  COURSE_111_ID,
  deleteCourse111Block,
  deleteCourse111Component,
  describeCourse111Component,
  filterCourse111OriginalLessons,
  findCourse111Lesson,
  findCourse111OriginalLesson,
  listCourse111LessonComponents,
  listCourse111OriginalLessons,
  patchCourse111Component,
  readCourse111Publication,
  resolveCourse111SelectedLessonPreview,
  runCourse111SaveAndPreview,
  course111SaveStatusMessage,
  summarizeCourse111Block,
  updateCourse111BlockTitle,
  type Course111EditableType,
  type Course111OriginalLessonSummary,
  type Course111PublicationSnapshot,
} from "../lib/legacy_kin/course111AdminModel";
import type {
  CourseBlock,
  CourseComponent,
  CourseLesson,
  CoursePreviewData,
} from "../lib/legacy_kin/coursePreviewPoc";
import { sortedComponents } from "../lib/legacy_kin/coursePreviewPoc";

const API_URL = "/api/admin/course-content";

type Dom = {
  app: HTMLElement | null;
  loading: HTMLElement | null;
  status: HTMLElement | null;
  dirty: HTMLElement | null;
  courseTitle: HTMLElement | null;
  search: HTMLInputElement | null;
  lessons: HTMLElement | null;
  main: HTMLElement | null;
  preview: HTMLAnchorElement | null;
  saveLesson: HTMLButtonElement | null;
  savePreview: HTMLButtonElement | null;
  saveCourse: HTMLButtonElement | null;
  reload: HTMLButtonElement | null;
};

const dom: Dom = {
  app: null,
  loading: null,
  status: null,
  dirty: null,
  courseTitle: null,
  search: null,
  lessons: null,
  main: null,
  preview: null,
  saveLesson: null,
  savePreview: null,
  saveCourse: null,
  reload: null,
};

let course: CoursePreviewData | null = null;
let publication: Course111PublicationSnapshot | null = null;
let selectedParentSlug: string | null = null;
let selectedBlockSlug: string | null = null;
let dirty = false;
let searchQuery = "";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setStatus(message: string, isError = false) {
  if (!dom.status) return;
  dom.status.textContent = message;
  dom.status.classList.toggle("is-error", isError);
}

function setDirty(next: boolean) {
  dirty = next;
  if (!dom.dirty) return;
  dom.dirty.textContent = dirty ? "Unsaved changes" : "Saved";
  dom.dirty.classList.toggle("is-dirty", dirty);
  dom.dirty.classList.toggle("is-saved", !dirty);
  if (dom.saveLesson) dom.saveLesson.disabled = !dirty;
  if (dom.saveCourse) dom.saveCourse.disabled = !dirty;
}

function currentOriginalLesson(): { parent: CourseLesson; block: CourseBlock } | null {
  if (!course || !selectedParentSlug || !selectedBlockSlug) return null;
  return (
    findCourse111OriginalLesson(course, selectedParentSlug, selectedBlockSlug) ??
    null
  );
}

function selectedOriginalSummary(): Course111OriginalLessonSummary | null {
  if (!course || !selectedParentSlug || !selectedBlockSlug) return null;
  return (
    listCourse111OriginalLessons(course).find(
      (lesson) =>
        lesson.parentSlug === selectedParentSlug &&
        lesson.blockSlug === selectedBlockSlug,
    ) ?? null
  );
}

function updatePreviewLink() {
  if (!dom.preview || !course || !selectedParentSlug) {
    if (dom.preview) {
      dom.preview.href = "#";
      dom.preview.setAttribute("aria-disabled", "true");
    }
    if (dom.savePreview) dom.savePreview.disabled = true;
    return;
  }

  const resolved = selectedParentSlug && selectedBlockSlug
    ? resolveCourse111SelectedLessonPreview(course, selectedParentSlug, selectedBlockSlug)
    : null;
  dom.preview.href = resolved?.previewHref ?? "#";
  dom.preview.toggleAttribute("aria-disabled", !resolved);
  if (dom.savePreview) dom.savePreview.disabled = !resolved;
}

async function loadCourse() {
  setStatus("Loading Course 111…");
  const response = await fetch(`${API_URL}?courseId=${COURSE_111_ID}`, {
    headers: { Accept: "application/json" },
  });
  const payload = (await response.json()) as {
    ok?: boolean;
    error?: string;
    course?: CoursePreviewData;
  };
  if (!response.ok || !payload.ok || !payload.course) {
    throw new Error(payload.error || "Could not load Course 111.");
  }
  course = cloneCourse111Data(payload.course);
  publication = readCourse111Publication(course.course);
  const originals = listCourse111OriginalLessons(course);
  const stillSelected = originals.some(
    (lesson) =>
      lesson.parentSlug === selectedParentSlug &&
      lesson.blockSlug === selectedBlockSlug,
  );
  if (!stillSelected) {
    selectedParentSlug = originals[0]?.parentSlug ?? null;
    selectedBlockSlug = originals[0]?.blockSlug ?? null;
  }
  setDirty(false);
  const draftLabel =
    publication?.status === "draft" || publication?.published === false
      ? "draft / unpublished"
      : "publication flags loaded";
  setStatus(`Course 111 loaded (${draftLabel}). Edits stay local until you save.`);
}

function renderLessons() {
  if (!dom.lessons || !course) return;
  const lessons = filterCourse111OriginalLessons(
    listCourse111OriginalLessons(course),
    searchQuery,
  );
  if (lessons.length === 0) {
    dom.lessons.innerHTML = `<p class="course111-admin__hint">No lessons match.</p>`;
    return;
  }

  let lastParent = "";
  const parts: string[] = [];
  for (const lesson of lessons) {
    if (lesson.parentSlug !== lastParent) {
      parts.push(
        `<p class="course111-admin__group">${escapeHtml(lesson.parentTitle)}</p>`,
      );
      lastParent = lesson.parentSlug;
    }
    const selected =
      lesson.parentSlug === selectedParentSlug &&
      lesson.blockSlug === selectedBlockSlug
        ? " is-selected"
        : "";
    const unpublished = lesson.published ? "" : " is-unpublished";
    const typeLabel = lesson.componentTypes.join(" + ") || "empty";
    parts.push(`<button type="button" class="course111-admin__lesson${selected}" data-parent-slug="${escapeHtml(lesson.parentSlug)}" data-block-slug="${escapeHtml(lesson.blockSlug)}">
        <span class="course111-admin__lesson-num">Lesson ${lesson.assignId || lesson.index + 1}</span>
        <span class="course111-admin__lesson-title">${escapeHtml(lesson.title)}</span>
        <span class="course111-admin__lesson-status${unpublished}">${escapeHtml(lesson.statusLabel)} · ${lesson.componentCount} components · ${escapeHtml(typeLabel)}</span>
      </button>`);
  }
  dom.lessons.innerHTML = parts.join("");
}

function componentHeadHtml(
  block: CourseBlock,
  component: CourseComponent,
  index: number,
): string {
  const view = describeCourse111Component(component);
  const imageList = view.imageSrcs
    .map((src) => `<li><code>${escapeHtml(src)}</code></li>`)
    .join("");
  return `<header class="course111-admin__component-head">
      <div>
        <div class="course111-admin__component-type">${escapeHtml(view.typeLabel)}</div>
        <p class="course111-admin__identity">${escapeHtml(view.identity)}</p>
        <p class="course111-admin__hint">component ${view.legacyComponentId} · order ${view.order}</p>
        ${imageList ? `<ul class="course111-admin__srcs">${imageList}</ul>` : ""}
      </div>
      <button type="button" class="course111-admin__btn course111-admin__btn--danger" data-action="delete-component" data-block-slug="${escapeHtml(block.slug)}" data-component-index="${index}">Delete component</button>
    </header>`;
}

function componentEditorHtml(
  block: CourseBlock,
  component: CourseComponent,
  index: number,
): string {
  const id = component.legacyComponentId;
  const type = component.type;
  const head = componentHeadHtml(block, component, index);
  const wrap = `class="course111-admin__component" data-block-slug="${escapeHtml(block.slug)}" data-component-id="${id}" data-component-index="${index}" data-component-type="${escapeHtml(type)}"`;

  if (type === "richText") {
    return `<div ${wrap}>
      ${head}
      <label class="course111-admin__label">HTML
        <textarea class="course111-admin__textarea" data-field="html">${escapeHtml(component.html ?? "")}</textarea>
      </label>
    </div>`;
  }

  if (type === "video") {
    return `<div ${wrap}>
      ${head}
      <label class="course111-admin__label">Vimeo ID
        <input class="course111-admin__input" data-field="vimeoId" type="text" value="${escapeHtml(component.vimeoId ?? "")}">
      </label>
      <label class="course111-admin__label">Title (optional)
        <input class="course111-admin__input" data-field="title" type="text" value="${escapeHtml(component.title ?? "")}">
      </label>
    </div>`;
  }

  if (type === "image") {
    return `<div ${wrap}>
      ${head}
      <label class="course111-admin__label">Source
        <input class="course111-admin__input" data-field="src" type="text" value="${escapeHtml(component.src ?? "")}">
      </label>
      <label class="course111-admin__label">Alt text
        <input class="course111-admin__input" data-field="alt" type="text" value="${escapeHtml(component.alt ?? "")}">
      </label>
      <label class="course111-admin__label">Caption (optional)
        <input class="course111-admin__input" data-field="caption" type="text" value="${escapeHtml(component.caption ?? "")}">
      </label>
    </div>`;
  }

  if (type === "download") {
    return `<div ${wrap}>
      ${head}
      <label class="course111-admin__label">Label
        <input class="course111-admin__input" data-field="label" type="text" value="${escapeHtml(component.label ?? "")}">
      </label>
      <label class="course111-admin__label">URL or filename
        <input class="course111-admin__input" data-field="filename" type="text" value="${escapeHtml(component.filename ?? "")}" placeholder="/images/course-content/111/file.pdf">
      </label>
      <p class="course111-admin__hint">Stored as the download component filename/path used by the learner renderer.</p>
    </div>`;
  }

  const preview = escapeHtml(JSON.stringify(component, null, 2));
  return `<div ${wrap}>
    ${head}
    <p class="course111-admin__preserved">Current settings are shown below. Dedicated field editors exist for text, video, image, and download; other imported types can still be removed.
      <br><code>${preview}</code>
    </p>
  </div>`;
}

function renderMain() {
  if (!dom.main || !course) return;
  const current = currentOriginalLesson();
  const summary = selectedOriginalSummary();
  if (!current || !summary) {
    dom.main.innerHTML = `<p class="course111-admin__empty">Select a lesson to edit.</p>`;
    return;
  }

  const { parent, block } = current;
  const blockSummary = summarizeCourse111Block(block);
  const components = listCourse111LessonComponents(block)
    .map((view) => {
      const component = sortedComponents(block)[view.index];
      return component ? componentEditorHtml(block, component, view.index) : "";
    })
    .join("");
  const deleteLesson = blockSummary.canDelete
    ? `<button type="button" class="course111-admin__btn course111-admin__btn--danger" data-action="delete-block" data-block-slug="${escapeHtml(block.slug)}">Delete lesson</button>`
    : `<button type="button" class="course111-admin__btn course111-admin__btn--danger" data-action="delete-block" data-block-slug="${escapeHtml(block.slug)}" disabled title="This lesson includes a type without a dedicated block delete yet. Remove individual components instead.">Delete lesson</button>`;

  dom.main.innerHTML = `
    <div class="course111-admin__lesson-header">
      <label class="course111-admin__label">Lesson title
        <input id="course111-lesson-title" class="course111-admin__input" type="text" value="${escapeHtml(block.title)}">
      </label>
      <p class="course111-admin__hint">
        Lesson ${summary.assignId || "—"} in ${escapeHtml(parent.title)}.
        Slug <code>${escapeHtml(block.slug)}</code> is preserved.
        Published flag: <strong>${parent.published === false ? "unpublished" : "visible"}</strong> (not changed by this editor).
      </p>
      <div class="course111-admin__block-actions">${deleteLesson}</div>
    </div>
    <div class="course111-admin__add-row">
      <label class="course111-admin__label">Add component
        <select id="course111-add-type" class="course111-admin__select">
          <option value="richText">Rich text / HTML</option>
          <option value="video">Video (Vimeo)</option>
          <option value="image">Image</option>
          <option value="download">Download / file</option>
        </select>
      </label>
      <button type="button" class="course111-admin__btn course111-admin__btn--primary" data-action="add-component">Add component</button>
    </div>
    <div class="course111-admin__blocks">
      <article class="course111-admin__block" data-block-slug="${escapeHtml(block.slug)}">
        <header class="course111-admin__block-head">
          <div class="course111-admin__block-meta">
            <h3 class="course111-admin__block-title">Components in display order</h3>
            <div class="course111-admin__block-types">${escapeHtml(blockSummary.types.join(" + ") || "empty")} · ${listCourse111LessonComponents(block).length} total</div>
          </div>
        </header>
        <div class="course111-admin__block-body">${components || `<p class="course111-admin__hint">No components in this lesson.</p>`}</div>
      </article>
    </div>
  `;
}

function renderAll() {
  if (dom.courseTitle && course) {
    dom.courseTitle.textContent = course.course.title;
  }
  renderLessons();
  renderMain();
  updatePreviewLink();
}

function selectOriginalLesson(parentSlug: string, blockSlug: string) {
  const sameParent = parentSlug === selectedParentSlug;
  if (dirty && !sameParent) {
    const ok = window.confirm(
      "You have unsaved changes. Switch lessons and discard them?",
    );
    if (!ok) return;
    void reloadFromDisk().then(() => {
      selectedParentSlug = parentSlug;
      selectedBlockSlug = blockSlug;
      renderAll();
    });
    return;
  }
  selectedParentSlug = parentSlug;
  selectedBlockSlug = blockSlug;
  renderAll();
}

async function reloadFromDisk() {
  await loadCourse();
  renderAll();
}

type SavePayload = {
  ok?: boolean;
  error?: string;
  persistedVia?: "filesystem" | "blob" | "github";
  branch?: string;
  commitSha?: string;
};

async function saveCurrentLesson(lessonSlug = selectedParentSlug): Promise<SavePayload | null> {
  if (!course || !lessonSlug) return null;
  const lesson = findCourse111Lesson(course, lessonSlug);
  if (!lesson) throw new Error(`Lesson not found: ${lessonSlug}`);

  setStatus("Saving lesson…");
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      courseId: COURSE_111_ID,
      action: "saveLesson",
      lessonSlug,
      lesson,
      removeEmptyBlocks: false,
    }),
  });
  const payload = (await response.json()) as SavePayload;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Save lesson failed.");
  }
  setDirty(false);
  const current = currentOriginalLesson();
  setStatus(
    course111SaveStatusMessage({
      persistedVia: payload.persistedVia,
      lessonTitle: current?.block.title || lesson.title,
    }),
  );
  return payload;
}

async function saveAndPreviewLesson() {
  if (!course || !selectedParentSlug || !selectedBlockSlug) {
    throw new Error("Select a lesson before Save & Preview.");
  }

  const result = await runCourse111SaveAndPreview({
    data: course,
    selectedLessonSlug: selectedParentSlug,
    selectedBlockSlug: selectedBlockSlug,
    saveLesson: async (lessonSlug) => {
      const payload = await saveCurrentLesson(lessonSlug);
      return { persistedVia: payload?.persistedVia };
    },
    openPreview: (href) => {
      window.open(href, "_blank", "noopener,noreferrer");
    },
  });

  updatePreviewLink();
  const current = currentOriginalLesson();
  setStatus(
    course111SaveStatusMessage({
      persistedVia: result.persistedVia,
      lessonTitle: current?.block.title || result.lessonSlug,
      previewOpened: result.previewOpened,
    }),
  );
}

async function saveWholeCourse() {
  await saveCurrentLesson();
  setStatus("Saved Course 111 file. Draft/unpublished state preserved.");
}

function bindEvents() {
  dom.search?.addEventListener("input", () => {
    searchQuery = dom.search?.value ?? "";
    renderLessons();
  });

  dom.lessons?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest(
      "[data-parent-slug][data-block-slug]",
    ) as HTMLButtonElement | null;
    if (!button) return;
    const parentSlug = button.getAttribute("data-parent-slug");
    const blockSlug = button.getAttribute("data-block-slug");
    if (parentSlug && blockSlug) selectOriginalLesson(parentSlug, blockSlug);
  });

  dom.main?.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest(
      "[data-action]",
    ) as HTMLButtonElement | null;
    if (!target) return;
    const current = currentOriginalLesson();
    if (!current || !course) return;
    const { parent, block } = current;

    const action = target.getAttribute("data-action");

    if (action === "delete-component") {
      const slug = target.getAttribute("data-block-slug") || block.slug;
      const index = Number(target.getAttribute("data-component-index"));
      if (!Number.isFinite(index)) return;
      const views = listCourse111LessonComponents(block);
      const view = views[index];
      const confirmed = window.confirm(
        `Delete this ${view?.typeLabel || "component"} (id ${view?.legacyComponentId ?? index})? This is not written until you Save.`,
      );
      if (!confirmed) return;
      if (deleteCourse111Component(parent, slug, index)) {
        setDirty(true);
        renderAll();
      }
      return;
    }

    if (action === "delete-block") {
      if (target.disabled) return;
      const slug = target.getAttribute("data-block-slug") || block.slug;
      if (!summarizeCourse111Block(block).canDelete) {
        setStatus(
          "Use Delete component on each item instead. Whole-lesson delete stays off for unmapped types.",
          true,
        );
        return;
      }
      const confirmed = window.confirm(
        `Delete lesson “${block.title}” and all of its components? This is not written until you Save.`,
      );
      if (!confirmed) return;
      const originals = listCourse111OriginalLessons(course).filter(
        (lesson) =>
          !(
            lesson.parentSlug === selectedParentSlug &&
            lesson.blockSlug === slug
          ),
      );
      if (deleteCourse111Block(parent, slug)) {
        selectedBlockSlug = originals[0]?.blockSlug ?? null;
        if (originals[0] && originals[0].parentSlug !== selectedParentSlug) {
          selectedParentSlug = originals[0].parentSlug;
        }
        setDirty(true);
        renderAll();
      }
      return;
    }

    if (action === "add-component") {
      const select = document.getElementById(
        "course111-add-type",
      ) as HTMLSelectElement | null;
      const type = (select?.value || "richText") as Course111EditableType;
      const added = addCourse111ComponentToBlock(
        parent,
        block.slug,
        type,
        course.lessons,
      );
      if (added) {
        setDirty(true);
        renderAll();
      }
    }
  });

  dom.main?.addEventListener("input", (event) => {
    const current = currentOriginalLesson();
    if (!current) return;
    const { parent, block } = current;
    const target = event.target as HTMLElement;

    if (target.id === "course111-lesson-title" && target instanceof HTMLInputElement) {
      updateCourse111BlockTitle(block, target.value);
      setDirty(true);
      renderLessons();
      return;
    }

    const field = target.getAttribute("data-field");
    const wrap = target.closest(".course111-admin__component") as HTMLElement | null;
    if (!field || !wrap) return;

    const blockSlug = wrap.getAttribute("data-block-slug");
    const componentId = Number(wrap.getAttribute("data-component-id"));
    if (!blockSlug || !Number.isFinite(componentId)) return;

    const value =
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
        ? target.value
        : "";

    const patched = patchCourse111Component(parent, blockSlug, componentId, {
      [field]: value,
    });
    if (patched) setDirty(true);
  });

  dom.saveLesson?.addEventListener("click", () => {
    void saveCurrentLesson().catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : "Save failed.", true);
    });
  });

  dom.savePreview?.addEventListener("click", () => {
    void saveAndPreviewLesson().catch((error: unknown) => {
      setStatus(
        error instanceof Error ? error.message : "Save & Preview failed.",
        true,
      );
    });
  });

  dom.saveCourse?.addEventListener("click", () => {
    void saveWholeCourse().catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : "Save failed.", true);
    });
  });

  dom.reload?.addEventListener("click", () => {
    if (dirty) {
      const ok = window.confirm("Discard unsaved changes and reload from disk?");
      if (!ok) return;
    }
    void reloadFromDisk().catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : "Reload failed.", true);
    });
  });

  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

export async function initCourse111AdminEditor() {
  dom.app = document.getElementById("course111-admin-app");
  dom.loading = document.getElementById("course111-admin-loading");
  dom.status = document.getElementById("course111-admin-status");
  dom.dirty = document.getElementById("course111-admin-dirty");
  dom.courseTitle = document.getElementById("course111-admin-course-title");
  dom.search = document.getElementById(
    "course111-admin-search",
  ) as HTMLInputElement | null;
  dom.lessons = document.getElementById("course111-admin-lessons");
  dom.main = document.getElementById("course111-admin-main");
  dom.preview = document.getElementById(
    "course111-admin-preview",
  ) as HTMLAnchorElement | null;
  dom.saveLesson = document.getElementById(
    "course111-admin-save-lesson",
  ) as HTMLButtonElement | null;
  dom.savePreview = document.getElementById(
    "course111-admin-save-preview",
  ) as HTMLButtonElement | null;
  dom.saveCourse = document.getElementById(
    "course111-admin-save-course",
  ) as HTMLButtonElement | null;
  dom.reload = document.getElementById(
    "course111-admin-reload",
  ) as HTMLButtonElement | null;

  bindEvents();

  try {
    await loadCourse();
    if (dom.loading) dom.loading.hidden = true;
    if (dom.app) dom.app.hidden = false;
    setDirty(false);
    renderAll();
  } catch (error) {
    if (dom.loading) {
      dom.loading.textContent =
        error instanceof Error ? error.message : "Failed to load Course 111.";
    }
    setStatus(
      error instanceof Error ? error.message : "Failed to load Course 111.",
      true,
    );
  }
}
