import {
  addCourse111Block,
  cloneCourse111Data,
  COURSE_111_ID,
  deleteCourse111Block,
  filterCourse111Lessons,
  findCourse111Lesson,
  listCourse111LessonSummaries,
  moveCourse111Block,
  patchCourse111Component,
  readCourse111Publication,
  resolveCourse111SelectedLessonPreview,
  runCourse111SaveAndPreview,
  summarizeCourse111Block,
  updateCourse111LessonTitle,
  type Course111EditableType,
  type Course111PublicationSnapshot,
} from "../lib/legacy_kin/course111AdminModel";
import type {
  CourseBlock,
  CourseComponent,
  CourseLesson,
  CoursePreviewData,
} from "../lib/legacy_kin/coursePreviewPoc";
import { sortedBlocks, sortedComponents } from "../lib/legacy_kin/coursePreviewPoc";

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
let selectedLessonSlug: string | null = null;
let dirty = false;
let searchQuery = "";
let expandedBlockSlug: string | null = null;

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

function currentLesson(): CourseLesson | null {
  if (!course || !selectedLessonSlug) return null;
  return findCourse111Lesson(course, selectedLessonSlug) ?? null;
}

function updatePreviewLink() {
  if (!dom.preview || !course || !selectedLessonSlug) {
    if (dom.preview) {
      dom.preview.href = "#";
      dom.preview.setAttribute("aria-disabled", "true");
    }
    if (dom.savePreview) dom.savePreview.disabled = true;
    return;
  }

  const resolved = resolveCourse111SelectedLessonPreview(course, selectedLessonSlug);
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
  if (!selectedLessonSlug || !findCourse111Lesson(course, selectedLessonSlug)) {
    selectedLessonSlug = listCourse111LessonSummaries(course)[0]?.slug ?? null;
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
  const lessons = filterCourse111Lessons(
    listCourse111LessonSummaries(course),
    searchQuery,
  );
  if (lessons.length === 0) {
    dom.lessons.innerHTML = `<p class="course111-admin__hint">No lessons match.</p>`;
    return;
  }

  dom.lessons.innerHTML = lessons
    .map((lesson) => {
      const selected = lesson.slug === selectedLessonSlug ? " is-selected" : "";
      const unpublished = lesson.published ? "" : " is-unpublished";
      return `<button type="button" class="course111-admin__lesson${selected}" data-lesson-slug="${escapeHtml(lesson.slug)}">
        <span class="course111-admin__lesson-num">Lesson ${lesson.index + 1}</span>
        <span class="course111-admin__lesson-title">${escapeHtml(lesson.title)}</span>
        <span class="course111-admin__lesson-status${unpublished}">${escapeHtml(lesson.statusLabel)} · ${lesson.blockCount} blocks</span>
      </button>`;
    })
    .join("");
}

function componentEditorHtml(block: CourseBlock, component: CourseComponent): string {
  const id = component.legacyComponentId;
  const type = component.type;

  if (type === "richText") {
    return `<div class="course111-admin__component" data-block-slug="${escapeHtml(block.slug)}" data-component-id="${id}" data-component-type="richText">
      <div class="course111-admin__component-type">Rich text / HTML</div>
      <label class="course111-admin__label">HTML
        <textarea class="course111-admin__textarea" data-field="html">${escapeHtml(component.html ?? "")}</textarea>
      </label>
    </div>`;
  }

  if (type === "video") {
    return `<div class="course111-admin__component" data-block-slug="${escapeHtml(block.slug)}" data-component-id="${id}" data-component-type="video">
      <div class="course111-admin__component-type">Video (Vimeo)</div>
      <label class="course111-admin__label">Vimeo ID
        <input class="course111-admin__input" data-field="vimeoId" type="text" value="${escapeHtml(component.vimeoId ?? "")}">
      </label>
      <label class="course111-admin__label">Title (optional)
        <input class="course111-admin__input" data-field="title" type="text" value="${escapeHtml(component.title ?? "")}">
      </label>
    </div>`;
  }

  if (type === "image") {
    return `<div class="course111-admin__component" data-block-slug="${escapeHtml(block.slug)}" data-component-id="${id}" data-component-type="image">
      <div class="course111-admin__component-type">Image</div>
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
    return `<div class="course111-admin__component" data-block-slug="${escapeHtml(block.slug)}" data-component-id="${id}" data-component-type="download">
      <div class="course111-admin__component-type">Download / link</div>
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
  return `<div class="course111-admin__component" data-block-slug="${escapeHtml(block.slug)}" data-component-id="${id}" data-component-type="${escapeHtml(type)}">
    <div class="course111-admin__component-type">Preserved · ${escapeHtml(type)}</div>
    <p class="course111-admin__preserved">Protected until this type has a dedicated editor. You can Move Up / Move Down the whole block; Delete is disabled so the saved data stays intact.
      <br><code>${preview}</code>
    </p>
  </div>`;
}

function renderMain() {
  if (!dom.main || !course) return;
  const lesson = currentLesson();
  if (!lesson) {
    dom.main.innerHTML = `<p class="course111-admin__empty">Select a lesson to edit.</p>`;
    return;
  }

  const blocks = sortedBlocks(lesson);
  const blockCards = blocks
    .map((block, index) => {
      const summary = summarizeCourse111Block(block);
      const open = expandedBlockSlug === block.slug;
      const components = sortedComponents(block)
        .map((component) => componentEditorHtml(block, component))
        .join("");
      const deleteControl = summary.canDelete
        ? `<button type="button" class="course111-admin__btn course111-admin__btn--danger" data-action="delete-block" data-block-slug="${escapeHtml(block.slug)}">Delete</button>`
        : `<button type="button" class="course111-admin__btn course111-admin__btn--danger" data-action="delete-block" data-block-slug="${escapeHtml(block.slug)}" disabled title="Protected until this type has a dedicated editor">Delete</button>`;
      return `<article class="course111-admin__block" data-block-slug="${escapeHtml(block.slug)}">
        <header class="course111-admin__block-head">
          <div class="course111-admin__block-meta">
            <h3 class="course111-admin__block-title">${escapeHtml(summary.title)}</h3>
            <div class="course111-admin__block-types">${escapeHtml(summary.types.join(" + ") || "empty")} · ${escapeHtml(block.slug)}${summary.canDelete ? "" : " · protected"}</div>
          </div>
          <div class="course111-admin__block-actions">
            <button type="button" class="course111-admin__btn" data-action="toggle-edit" data-block-slug="${escapeHtml(block.slug)}">${open ? "Close" : "Edit"}</button>
            <button type="button" class="course111-admin__btn" data-action="move-up" data-block-index="${index}" ${index === 0 ? "disabled" : ""}>Move Up</button>
            <button type="button" class="course111-admin__btn" data-action="move-down" data-block-index="${index}" ${index === blocks.length - 1 ? "disabled" : ""}>Move Down</button>
            ${deleteControl}
          </div>
        </header>
        ${open ? `<div class="course111-admin__block-body">${components || `<p class="course111-admin__hint">No components in this block.</p>`}${summary.canDelete ? "" : `<p class="course111-admin__hint">Protected block: Move Up / Move Down are available. Delete stays off until these components have a dedicated editor.</p>`}</div>` : ""}
      </article>`;
    })
    .join("");

  dom.main.innerHTML = `
    <div class="course111-admin__lesson-header">
      <label class="course111-admin__label">Lesson title
        <input id="course111-lesson-title" class="course111-admin__input" type="text" value="${escapeHtml(lesson.title)}">
      </label>
      <p class="course111-admin__hint">Slug <code>${escapeHtml(lesson.slug)}</code> is preserved. Lesson published flag: <strong>${lesson.published === false ? "unpublished" : "visible"}</strong> (not changed by this editor).</p>
    </div>
    <div class="course111-admin__add-row">
      <label class="course111-admin__label">Add block
        <select id="course111-add-type" class="course111-admin__select">
          <option value="richText">Rich text / HTML</option>
          <option value="video">Video (Vimeo)</option>
          <option value="image">Image</option>
          <option value="download">Download / link</option>
        </select>
      </label>
      <button type="button" class="course111-admin__btn course111-admin__btn--primary" data-action="add-block">Add block</button>
    </div>
    <div class="course111-admin__blocks">${blockCards || `<p class="course111-admin__empty">No blocks yet — add one above.</p>`}</div>
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

function selectLesson(slug: string) {
  if (dirty && slug !== selectedLessonSlug) {
    const ok = window.confirm(
      "You have unsaved changes. Switch lessons and discard them?",
    );
    if (!ok) return;
    void reloadFromDisk().then(() => {
      selectedLessonSlug = slug;
      expandedBlockSlug = null;
      renderAll();
    });
    return;
  }
  selectedLessonSlug = slug;
  expandedBlockSlug = null;
  renderAll();
}

async function reloadFromDisk() {
  await loadCourse();
  renderAll();
}

async function saveCurrentLesson(lessonSlug = selectedLessonSlug) {
  if (!course || !lessonSlug) return;
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
  const payload = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Save lesson failed.");
  }
  setDirty(false);
  setStatus(`Saved lesson “${lesson.title}”. Course remains draft/unpublished.`);
}

async function saveAndPreviewLesson() {
  if (!course || !selectedLessonSlug) {
    throw new Error("Select a lesson before Save & Preview.");
  }

  const result = await runCourse111SaveAndPreview({
    data: course,
    selectedLessonSlug,
    saveLesson: (lessonSlug) => saveCurrentLesson(lessonSlug),
    openPreview: (href) => {
      window.open(href, "_blank", "noopener,noreferrer");
    },
  });

  updatePreviewLink();
  setStatus(
    `Saved “${result.lessonSlug}” and opened learner preview. Course remains draft/unpublished.`,
  );
}

async function saveWholeCourse() {
  // Persist the currently edited lesson (only dirty surface in this MVP).
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
      "[data-lesson-slug]",
    ) as HTMLButtonElement | null;
    if (!button) return;
    const slug = button.getAttribute("data-lesson-slug");
    if (slug) selectLesson(slug);
  });

  dom.main?.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest(
      "[data-action]",
    ) as HTMLButtonElement | null;
    if (!target) return;
    const lesson = currentLesson();
    if (!lesson || !course) return;

    const action = target.getAttribute("data-action");
    if (action === "toggle-edit") {
      const slug = target.getAttribute("data-block-slug");
      expandedBlockSlug = expandedBlockSlug === slug ? null : slug;
      renderMain();
      return;
    }

    if (action === "move-up" || action === "move-down") {
      const index = Number(target.getAttribute("data-block-index"));
      if (!Number.isFinite(index)) return;
      const moved = moveCourse111Block(
        lesson,
        index,
        action === "move-up" ? -1 : 1,
      );
      if (moved) {
        setDirty(true);
        renderAll();
      }
      return;
    }

    if (action === "delete-block") {
      if (target.disabled) return;
      const slug = target.getAttribute("data-block-slug");
      if (!slug) return;
      const block = lesson.blocks.find((entry) => entry.slug === slug);
      if (block && !summarizeCourse111Block(block).canDelete) {
        setStatus(
          "Protected block — Delete is disabled until these components have a dedicated editor.",
          true,
        );
        return;
      }
      const confirmed = window.confirm(
        `Delete block “${slug}” and all of its components? This is not written until you Save.`,
      );
      if (!confirmed) return;
      if (deleteCourse111Block(lesson, slug)) {
        if (expandedBlockSlug === slug) expandedBlockSlug = null;
        setDirty(true);
        renderAll();
      }
      return;
    }

    if (action === "add-block") {
      const select = document.getElementById(
        "course111-add-type",
      ) as HTMLSelectElement | null;
      const type = (select?.value || "richText") as Course111EditableType;
      const block = addCourse111Block(lesson, type, course.lessons);
      expandedBlockSlug = block.slug;
      setDirty(true);
      renderAll();
    }
  });

  dom.main?.addEventListener("input", (event) => {
    const lesson = currentLesson();
    if (!lesson) return;
    const target = event.target as HTMLElement;

    if (target.id === "course111-lesson-title" && target instanceof HTMLInputElement) {
      updateCourse111LessonTitle(lesson, target.value);
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

    const patched = patchCourse111Component(lesson, blockSlug, componentId, {
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
