import {
  EDITOR_TYPE_META,
  TEXT_IMAGE_LAYOUT_TYPE,
  TEXT_VIDEO_LAYOUT_TYPE,
  THREE_VIDEOS_LAYOUT_TYPE,
  type ComponentRef,
  type EditorContentKind,
  type FlatContentItem,
} from "../lib/legacy_kin/courseContentEditorTypes";
import {
  accordionLayoutSummary,
  ACCORDION_INTRO_ROLE,
  getAccordionLayoutParts,
  isAccordionLayoutBlock,
  richTextHasVisibleContent,
} from "../lib/legacy_kin/courseAccordionLayout";
import {
  embeddedToolLayoutSummary,
  EMBEDDED_TOOL_INTRO_ROLE,
  getEmbeddedToolLayoutParts,
  isEmbeddedToolLayoutBlock,
} from "../lib/legacy_kin/courseEmbeddedToolLayout";
import {
  getTextVideoLayoutParts,
  isTextVideoLayoutBlock,
  textVideoLayoutSummary,
  TEXT_VIDEO_BOTTOM_ROLE,
  TEXT_VIDEO_LEFT_ROLE,
  unwrapTextVideoColumnHtml,
} from "../lib/legacy_kin/courseTextVideoLayout";
import {
  getImagePosition,
  getLayoutHeader,
  getTextImageLayoutParts,
  imageCaptionHasContent,
  isTextImageLayoutBlock,
  layoutHeaderHasContent,
  normalizeImageLinkUrl,
  textImageLayoutSummary,
  TEXT_IMAGE_IMAGE_ROLE,
  TEXT_IMAGE_TEXT_ROLE,
} from "../lib/legacy_kin/courseTextImageLayout";
import {
  DEFAULT_THREE_VIDEOS_CAPTION_HTML,
  DEFAULT_THREE_VIDEOS_INTRO_HTML,
  DEFAULT_THREE_VIDEOS_OUTRO_HTML,
  getThreeVideosLayoutParts,
  isThreeVideosLayoutBlock,
  threeVideosCaptionRole,
  THREE_VIDEOS_EDITOR_LAYOUT,
  THREE_VIDEOS_INTRO_ROLE,
  THREE_VIDEOS_OUTRO_ROLE,
  threeVideosLayoutSummary,
  threeVideosVideoRole,
} from "../lib/legacy_kin/courseThreeVideosLayout";
import { courseImageLinkAttrs } from "../lib/legacy_kin/courseImageLink";
import {
  availableEmbeddedToolsForContext,
  getEmbeddedToolByKey,
} from "../lib/tools/embeddedToolRegistry";

import {
  initCourseHtmlSnippetsPanel,
  refreshSnippetInsertButtons,
  setCourseHtmlSnippetsToast,
} from "./courseHtmlSnippetsPanel";
import { legacyAssetUrl, rewriteLegacyHtml } from "../lib/legacy_kin/legacyCourseAssetUrls";
import {
  buildEditorSearchParams,
  lessonDisplayTitle,
  lessonIndexFromSlug,
  lessonTitleForEditing,
  normalizeLessonTitleInput,
  parseEditorNavigationState,
  resolveInitialLessonSlug,
} from "../lib/legacy_kin/courseContentEditorNavigation";
import {
  appendComponentToBlock,
  appendStandaloneComponentBlock,
  findBlockContainingComponent,
  insertStandaloneComponentBlockRelative,
  isEditorLayoutBlock,
  moveBlockRelativeToTarget as moveBlockRelativeToTargetInLesson,
  movePlainContentComponent,
  moveSectionAtIndex,
  splitBlockIntoStandaloneSections,
} from "../lib/legacy_kin/courseContentEditorBlocks";
import { getCatalogOverlayDescription } from "../lib/coursesCatalogOverlay";
import {
  combineTextVideoWithNextPlainText,
  getNextPlainTextItem as getNextPlainTextItemInLesson,
} from "../lib/legacy_kin/courseTextVideoCombine";
import {
  NEW_SECTION_ADD_KINDS,
  SECTION_BLOCK_ADD_KINDS,
  blockTitleForEditing,
  buildContentListGroups,
  countLessonSectionsAndBlocks,
  formatLessonSidebarMeta,
  formatSectionBlockCount,
  sectionNavLabel,
} from "../lib/legacy_kin/courseContentEditorView";
import type { CourseLesson } from "../lib/legacy_kin/coursePreviewPoc";

const API_URL = "/api/admin/course-content";
const SNIPPETS_OPEN_KEY = "course-editor-snippets-open";
const SELECTED_LESSON_KEY = "course-editor-selected-lesson";
const SELECTED_COURSE_KEY = "course-editor-selected-course";
const COURSE_THUMBNAIL_PREFIX = "/images/courses/";

type LessonRecord = Record<string, unknown>;
type CourseRecord = { course?: Record<string, unknown>; lessons?: LessonRecord[] };

type CourseCatalogEntry = {
  id: number;
  title: string;
  filename: string;
  slug?: string;
  lessonCount?: number;
  isDraft?: boolean;
  isActive?: boolean;
  status?: string;
  published?: boolean;
  contentStatus?: "in_progress" | "cleaned";
};

let courseCatalog: CourseCatalogEntry[] = [];
let currentCourseId: number | null = null;
let savedCourseThumbnail: string | null = null;
let savedCustomCatalogDescription = "";
let fallbackCatalogDescription = "";
let savedCourseActive = true;
let savedCoursePublished = true;
let savedCourseContentStatus: "in_progress" | "cleaned" = "in_progress";
let courseData: CourseRecord | null = null;
let selectedLessonSlug: string | null = null;
let contentEditingRef: ComponentRef | null = null;
let renamingLessonSlug: string | null = null;
let advancedOpen = false;
let focusLessonTitlePending = false;
let expandedSectionSlug: string | null = null;
/** After first expand for a lesson, allow all sections to stay collapsed. */
let outlineExpandInitialized = false;

function resetOutlineExpandState() {
  expandedSectionSlug = null;
  outlineExpandInitialized = false;
}

const lessonDrafts = new Map<string, LessonRecord>();
const lessonSavedJson = new Map<string, string>();

const dragState = { kind: null as "item" | "lesson" | null, index: null as number | null };

const dom = {
  loading: null as HTMLElement | null,
  app: null as HTMLElement | null,
  status: null as HTMLElement | null,
  toast: null as HTMLElement | null,
  saveHint: null as HTMLElement | null,
  courseSelect: null as HTMLSelectElement | null,
  courseTitle: null as HTMLInputElement | null,
  courseCatalogDescription: null as HTMLTextAreaElement | null,
  catalogDescriptionSource: null as HTMLElement | null,
  catalogDescriptionClearBtn: null as HTMLButtonElement | null,
  courseThumbnail: null as HTMLInputElement | null,
  courseContentStatus: null as HTMLSelectElement | null,
  coursePublished: null as HTMLSelectElement | null,
  courseActive: null as HTMLSelectElement | null,
  courseStatusSaveBtn: null as HTMLButtonElement | null,
  courseThumbnailPreviewWrap: null as HTMLElement | null,
  courseThumbnailPreview: null as HTMLImageElement | null,
  courseThumbnailPreviewEmpty: null as HTMLElement | null,
  courseSettingsSaveBtn: null as HTMLButtonElement | null,
  courseSettingsPanel: null as HTMLDetailsElement | null,
  previewLink: null as HTMLAnchorElement | null,
  lessonList: null as HTMLElement | null,
  addLessonBtn: null as HTMLButtonElement | null,
  deleteLessonBtn: null as HTMLButtonElement | null,
  lessonTitleInput: null as HTMLInputElement | null,
  addSectionMenu: null as HTMLDetailsElement | null,
  addSectionTypes: null as HTMLElement | null,
  itemsList: null as HTMLElement | null,
  itemsEmpty: null as HTMLElement | null,
  editEmpty: null as HTMLElement | null,
  editForm: null as HTMLElement | null,
  editHead: null as HTMLElement | null,
  editFields: null as HTMLElement | null,
  saveBtn: null as HTMLButtonElement | null,
  revertBtn: null as HTMLButtonElement | null,
  reloadBtn: null as HTMLButtonElement | null,
  advancedToggle: null as HTMLButtonElement | null,
  advancedPanel: null as HTMLElement | null,
  rawLesson: null as HTMLTextAreaElement | null,
  rawError: null as HTMLElement | null,
  advancedSaveBtn: null as HTMLButtonElement | null,
  snippetsPanel: null as HTMLDetailsElement | null,
  centerPanel: null as HTMLElement | null,
};

function readCoursePublished(course: Record<string, unknown> | undefined): boolean {
  if (!course) return true;
  if (course.status === "draft") return false;
  if (course.published === false) return false;
  if (course.status === "published") return true;
  if (course.published === true) return true;
  return true;
}

function formatCourseCatalogLabel(entry: CourseCatalogEntry): string {
  const label = entry.title?.trim() || entry.filename || `Course ${entry.id}`;
  const draftSuffix = entry.isDraft ? " · draft" : "";
  const inactiveSuffix = entry.isActive === false ? " · inactive" : "";
  const cleanedSuffix = entry.contentStatus === "cleaned" ? " · cleaned" : "";
  return `${label} (${entry.id})${draftSuffix}${inactiveSuffix}${cleanedSuffix}`;
}

function updateCoursePreviewLink(course: Record<string, unknown> | undefined, lessonSlug?: string | null) {
  if (!dom.previewLink || currentCourseId == null) return;
  const slug = String(course?.slug ?? "").trim();
  if (slug) {
    const base = `/courses/legacy/${encodeURIComponent(slug)}?preview=true`;
    dom.previewLink.href = lessonSlug ? `${base.replace("?preview=true", "")}/${encodeURIComponent(lessonSlug)}?preview=true` : base;
    return;
  }
  dom.previewLink.href = lessonSlug
    ? `/dev/course-preview/${currentCourseId}/${lessonSlug}`
    : `/dev/course-preview/${currentCourseId}`;
}

function updateCourseStatusSelectStyles() {
  if (dom.coursePublished) {
    dom.coursePublished.classList.toggle(
      "course-editor__status-select--draft",
      dom.coursePublished.value !== "true",
    );
  }
  if (dom.courseActive) {
    dom.courseActive.classList.toggle(
      "course-editor__status-select--inactive",
      dom.courseActive.value !== "true",
    );
  }
}

function updateCourseContentStatusSelectStyles() {
  if (!dom.courseContentStatus) return;
  dom.courseContentStatus.classList.toggle(
    "course-editor__status-select--cleaned",
    dom.courseContentStatus.value === "cleaned",
  );
  dom.courseContentStatus.classList.toggle(
    "course-editor__status-select--in-progress",
    dom.courseContentStatus.value !== "cleaned",
  );
}

function refreshCourseCatalogEntry(course: Record<string, unknown> | undefined) {
  if (currentCourseId == null || !course) return;
  const entry = courseCatalog.find((item) => item.id === currentCourseId);
  if (!entry) return;
  entry.title = String(course.title ?? entry.title);
  entry.status = typeof course.status === "string" ? course.status : entry.status;
  entry.published = readCoursePublished(course);
  entry.isDraft = !entry.published;
  entry.isActive = readCourseActive(course);
  entry.contentStatus = readCourseContentStatus(course);
  entry.active = entry.isActive ? undefined : false;
  if (dom.courseSelect) {
    const option = dom.courseSelect.querySelector(
      `option[value="${currentCourseId}"]`,
    ) as HTMLOptionElement | null;
    if (option) option.textContent = formatCourseCatalogLabel(entry);
  }
}

function readCourseActive(course: Record<string, unknown> | undefined): boolean {
  if (!course) return true;
  return course.active !== false;
}

function readCustomCatalogDescription(course: Record<string, unknown> | undefined): string {
  const value =
    course && "description" in course && typeof course.description === "string"
      ? course.description
      : "";
  return value.trim();
}

function readCourseSlug(course: Record<string, unknown> | undefined): string {
  return course && typeof course.slug === "string" ? course.slug.trim() : "";
}

function resolvedCatalogDescriptionDisplay(custom: string, fallback: string): string {
  return custom || fallback;
}

function updateCatalogDescriptionSourceUi() {
  const input = dom.courseCatalogDescription?.value.trim() ?? "";
  const hasSavedCustom = Boolean(savedCustomCatalogDescription);
  const matchesSavedCustom = hasSavedCustom && input === savedCustomCatalogDescription;
  const matchesFallback = Boolean(fallbackCatalogDescription) && input === fallbackCatalogDescription;
  const isEmpty = input.length === 0;

  if (dom.catalogDescriptionSource) {
    dom.catalogDescriptionSource.classList.remove(
      "course-editor__catalog-description-source--custom",
      "course-editor__catalog-description-source--fallback",
      "course-editor__catalog-description-source--none",
      "course-editor__catalog-description-source--pending",
    );

    if (isCourseCatalogDescriptionDirty()) {
      dom.catalogDescriptionSource.textContent =
        hasSavedCustom && (matchesFallback || isEmpty)
          ? "Will revert to catalog fallback when you save."
          : "Unsaved catalog description changes.";
      dom.catalogDescriptionSource.classList.add(
        "course-editor__catalog-description-source--pending",
      );
    } else if (hasSavedCustom && matchesSavedCustom) {
      dom.catalogDescriptionSource.textContent =
        "Custom override saved in course JSON.";
      dom.catalogDescriptionSource.classList.add(
        "course-editor__catalog-description-source--custom",
      );
    } else if (matchesFallback) {
      dom.catalogDescriptionSource.textContent =
        "Using catalog fallback from courses-catalog.json.";
      dom.catalogDescriptionSource.classList.add(
        "course-editor__catalog-description-source--fallback",
      );
    } else if (isEmpty && !fallbackCatalogDescription) {
      dom.catalogDescriptionSource.textContent = "No catalog description configured.";
      dom.catalogDescriptionSource.classList.add(
        "course-editor__catalog-description-source--none",
      );
    } else {
      dom.catalogDescriptionSource.textContent =
        "Using catalog fallback from courses-catalog.json.";
      dom.catalogDescriptionSource.classList.add(
        "course-editor__catalog-description-source--fallback",
      );
    }
  }

  if (dom.catalogDescriptionClearBtn) {
    dom.catalogDescriptionClearBtn.disabled =
      !savedCustomCatalogDescription && !isCourseCatalogDescriptionDirty();
  }
}

function clearCustomCatalogDescription() {
  if (dom.courseCatalogDescription) {
    dom.courseCatalogDescription.value = fallbackCatalogDescription;
  }
  updateCatalogDescriptionSourceUi();
  updateCourseSettingsSaveState();
}

function readCourseThumbnail(course: Record<string, unknown> | undefined): string {
  const value =
    course && "thumbnail" in course && typeof course.thumbnail === "string"
      ? course.thumbnail
      : "";
  return value.trim();
}

function thumbnailInputValueFromPath(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith(COURSE_THUMBNAIL_PREFIX)) {
    return path.slice(COURSE_THUMBNAIL_PREFIX.length);
  }
  return path;
}

function thumbnailPathFromInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return trimmed;
  return `${COURSE_THUMBNAIL_PREFIX}${trimmed.replace(/^\/+/, "")}`;
}

function readThumbnailInputPath(): string | null {
  return thumbnailPathFromInput(dom.courseThumbnail?.value ?? "");
}

function readCourseContentStatus(course: Record<string, unknown> | undefined): "in_progress" | "cleaned" {
  return course?.contentStatus === "cleaned" ? "cleaned" : "in_progress";
}

function syncCourseSettingsFields(course: Record<string, unknown> | undefined) {
  savedCourseThumbnail = readCourseThumbnail(course) || null;
  savedCustomCatalogDescription = readCustomCatalogDescription(course);
  const slug = readCourseSlug(course);
  fallbackCatalogDescription = slug ? (getCatalogOverlayDescription(slug) ?? "") : "";
  savedCourseActive = readCourseActive(course);
  savedCoursePublished = readCoursePublished(course);
  savedCourseContentStatus = readCourseContentStatus(course);
  if (dom.courseCatalogDescription) {
    dom.courseCatalogDescription.value = resolvedCatalogDescriptionDisplay(
      savedCustomCatalogDescription,
      fallbackCatalogDescription,
    );
  }
  if (dom.courseThumbnail) {
    dom.courseThumbnail.value = thumbnailInputValueFromPath(savedCourseThumbnail);
  }
  if (dom.courseActive) {
    dom.courseActive.value = savedCourseActive ? "true" : "false";
  }
  if (dom.coursePublished) {
    dom.coursePublished.value = savedCoursePublished ? "true" : "false";
  }
  if (dom.courseContentStatus) {
    dom.courseContentStatus.value = savedCourseContentStatus;
  }
  updateCourseThumbnailPreview();
  updateCourseStatusSelectStyles();
  updateCourseContentStatusSelectStyles();
  updateCatalogDescriptionSourceUi();
  updateCourseSettingsSaveState();
}

function updateCourseThumbnailPreview() {
  const previewPath = readThumbnailInputPath();
  const previewSrc = previewPath ? legacyAssetUrl(previewPath) : "";

  if (dom.courseThumbnailPreview && dom.courseThumbnailPreviewWrap) {
    if (previewSrc) {
      dom.courseThumbnailPreview.src = previewSrc;
      dom.courseThumbnailPreviewWrap.hidden = false;
      if (dom.courseThumbnailPreviewEmpty) dom.courseThumbnailPreviewEmpty.hidden = true;
    } else {
      dom.courseThumbnailPreview.removeAttribute("src");
      dom.courseThumbnailPreviewWrap.hidden = true;
      if (dom.courseThumbnailPreviewEmpty) dom.courseThumbnailPreviewEmpty.hidden = false;
    }
  } else if (dom.courseThumbnailPreviewEmpty) {
    dom.courseThumbnailPreviewEmpty.hidden = Boolean(previewSrc);
  }
}

function isCourseThumbnailDirty(): boolean {
  const current = readThumbnailInputPath() ?? "";
  const saved = savedCourseThumbnail ?? "";
  return current !== saved;
}

function isCourseCatalogDescriptionDirty(): boolean {
  const input = dom.courseCatalogDescription?.value.trim() ?? "";
  if (savedCustomCatalogDescription) {
    return input !== savedCustomCatalogDescription;
  }
  return input !== fallbackCatalogDescription;
}

function catalogDescriptionPayloadIfDirty(): string | null | undefined {
  if (!isCourseCatalogDescriptionDirty()) return undefined;
  const input = dom.courseCatalogDescription?.value.trim() ?? "";
  if (input === "" || input === fallbackCatalogDescription) {
    return null;
  }
  return input;
}

function isCourseActiveDirty(): boolean {
  const current = dom.courseActive?.value === "true";
  return current !== savedCourseActive;
}

function isCoursePublishedDirty(): boolean {
  const current = dom.coursePublished?.value === "true";
  return current !== savedCoursePublished;
}

function isCourseContentStatusDirty(): boolean {
  const current = dom.courseContentStatus?.value === "cleaned" ? "cleaned" : "in_progress";
  return current !== savedCourseContentStatus;
}

function isCourseVisibilityDirty(): boolean {
  return isCourseActiveDirty() || isCoursePublishedDirty();
}

/** Publication, catalog, and editorial content status (sidebar controls). */
function isCourseSidebarMetadataDirty(): boolean {
  return isCourseVisibilityDirty() || isCourseContentStatusDirty();
}

function isCourseSettingsDirty(): boolean {
  return (
    isCourseThumbnailDirty() ||
    isCourseCatalogDescriptionDirty() ||
    isCourseSidebarMetadataDirty()
  );
}

function buildCourseMetadataPayload(): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (isCourseThumbnailDirty()) {
    payload.thumbnail = readThumbnailInputPath();
  }
  if (isCourseCatalogDescriptionDirty()) {
    payload.description = catalogDescriptionPayloadIfDirty();
  }
  if (isCourseActiveDirty()) {
    payload.active = dom.courseActive?.value === "true";
  }
  if (isCoursePublishedDirty()) {
    payload.published = dom.coursePublished?.value === "true";
  }
  if (isCourseContentStatusDirty()) {
    payload.contentStatus =
      dom.courseContentStatus?.value === "cleaned" ? "cleaned" : "in_progress";
  }
  return payload;
}

function shouldCourseSettingsPanelOpen(
  course: Record<string, unknown> | undefined,
): boolean {
  if (isCourseSettingsDirty()) return true;
  const thumbnail =
    course && "thumbnail" in course && typeof course.thumbnail === "string"
      ? course.thumbnail.trim()
      : "";
  return !thumbnail;
}

function updateCourseSettingsPanelOpen() {
  if (!dom.courseSettingsPanel) return;
  dom.courseSettingsPanel.open = shouldCourseSettingsPanelOpen(courseData?.course);
}

function updateCourseSettingsSaveState() {
  const settingsDirty = isCourseSettingsDirty();
  const sidebarDirty = isCourseSidebarMetadataDirty();
  if (dom.courseSettingsSaveBtn) {
    dom.courseSettingsSaveBtn.disabled = !settingsDirty || currentCourseId == null;
  }
  if (dom.courseStatusSaveBtn) {
    dom.courseStatusSaveBtn.disabled = !sidebarDirty || currentCourseId == null;
  }
  updateCourseSettingsPanelOpen();
}

async function saveCourseMetadataFromSidebar(statusMessage: string, successToast: string) {
  if (currentCourseId == null) return;
  const payload = buildCourseMetadataPayload();
  if (Object.keys(payload).length === 0) return;

  setStatus(statusMessage);

  try {
    const result = await postCourseAction("saveCourseMetadata", payload);
    if (result.course) {
      courseData = result.course;
      syncCourseSettingsFields(courseData.course);
      refreshCourseCatalogEntry(courseData.course);
    }
    setStatus("");
    flashToast(successToast);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Could not save course settings.", "is-error");
  }
}

async function saveCourseSettings() {
  if (currentCourseId == null) return;
  if (!isCourseSettingsDirty()) return;
  await saveCourseMetadataFromSidebar("Saving course settings…", "Course settings saved");
}

async function saveCourseVisibilitySettings() {
  if (currentCourseId == null) return;
  if (!isCourseSidebarMetadataDirty()) return;
  await saveCourseMetadataFromSidebar(
    "Saving visibility settings…",
    "Visibility settings saved",
  );
}

function bindDom() {
  dom.loading = document.getElementById("course-editor-loading");
  dom.app = document.getElementById("course-editor-app");
  dom.status = document.getElementById("course-editor-status");
  dom.toast = document.getElementById("course-editor-toast");
  dom.saveHint = document.getElementById("course-editor-save-hint");
  dom.courseSelect = document.getElementById("course-editor-course") as HTMLSelectElement | null;
  dom.courseTitle = document.getElementById("course-editor-course-title") as HTMLInputElement | null;
  dom.courseCatalogDescription = document.getElementById(
    "course-editor-catalog-description",
  ) as HTMLTextAreaElement | null;
  dom.catalogDescriptionSource = document.getElementById(
    "course-editor-catalog-description-source",
  );
  dom.catalogDescriptionClearBtn = document.getElementById(
    "course-editor-catalog-description-clear",
  ) as HTMLButtonElement | null;
  dom.courseThumbnail = document.getElementById("course-editor-thumbnail") as HTMLInputElement | null;
  dom.courseContentStatus = document.getElementById(
    "course-editor-content-status",
  ) as HTMLSelectElement | null;
  dom.coursePublished = document.getElementById("course-editor-published") as HTMLSelectElement | null;
  dom.courseActive = document.getElementById("course-editor-active") as HTMLSelectElement | null;
  dom.courseStatusSaveBtn = document.getElementById("course-editor-status-save") as HTMLButtonElement | null;
  dom.courseThumbnailPreviewWrap = document.getElementById("course-editor-thumbnail-preview-wrap");
  dom.courseThumbnailPreview = document.getElementById("course-editor-thumbnail-preview") as HTMLImageElement | null;
  dom.courseThumbnailPreviewEmpty = document.getElementById("course-editor-thumbnail-preview-empty");
  dom.courseSettingsSaveBtn = document.getElementById("course-editor-settings-save") as HTMLButtonElement | null;
  dom.courseSettingsPanel = document.getElementById("course-editor-settings-panel") as HTMLDetailsElement | null;
  dom.previewLink = document.getElementById("course-editor-preview-link") as HTMLAnchorElement | null;
  dom.lessonList = document.getElementById("course-editor-lessons");
  dom.addLessonBtn = document.getElementById("course-editor-add-lesson") as HTMLButtonElement | null;
  dom.deleteLessonBtn = document.getElementById("course-editor-delete-lesson") as HTMLButtonElement | null;
  dom.lessonTitleInput = document.getElementById("course-editor-lesson-title") as HTMLInputElement | null;
  dom.addSectionMenu = document.getElementById("course-editor-add-section-menu") as HTMLDetailsElement | null;
  dom.addSectionTypes = document.getElementById("course-editor-add-section-types");
  dom.itemsList = document.getElementById("course-editor-items");
  dom.itemsEmpty = document.getElementById("course-editor-items-empty");
  dom.editEmpty = document.getElementById("course-editor-edit-empty");
  dom.editForm = document.getElementById("course-editor-edit-form");
  dom.editHead = document.getElementById("course-editor-edit-head");
  dom.editFields = document.getElementById("course-editor-edit-fields");
  dom.saveBtn = document.getElementById("course-editor-save") as HTMLButtonElement | null;
  dom.revertBtn = document.getElementById("course-editor-revert") as HTMLButtonElement | null;
  dom.reloadBtn = document.getElementById("course-editor-reload") as HTMLButtonElement | null;
  dom.advancedToggle = document.getElementById("course-editor-advanced-toggle") as HTMLButtonElement | null;
  dom.advancedPanel = document.getElementById("course-editor-advanced");
  dom.rawLesson = document.getElementById("course-editor-raw-lesson") as HTMLTextAreaElement | null;
  dom.rawError = document.getElementById("course-editor-raw-error");
  dom.advancedSaveBtn = document.getElementById("course-editor-advanced-save") as HTMLButtonElement | null;
  dom.snippetsPanel = document.getElementById("course-editor-snippets") as HTMLDetailsElement | null;
  dom.centerPanel = document.querySelector(".course-editor__center");
}

type ScrollSnapshot = {
  center: number;
  lessons: number;
  windowY: number;
};

function captureScrollSnapshot(): ScrollSnapshot {
  return {
    center: dom.centerPanel?.scrollTop ?? 0,
    lessons: dom.lessonList?.scrollTop ?? 0,
    windowY: window.scrollY,
  };
}

function restoreScrollSnapshot(snapshot: ScrollSnapshot) {
  if (dom.centerPanel) dom.centerPanel.scrollTop = snapshot.center;
  if (dom.lessonList) dom.lessonList.scrollTop = snapshot.lessons;
  window.scrollTo(0, snapshot.windowY);
}

function captureSnippetsOpen() {
  if (dom.snippetsPanel?.open) {
    sessionStorage.setItem(SNIPPETS_OPEN_KEY, "1");
  } else {
    sessionStorage.removeItem(SNIPPETS_OPEN_KEY);
  }
}

function restoreSnippetsOpen() {
  if (!dom.snippetsPanel) return;
  dom.snippetsPanel.open = sessionStorage.getItem(SNIPPETS_OPEN_KEY) === "1";
}

function persistSelectedLesson(courseId: number, slug: string) {
  try {
    localStorage.setItem(
      SELECTED_LESSON_KEY,
      JSON.stringify({ courseId, slug }),
    );
  } catch {
    /* ignore storage failures */
  }
}

function readPersistedLessonSlug(courseId: number): string | null {
  try {
    const raw = localStorage.getItem(SELECTED_LESSON_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { courseId?: number; slug?: string };
    if (parsed.courseId === courseId && parsed.slug?.trim()) {
      return parsed.slug.trim();
    }
  } catch {
    /* ignore storage failures */
  }
  return null;
}

function persistSelectedCourse(courseId: number) {
  try {
    localStorage.setItem(SELECTED_COURSE_KEY, String(courseId));
  } catch {
    /* ignore storage failures */
  }
}

function readPersistedCourseId(allowedCourseIds: number[]): number | null {
  try {
    const raw = localStorage.getItem(SELECTED_COURSE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    if (Number.isFinite(parsed) && allowedCourseIds.includes(parsed)) {
      return parsed;
    }
  } catch {
    /* ignore storage failures */
  }
  return null;
}


type CourseActionPayload = {
  ok?: boolean;
  error?: string;
  course?: CourseRecord;
  lesson?: LessonRecord;
  lessonSlug?: string;
  backupPath?: string;
};

function allLessonsForIdScope(): LessonRecord[] {
  const out: LessonRecord[] = [];
  if (courseData?.lessons) out.push(...(courseData.lessons as LessonRecord[]));
  for (const draft of lessonDrafts.values()) out.push(draft);
  return out;
}

async function postCourseAction(
  action: string,
  body: Record<string, unknown>,
): Promise<CourseActionPayload> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, courseId: currentCourseId, ...body }),
  });
  const payload = (await res.json()) as CourseActionPayload;
  if (!res.ok || !payload.ok) {
    throw new Error(payload.error || "Course action failed.");
  }
  return payload;
}

function applyCourseFromServer(
  course: CourseRecord,
  options: {
    selectSlug?: string | null;
    preserveScroll?: boolean;
    openRenameForSlug?: string | null;
  } = {},
) {
  const scrollSnapshot = options.preserveScroll ? captureScrollSnapshot() : null;
  const dirtyDrafts = new Map<string, LessonRecord>();
  for (const [slug, draft] of lessonDrafts.entries()) {
    if (isLessonDirty(slug)) {
      dirtyDrafts.set(slug, cloneLesson(draft));
    }
  }

  courseData = course;
  lessonDrafts.clear();
  lessonSavedJson.clear();

  for (const lesson of sortedLessons(courseData)) {
    const slug = String(lesson.slug ?? "");
    const restoredDraft = dirtyDrafts.get(slug);
    if (restoredDraft) {
      setLessonDraft(slug, restoredDraft);
      lessonSavedJson.set(slug, JSON.stringify(cloneLesson(lesson)));
    } else {
      setLessonDraft(slug, cloneLesson(lesson));
      lessonSavedJson.set(slug, JSON.stringify(cloneLesson(lesson)));
    }
  }

  const lessons = sortedLessons(courseData);
  const preferredSlug =
    options.selectSlug ??
    selectedLessonSlug ??
    readPersistedLessonSlug(currentCourseId ?? -1);
  const targetSlug = resolveInitialLessonSlug(lessons, { lessonSlug: preferredSlug });
  if (targetSlug) {
    selectLesson(targetSlug, true);
  } else {
    selectedLessonSlug = null;
    renderContentList();
  }

  if (options.openRenameForSlug) {
    renamingLessonSlug = options.openRenameForSlug;
  }

  renderLessonList();
  updateSaveState();
  syncCourseSettingsFields(courseData?.course);
  if (scrollSnapshot) restoreScrollSnapshot(scrollSnapshot);
  syncEditorUrl();
}

function syncEditorUrl() {
  const lessons = sortedLessons(courseData);
  const params = buildEditorSearchParams({
    courseId: currentCourseId,
    lessonSlug: selectedLessonSlug,
    lessonIndex: lessonIndexFromSlug(lessons, selectedLessonSlug),
    advancedOpen,
  });
  const url = new URL(window.location.href);
  url.search = params;
  window.history.replaceState(null, "", url.toString());
}

function setAdvancedOpen(next: boolean) {
  advancedOpen = next;
  if (dom.advancedPanel) dom.advancedPanel.classList.toggle("is-open", advancedOpen);
  if (dom.advancedToggle) {
    dom.advancedToggle.setAttribute("aria-expanded", String(advancedOpen));
    dom.advancedToggle.textContent = advancedOpen ? "Hide JSON" : "Lesson JSON";
  }
  if (advancedOpen) syncRawTextarea();
}

function restoreContentEditIfPossible(ref: ComponentRef | null) {
  if (!ref || !selectedLessonSlug) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;
  const match = flattenLessonContent(lesson).find((item) => contentItemMatches(ref, item));
  if (match) openContentEdit(match);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTextFromHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function cloneLesson(lesson: LessonRecord) {
  return JSON.parse(JSON.stringify(lesson)) as LessonRecord;
}

function sortedLessons(course: CourseRecord | null) {
  const lessons = Array.isArray(course?.lessons) ? [...course.lessons] : [];
  return lessons.sort(
    (a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0),
  );
}

function sortedBlocks(lesson: LessonRecord) {
  const blocks = Array.isArray(lesson.blocks) ? [...(lesson.blocks as unknown[])] : [];
  return (blocks as LessonRecord[]).sort(
    (a, b) => Number(a.order ?? 0) - Number(b.order ?? 0),
  );
}

function sortedComponents(block: LessonRecord) {
  const components = Array.isArray(block.components)
    ? [...(block.components as unknown[])]
    : [];
  return (components as Record<string, unknown>[]).sort((a, b) => {
    const orderA = Number(a.order ?? 0);
    const orderB = Number(b.order ?? 0);
    if (orderA !== orderB) return orderA - orderB;
    const slotA = Number(a.legacySlot ?? 0);
    const slotB = Number(b.legacySlot ?? 0);
    if (slotA !== slotB) return slotA - slotB;
    return String(a.type).localeCompare(String(b.type));
  });
}

function findBlock(lesson: LessonRecord, blockSlug: string) {
  const blocks = Array.isArray(lesson.blocks) ? (lesson.blocks as LessonRecord[]) : [];
  return blocks.find((block) => block.slug === blockSlug) ?? null;
}

function findComponentIndex(block: LessonRecord, legacyComponentId: number, type: string) {
  const components = Array.isArray(block.components)
    ? (block.components as Record<string, unknown>[])
    : [];
  return components.findIndex(
    (c) => c.legacyComponentId === legacyComponentId && c.type === type,
  );
}

function getLessonDraft(slug: string) {
  return lessonDrafts.get(slug) ?? null;
}

function setLessonDraft(slug: string, lesson: LessonRecord) {
  lessonDrafts.set(slug, lesson);
}

function isLessonDirty(slug: string) {
  const draft = getLessonDraft(slug);
  const saved = lessonSavedJson.get(slug);
  if (!draft || !saved) return false;
  return JSON.stringify(draft) !== saved;
}

function typeMeta(type: string) {
  return (
    EDITOR_TYPE_META[type as EditorContentKind] ?? {
      label: "Content",
      color: "#64748b",
      abbrev: "?",
    }
  );
}

function imageEditorKind(component: Record<string, unknown>): EditorContentKind {
  if (component.type !== "image") return String(component.type) as EditorContentKind;
  return imageCaptionHasContent(component.caption) ? "imageWithCaption" : "image";
}

function setOptionalLinkUrl(target: Record<string, unknown>, linkUrl: unknown) {
  const normalized = normalizeImageLinkUrl(linkUrl);
  if (normalized) target.linkUrl = normalized;
  else delete target.linkUrl;
}

function linkedImagePreviewHtml(
  src: string,
  alt: string,
  linkUrl: unknown,
  className: string,
): string {
  const previewSrc = resolvePreviewAssetUrl(src);
  if (!previewSrc) {
    return `<div style="display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.82rem;background:#f1f5f9;min-height:6rem;border-radius:0.35rem">Image preview</div>`;
  }
  const img = `<img class="${className}" src="${escapeHtml(previewSrc)}" alt="${escapeHtml(alt)}">`;
  const link = courseImageLinkAttrs(linkUrl);
  if (!link) return img;
  const target = link.target ? ` target="${link.target}"` : "";
  const rel = link.rel ? ` rel="${link.rel}"` : "";
  return `<a href="${escapeHtml(link.href)}"${target}${rel}>${img}</a>`;
}

function flattenLessonContent(lesson: LessonRecord): FlatContentItem[] {
  const items: FlatContentItem[] = [];
  for (const block of sortedBlocks(lesson)) {
    if (isTextVideoLayoutBlock(block)) {
      const parts = getTextVideoLayoutParts(block);
      if (!parts) continue;
      items.push({
        blockSlug: String(block.slug ?? ""),
        legacyComponentId: Number(parts.leftText.legacyComponentId),
        type: TEXT_VIDEO_LAYOUT_TYPE,
        pairedLegacyComponentId: Number(parts.video.legacyComponentId),
        component: {
          type: TEXT_VIDEO_LAYOUT_TYPE,
          leftText: parts.leftText,
          video: parts.video,
          bottomText: parts.bottomText,
          richText: parts.leftText,
        },
      });
      continue;
    }

    if (isThreeVideosLayoutBlock(block)) {
      const parts = getThreeVideosLayoutParts(block);
      if (!parts) continue;
      items.push({
        blockSlug: String(block.slug ?? ""),
        legacyComponentId: Number(parts.intro?.legacyComponentId ?? parts.slots[0]!.video.legacyComponentId),
        type: THREE_VIDEOS_LAYOUT_TYPE,
        component: {
          type: THREE_VIDEOS_LAYOUT_TYPE,
          intro: parts.intro,
          slots: parts.slots,
          outro: parts.outro,
        },
      });
      continue;
    }

    if (isTextImageLayoutBlock(block)) {
      const parts = getTextImageLayoutParts(block);
      if (!parts) continue;
      items.push({
        blockSlug: String(block.slug ?? ""),
        legacyComponentId: Number(parts.text.legacyComponentId),
        type: TEXT_IMAGE_LAYOUT_TYPE,
        pairedLegacyComponentId: Number(parts.image.legacyComponentId),
        component: {
          type: TEXT_IMAGE_LAYOUT_TYPE,
          text: parts.text,
          image: parts.image,
          imagePosition: getImagePosition(block),
          header: getLayoutHeader(block),
        },
      });
      continue;
    }

    if (isAccordionLayoutBlock(block)) {
      const parts = getAccordionLayoutParts(block);
      if (!parts) continue;
      items.push({
        blockSlug: String(block.slug ?? ""),
        legacyComponentId: Number(parts.accordion.legacyComponentId),
        type: "exerciseAccordion",
        introLegacyComponentId: parts.introText
          ? Number(parts.introText.legacyComponentId)
          : undefined,
        component: {
          ...(parts.accordion as Record<string, unknown>),
          introText: parts.introText,
        },
      });
      continue;
    }

    if (isEmbeddedToolLayoutBlock(block)) {
      const parts = getEmbeddedToolLayoutParts(block);
      if (!parts) continue;
      items.push({
        blockSlug: String(block.slug ?? ""),
        legacyComponentId: Number(parts.tool.legacyComponentId),
        type: "embeddedTool",
        introLegacyComponentId: parts.introText
          ? Number(parts.introText.legacyComponentId)
          : undefined,
        component: {
          ...(parts.tool as Record<string, unknown>),
          introText: parts.introText,
        },
      });
      continue;
    }

    for (const component of sortedComponents(block)) {
      items.push({
        blockSlug: String(block.slug ?? ""),
        legacyComponentId: Number(component.legacyComponentId),
        type: String(component.type ?? ""),
        component,
      });
    }
  }
  return items;
}

function contentItemMatches(a: ComponentRef | null, b: ComponentRef): boolean {
  if (!a) return false;
  if (
    a.type === TEXT_VIDEO_LAYOUT_TYPE ||
    b.type === TEXT_VIDEO_LAYOUT_TYPE ||
    a.type === TEXT_IMAGE_LAYOUT_TYPE ||
    b.type === TEXT_IMAGE_LAYOUT_TYPE ||
    a.type === THREE_VIDEOS_LAYOUT_TYPE ||
    b.type === THREE_VIDEOS_LAYOUT_TYPE
  ) {
    return a.blockSlug === b.blockSlug && a.type === b.type;
  }
  return (
    a.blockSlug === b.blockSlug &&
    a.legacyComponentId === b.legacyComponentId &&
    a.type === b.type
  );
}

function contentSummary(component: Record<string, unknown>) {
  if (component.type === TEXT_VIDEO_LAYOUT_TYPE) {
    const leftText = component.leftText as Record<string, unknown> | undefined;
    const video = component.video as Record<string, unknown> | undefined;
    const bottomText = component.bottomText as Record<string, unknown> | null | undefined;
    if (leftText && video) {
      return textVideoLayoutSummary({
        leftText,
        video,
        bottomText: bottomText ?? null,
      });
    }
    return "Text + video layout";
  }

  if (component.type === THREE_VIDEOS_LAYOUT_TYPE) {
    const intro = component.intro as Record<string, unknown> | null | undefined;
    const slots = component.slots as
      | [
          { video: Record<string, unknown>; caption: Record<string, unknown> | null },
          { video: Record<string, unknown>; caption: Record<string, unknown> | null },
          { video: Record<string, unknown>; caption: Record<string, unknown> | null },
        ]
      | undefined;
    const outro = component.outro as Record<string, unknown> | null | undefined;
    if (slots?.length === 3) {
      return threeVideosLayoutSummary({ intro: intro ?? null, slots, outro: outro ?? null });
    }
    return "Three videos with text";
  }

  if (component.type === TEXT_IMAGE_LAYOUT_TYPE) {
    const text = component.text as Record<string, unknown> | undefined;
    const image = component.image as Record<string, unknown> | undefined;
    const imagePosition = component.imagePosition === "left" ? "left" : "right";
    const header =
      typeof component.header === "string" && layoutHeaderHasContent(component.header)
        ? String(component.header).trim()
        : null;
    if (text && image) {
      return textImageLayoutSummary({ text, image }, imagePosition, header);
    }
    return "Text + image layout";
  }

  switch (component.type) {
    case "richText": {
      const text = stripTextFromHtml(String(component.html ?? ""));
      return text
        ? text.length > 90
          ? `${text.slice(0, 90)}…`
          : text
        : "Empty text";
    }
    case "video": {
      const title = component.title ? String(component.title) : "";
      return title || (component.vimeoId ? `Video ${component.vimeoId}` : "Untitled video");
    }
    case "download":
      return String(component.label ?? component.filename ?? "Download");
    case "embeddedTool": {
      const toolKey = String(component.toolKey ?? "").trim();
      const entry = getEmbeddedToolByKey(toolKey);
      const toolName = entry ? entry.name : toolKey || "Embedded tool";
      const introText = component.introText as Record<string, unknown> | null | undefined;
      if (introText) {
        return embeddedToolLayoutSummary({
          introText,
          tool: component,
        });
      }
      return toolName;
    }
    case "exerciseAccordion": {
      const introText = component.introText as Record<string, unknown> | null | undefined;
      const sections = Array.isArray(component.sections) ? component.sections : [];
      if (introText) {
        return accordionLayoutSummary({
          introText,
          accordion: component,
        });
      }
      return `${sections.length} section${sections.length === 1 ? "" : "s"}`;
    }
    case "imageGallery": {
      const slides = Array.isArray(component.slides) ? component.slides : [];
      return `${slides.length} image${slides.length === 1 ? "" : "s"}`;
    }
    case "image": {
      const src = String(component.src ?? "").trim();
      const label = src ? src.split("/").pop() ?? src : "No image";
      const caption = String(component.caption ?? "").trim();
      const link = normalizeImageLinkUrl(component.linkUrl);
      const parts = [caption ? `${label} · ${caption}` : label];
      if (link) parts.push("link");
      return parts.join(" · ");
    }
    case "imageCarousel": {
      const title = component.title ? String(component.title).trim() : "";
      const slides = Array.isArray(component.slides) ? component.slides : [];
      const slideLabel = `${slides.length} slide${slides.length === 1 ? "" : "s"}`;
      return title ? `${title} · ${slideLabel}` : slideLabel;
    }
    default:
      return typeMeta(String(component.type)).label;
  }
}

function setStatus(message: string, kind: "" | "is-error" | "is-success" = "") {
  if (!dom.status) return;
  dom.status.textContent = message;
  dom.status.classList.remove("is-error", "is-success");
  if (kind) dom.status.classList.add(kind);
}

function flashToast(message: string) {
  if (!dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.classList.add("is-visible");
  window.setTimeout(() => dom.toast?.classList.remove("is-visible"), 1800);
}

function updateSaveHint() {
  if (!dom.saveHint || !selectedLessonSlug) return;
  dom.saveHint.textContent = isLessonDirty(selectedLessonSlug) ? "Unsaved changes" : "Saved";
}

function updateSaveState() {
  const dirty = selectedLessonSlug ? isLessonDirty(selectedLessonSlug) : false;
  if (dom.saveBtn) dom.saveBtn.disabled = !dirty;
  if (dom.revertBtn) dom.revertBtn.disabled = !dirty;
  if (dom.advancedSaveBtn) dom.advancedSaveBtn.disabled = !dirty;
  updateSaveHint();
  dom.lessonList?.querySelectorAll("[data-lesson-slug]").forEach((row) => {
    const slug = row.getAttribute("data-lesson-slug");
    if (slug) row.classList.toggle("is-dirty", isLessonDirty(slug));
  });
}

function maxLegacyComponentIdInCourse() {
  let max = 0;
  const scan = (lessons: LessonRecord[]) => {
    for (const lesson of lessons) {
      for (const block of sortedBlocks(lesson)) {
        for (const component of sortedComponents(block)) {
          const id = Number(component.legacyComponentId);
          if (Number.isFinite(id) && id > max) max = id;
        }
      }
    }
  };
  if (courseData?.lessons) scan(courseData.lessons as LessonRecord[]);
  for (const lesson of lessonDrafts.values()) scan([lesson]);
  return max + 1;
}

function expandSection(blockSlug: string | null) {
  expandedSectionSlug = blockSlug;
  outlineExpandInitialized = true;
}

function validateExpandedSectionSlug(groups: ReturnType<typeof buildContentListGroups>) {
  if (groups.length === 0) {
    expandedSectionSlug = null;
    return;
  }

  const slugs = new Set(groups.map((group) => group.blockSlug));

  if (expandedSectionSlug && slugs.has(expandedSectionSlug)) {
    outlineExpandInitialized = true;
    return;
  }

  if (contentEditingRef?.blockSlug && slugs.has(contentEditingRef.blockSlug)) {
    expandedSectionSlug = contentEditingRef.blockSlug;
    outlineExpandInitialized = true;
    return;
  }

  if (!outlineExpandInitialized) {
    expandedSectionSlug = groups[0]!.blockSlug;
    outlineExpandInitialized = true;
    return;
  }

  if (expandedSectionSlug && !slugs.has(expandedSectionSlug)) {
    expandedSectionSlug = groups[0]!.blockSlug ?? null;
  }
}

function renderSectionAddBlockRow(blockSlug: string) {
  const buttons = SECTION_BLOCK_ADD_KINDS.map(
    ({ kind, label }) =>
      `<button type="button" class="course-editor__outline-add-block-btn" data-add-to-section="${escapeHtml(blockSlug)}" data-add-kind="${escapeHtml(kind)}">${escapeHtml(label)}</button>`,
  ).join("");
  return `
    <div class="course-editor__outline-add-block">
      <span class="course-editor__outline-add-block-label">+ Add Block</span>
      <div class="course-editor__outline-add-block-types">${buttons}</div>
    </div>
  `;
}

function appendBlockToSection(blockSlug: string, kind: string) {
  if (!selectedLessonSlug) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;
  const block = findBlock(lesson, blockSlug);
  if (!block || isEditorLayoutBlock(block)) return;

  const component = createComponent(kind);
  const added = appendComponentToBlock(lesson as CourseLesson, blockSlug, component);
  if (!added) return;

  setLessonDraft(selectedLessonSlug, lesson);
  expandSection(blockSlug);
  contentEditingRef = {
    blockSlug,
    legacyComponentId: Number(component.legacyComponentId),
    type: String(component.type),
  };
  openContentEdit(contentEditingRef);
  updateSaveState();
  flashToast(`Added ${typeMeta(imageEditorKind(component)).label} block`);
}

function deleteContentSection(blockSlug: string) {
  if (!selectedLessonSlug) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;

  const removed = removeBlockFromLesson(lesson, blockSlug);
  if (!removed) return;

  reassignAllContentOrders(lesson);
  setLessonDraft(selectedLessonSlug, lesson);

  if (contentEditingRef?.blockSlug === blockSlug) {
    contentEditingRef = null;
    hideEditFormPanel();
  }

  validateExpandedSectionSlug(
    buildContentListGroups(lesson, flattenLessonContent(lesson as CourseLesson)),
  );

  renderContentList();
  renderLessonList();
  updateSaveState();
  flashToast("Section deleted");
}

function splitContentSection(blockSlug: string) {
  if (!selectedLessonSlug) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;
  const split = splitBlockIntoStandaloneSections(
    lesson as CourseLesson,
    blockSlug,
    allLessonsForIdScope(),
  );
  if (!split) return;
  setLessonDraft(selectedLessonSlug, lesson);
  contentEditingRef = null;
  hideEditFormPanel();
  renderContentList();
  updateSaveState();
  flashToast("Split into separate sections — each block now has its own heading");
}

function moveContentSectionByIndex(sectionIndex: number, delta: -1 | 1) {
  if (!selectedLessonSlug) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;
  if (!moveSectionAtIndex(lesson, sectionIndex, delta)) {
    flashToast("Could not move section — try saving and reloading the lesson");
    return;
  }
  reassignAllContentOrders(lesson);
  setLessonDraft(selectedLessonSlug, lesson);
  renderContentList();
  updateSaveState();
  flashToast(delta < 0 ? "Section moved up" : "Section moved down");
}

function bindContentListActions() {
  if (!dom.itemsList || dom.itemsList.dataset.actionsBound === "1") return;
  dom.itemsList.dataset.actionsBound = "1";

  dom.itemsList.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    const toggleSection = target.closest("[data-toggle-section]") as HTMLButtonElement | null;
    if (toggleSection) {
      e.preventDefault();
      e.stopPropagation();
      const blockSlug = toggleSection.getAttribute("data-toggle-section");
      if (blockSlug) {
        expandSection(expandedSectionSlug === blockSlug ? null : blockSlug);
        renderContentList();
      }
      return;
    }

    const sectionRow = target.closest("[data-outline-section-row]") as HTMLElement | null;
    if (
      sectionRow &&
      !target.closest("input, button, .course-editor__outline-section-actions, a")
    ) {
      e.preventDefault();
      const blockSlug = sectionRow.getAttribute("data-outline-section-row");
      if (blockSlug && expandedSectionSlug !== blockSlug) {
        expandSection(blockSlug);
        renderContentList();
      }
      return;
    }

    const sectionUp = target.closest("[data-move-section-up]") as HTMLButtonElement | null;
    if (sectionUp && !sectionUp.disabled) {
      e.preventDefault();
      e.stopPropagation();
      const sectionIndex = Number(sectionUp.getAttribute("data-move-section-up"));
      if (Number.isFinite(sectionIndex)) moveContentSectionByIndex(sectionIndex, -1);
      return;
    }

    const sectionDown = target.closest("[data-move-section-down]") as HTMLButtonElement | null;
    if (sectionDown && !sectionDown.disabled) {
      e.preventDefault();
      e.stopPropagation();
      const sectionIndex = Number(sectionDown.getAttribute("data-move-section-down"));
      if (Number.isFinite(sectionIndex)) moveContentSectionByIndex(sectionIndex, 1);
      return;
    }

    const splitBtn = target.closest("[data-split-section]") as HTMLButtonElement | null;
    if (splitBtn) {
      e.preventDefault();
      e.stopPropagation();
      const blockSlug = splitBtn.getAttribute("data-split-section");
      if (blockSlug) splitContentSection(blockSlug);
      return;
    }

    const deleteSectionBtn = target.closest("[data-delete-section]") as HTMLButtonElement | null;
    if (deleteSectionBtn) {
      e.preventDefault();
      e.stopPropagation();
      const blockSlug = deleteSectionBtn.getAttribute("data-delete-section");
      if (blockSlug) {
        if (deleteSectionBtn.dataset.confirm === "1") {
          deleteContentSection(blockSlug);
        } else {
          deleteSectionBtn.dataset.confirm = "1";
          deleteSectionBtn.textContent = "Delete?";
          deleteSectionBtn.classList.add("course-editor__item-delete-confirm");
          window.setTimeout(() => {
            delete deleteSectionBtn.dataset.confirm;
            deleteSectionBtn.textContent = "Delete section";
            deleteSectionBtn.classList.remove("course-editor__item-delete-confirm");
          }, 3000);
        }
      }
      return;
    }

    const addBlockBtn = target.closest("[data-add-to-section]") as HTMLButtonElement | null;
    if (addBlockBtn) {
      e.preventDefault();
      e.stopPropagation();
      const blockSlug = addBlockBtn.getAttribute("data-add-to-section");
      const kind = addBlockBtn.getAttribute("data-add-kind");
      if (blockSlug && kind) appendBlockToSection(blockSlug, kind);
    }
  });

  dom.itemsList.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    const titleInput = target.closest("[data-section-title]") as HTMLInputElement | null;
    if (!titleInput) return;
    const blockSlug = titleInput.getAttribute("data-section-title");
    if (blockSlug) applyBlockSectionTitle(blockSlug, titleInput.value, false);
  });
}

function populateAddSectionTypes() {
  if (!dom.addSectionTypes) return;
  dom.addSectionTypes.innerHTML = NEW_SECTION_ADD_KINDS.map(
    ({ kind, label }) =>
      `<button type="button" class="course-editor__add-section-type-btn" data-add-section-kind="${escapeHtml(kind)}">${escapeHtml(label)}</button>`,
  ).join("");
}

function bindAddSectionControls() {
  if (!dom.addSectionTypes || dom.addSectionTypes.dataset.bound === "1") return;
  dom.addSectionTypes.dataset.bound = "1";
  dom.addSectionTypes.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("[data-add-section-kind]") as HTMLButtonElement | null;
    if (!btn) return;
    const kind = btn.getAttribute("data-add-section-kind");
    if (kind) {
      appendContentItem(kind);
      if (dom.addSectionMenu) dom.addSectionMenu.open = false;
    }
  });
}

function nextAssignId(lesson: LessonRecord) {
  let max = 0;
  for (const block of sortedBlocks(lesson)) {
    const assignId = Number((block.legacy as Record<string, unknown> | undefined)?.assignId);
    if (Number.isFinite(assignId) && assignId > max) max = assignId;
  }
  return max + 1;
}

function nextBlockOrder(lesson: LessonRecord) {
  let max = 0;
  for (const block of sortedBlocks(lesson)) {
    const order = Number(block.order);
    if (Number.isFinite(order) && order > max) max = order;
  }
  return max + 1;
}

function createAccordionLayoutBlock(lesson: LessonRecord): LessonRecord {
  const timestamp = Date.now();
  const introId = maxLegacyComponentIdInCourse();
  const accordionId = introId + 1;
  return {
    title: "Accordion",
    slug: `accordion-${timestamp}`,
    order: nextBlockOrder(lesson),
    legacy: { assignId: nextAssignId(lesson), blockType: "HTML", editorLayout: "accordion" },
    components: [
      {
        type: "richText",
        html: "",
        legacyComponentId: introId,
        order: 1,
        layoutRole: ACCORDION_INTRO_ROLE,
      },
      {
        type: "exerciseAccordion",
        sections: [{ title: "Section title", bodyHtml: "<p></p>", iconSrc: "" }],
        legacyComponentId: accordionId,
        order: 2,
      },
    ],
  };
}

function createEmbeddedToolLayoutBlock(lesson: LessonRecord): LessonRecord {
  const timestamp = Date.now();
  const introId = maxLegacyComponentIdInCourse();
  const toolId = introId + 1;
  const availableTools = availableEmbeddedToolsForContext("course");
  const defaultKey = availableTools[0]?.key ?? "maximum-knitted-width";
  return {
    title: "Tool",
    slug: `embedded-tool-${timestamp}`,
    order: nextBlockOrder(lesson),
    legacy: { assignId: nextAssignId(lesson), blockType: "HTML", editorLayout: "embeddedTool" },
    components: [
      {
        type: "richText",
        html: "",
        legacyComponentId: introId,
        order: 1,
        layoutRole: EMBEDDED_TOOL_INTRO_ROLE,
      },
      {
        type: "embeddedTool",
        toolKey: defaultKey,
        legacyComponentId: toolId,
        order: 2,
      },
    ],
  };
}

function createTextVideoLayoutBlock(lesson: LessonRecord): LessonRecord {
  const timestamp = Date.now();
  const richTextId = maxLegacyComponentIdInCourse();
  const videoId = richTextId + 1;
  return {
    title: "Text + Video",
    slug: `text-video-${timestamp}`,
    order: nextBlockOrder(lesson),
    legacy: { assignId: nextAssignId(lesson), blockType: "HTML", editorLayout: "textVideo" },
    components: [
      {
        type: "richText",
        html: "<p>Your lesson text goes here.</p>",
        legacyComponentId: richTextId,
        order: 1,
        layoutRole: TEXT_VIDEO_LEFT_ROLE,
      },
      {
        type: "video",
        vimeoId: "",
        title: null,
        legacyComponentId: videoId,
        order: 2,
      },
    ],
  };
}

function createTextImageLayoutBlock(lesson: LessonRecord): LessonRecord {
  const timestamp = Date.now();
  const richTextId = maxLegacyComponentIdInCourse();
  const imageId = richTextId + 1;
  return {
    title: "Text + Image",
    slug: `text-image-${timestamp}`,
    order: nextBlockOrder(lesson),
    legacy: { assignId: nextAssignId(lesson), blockType: "HTML", editorLayout: "textImage" },
    layoutOptions: { imagePosition: "right" },
    components: [
      {
        type: "richText",
        html: "<p>Your lesson text goes here.</p>",
        legacyComponentId: richTextId,
        order: 1,
        layoutRole: TEXT_IMAGE_TEXT_ROLE,
      },
      {
        type: "image",
        src: "",
        alt: "",
        caption: null,
        legacyComponentId: imageId,
        order: 2,
        layoutRole: TEXT_IMAGE_IMAGE_ROLE,
      },
    ],
  };
}

function createThreeVideosLayoutBlock(lesson: LessonRecord): LessonRecord {
  const timestamp = Date.now();
  let nextId = maxLegacyComponentIdInCourse();
  const makeId = () => nextId++;

  const components: Record<string, unknown>[] = [
    {
      type: "richText",
      html: DEFAULT_THREE_VIDEOS_INTRO_HTML,
      legacyComponentId: makeId(),
      order: 1,
      layoutRole: THREE_VIDEOS_INTRO_ROLE,
    },
  ];

  for (const slot of [1, 2, 3] as const) {
    components.push(
      {
        type: "video",
        vimeoId: "",
        title: `Video Title ${slot}`,
        legacyComponentId: makeId(),
        order: components.length + 1,
        layoutRole: threeVideosVideoRole(slot),
      },
      {
        type: "richText",
        html: DEFAULT_THREE_VIDEOS_CAPTION_HTML,
        legacyComponentId: makeId(),
        order: components.length + 1,
        layoutRole: threeVideosCaptionRole(slot),
      },
    );
  }

  components.push({
    type: "richText",
    html: DEFAULT_THREE_VIDEOS_OUTRO_HTML,
    legacyComponentId: makeId(),
    order: components.length + 1,
    layoutRole: THREE_VIDEOS_OUTRO_ROLE,
  });

  return {
    title: "Three Videos with Text",
    slug: `three-videos-${timestamp}`,
    order: nextBlockOrder(lesson),
    legacy: {
      assignId: nextAssignId(lesson),
      blockType: "HTML",
      editorLayout: THREE_VIDEOS_EDITOR_LAYOUT,
    },
    components,
  };
}

function reassignThreeVideosLayoutIds(block: LessonRecord, startId: number) {
  const parts = getThreeVideosLayoutParts(block);
  if (!parts) return;
  let id = startId;
  if (parts.intro) parts.intro.legacyComponentId = id++;
  for (const slot of parts.slots) {
    slot.video.legacyComponentId = id++;
    if (slot.caption) slot.caption.legacyComponentId = id++;
  }
  if (parts.outro) parts.outro.legacyComponentId = id++;
}

function createComponent(kind: string): Record<string, unknown> {
  const legacyComponentId = maxLegacyComponentIdInCourse();
  switch (kind) {
    case "richText-blank":
      return { type: "richText", html: "<p></p>", legacyComponentId, order: 1 };
    case "video":
      return { type: "video", vimeoId: "", title: null, legacyComponentId, order: 1 };
    case "download":
      return {
        type: "download",
        label: "Download",
        filename: "file.pdf",
        legacyComponentId,
        order: 1,
      };
    case "embeddedTool": {
      const availableTools = availableEmbeddedToolsForContext("course");
      const defaultKey = availableTools[0]?.key ?? "maximum-knitted-width";
      return {
        type: "embeddedTool",
        toolKey: defaultKey,
        legacyComponentId,
        order: 1,
      };
    }
    case "image":
      return {
        type: "image",
        src: "",
        alt: "",
        caption: null,
        legacyComponentId,
        order: 1,
      };
    case "imageWithCaption":
      return {
        type: "image",
        src: "",
        alt: "",
        caption: "Caption text",
        legacyComponentId,
        order: 1,
      };
    case "exerciseAccordion":
      return {
        type: "exerciseAccordion",
        sections: [{ title: "Section title", bodyHtml: "<p></p>", iconSrc: "" }],
        legacyComponentId,
        order: 1,
      };
    case "imageGallery":
      return {
        type: "imageGallery",
        slides: [{ src: "", caption: "" }],
        legacyComponentId,
        order: 1,
      };
    case "imageCarousel":
      return {
        type: "imageCarousel",
        title: null,
        slides: [{ src: "", alt: "", caption: "" }],
        legacyComponentId,
        order: 1,
      };
    default:
      return { type: "richText", html: "<p></p>", legacyComponentId, order: 1 };
  }
}

function reassignAllContentOrders(lesson: LessonRecord) {
  let order = 1;
  for (const block of sortedBlocks(lesson)) {
    for (const component of sortedComponents(block)) {
      component.order = order++;
    }
  }
}

function pruneEmptyBlocks(lesson: LessonRecord) {
  lesson.blocks = (Array.isArray(lesson.blocks) ? lesson.blocks : []).filter(
    (block) =>
      Array.isArray((block as LessonRecord).components) &&
      ((block as LessonRecord).components as unknown[]).length > 0,
  );
}

function removeComponentFromBlock(
  lesson: LessonRecord,
  blockSlug: string,
  legacyComponentId: number,
  type: string,
) {
  const block = findBlock(lesson, blockSlug);
  if (!block) return null;
  const index = findComponentIndex(block, legacyComponentId, type);
  if (index === -1) return null;
  const components = block.components as Record<string, unknown>[];
  return components.splice(index, 1)[0] ?? null;
}

function getContentComponent(ref: ComponentRef | null) {
  if (!selectedLessonSlug || !ref) return null;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return null;
  const block = findBlock(lesson, ref.blockSlug);
  if (!block) return null;
  const index = findComponentIndex(block, ref.legacyComponentId, ref.type);
  if (index === -1) return null;
  return (block.components as Record<string, unknown>[])[index] ?? null;
}

function ensureBottomTextComponent(block: LessonRecord): Record<string, unknown> {
  const parts = getTextVideoLayoutParts(block);
  if (!parts) throw new Error("Not a text+video layout block.");
  if (parts.bottomText) return parts.bottomText;

  const bottomId = maxLegacyComponentIdInCourse();
  const bottom = {
    type: "richText",
    html: "",
    legacyComponentId: bottomId,
    order: 3,
    layoutRole: TEXT_VIDEO_BOTTOM_ROLE,
  };
  if (!Array.isArray(block.components)) block.components = [];
  (block.components as Record<string, unknown>[]).push(bottom);
  return bottom;
}

function isAccordionLayoutItem(ref: ComponentRef, lesson: LessonRecord): boolean {
  if (ref.type !== "exerciseAccordion") return false;
  const block = findBlock(lesson, ref.blockSlug);
  return block ? isAccordionLayoutBlock(block) : false;
}

function isEmbeddedToolLayoutItem(ref: ComponentRef, lesson: LessonRecord): boolean {
  if (ref.type !== "embeddedTool") return false;
  const block = findBlock(lesson, ref.blockSlug);
  return block ? isEmbeddedToolLayoutBlock(block) : false;
}

function removeIntroIfEmpty(block: LessonRecord) {
  const parts = getAccordionLayoutParts(block);
  if (!parts?.introText) return;
  const html = String(parts.introText.html ?? "");
  if (richTextHasVisibleContent(html)) return;

  const components = block.components as Record<string, unknown>[];
  const index = components.findIndex(
    (c) =>
      c.legacyComponentId === parts.introText!.legacyComponentId && c.type === "richText",
  );
  if (index !== -1) components.splice(index, 1);
}

function ensureIntroComponent(block: LessonRecord): Record<string, unknown> {
  const parts = getAccordionLayoutParts(block);
  if (!parts) throw new Error("Not an accordion layout block.");
  if (parts.introText) return parts.introText;

  const introId = maxLegacyComponentIdInCourse();
  const accordionOrder = Number(parts.accordion.order ?? 2);
  const intro = {
    type: "richText",
    html: "",
    legacyComponentId: introId,
    order: Math.max(1, accordionOrder - 1),
    layoutRole: ACCORDION_INTRO_ROLE,
  };
  if (!Array.isArray(block.components)) block.components = [];
  const components = block.components as Record<string, unknown>[];
  const accordionIndex = components.findIndex(
    (c) =>
      c.legacyComponentId === parts.accordion.legacyComponentId &&
      c.type === "exerciseAccordion",
  );
  components.splice(accordionIndex === -1 ? components.length : accordionIndex, 0, intro);
  return intro;
}

function applyAccordionPatch(patch: { introHtml?: string; sections?: Record<string, unknown>[] }) {
  if (!selectedLessonSlug || !contentEditingRef) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;
  const block = findBlock(lesson, contentEditingRef.blockSlug);
  if (!block || !isAccordionLayoutBlock(block)) return;
  const parts = getAccordionLayoutParts(block);
  if (!parts) return;

  if (patch.introHtml !== undefined) {
    if (richTextHasVisibleContent(patch.introHtml)) {
      const intro = ensureIntroComponent(block);
      intro.html = patch.introHtml;
      intro.layoutRole = ACCORDION_INTRO_ROLE;
    } else {
      removeIntroIfEmpty(block);
    }
  }

  if (patch.sections !== undefined) {
    parts.accordion.sections = patch.sections;
  }

  setLessonDraft(selectedLessonSlug, lesson);
  renderContentList();
  updateCombinePreviousButton();
  updateSaveState();
}

function removeEmbeddedToolIntroIfEmpty(block: LessonRecord) {
  const parts = getEmbeddedToolLayoutParts(block);
  if (!parts?.introText) return;
  const html = String(parts.introText.html ?? "");
  if (richTextHasVisibleContent(html)) return;

  const components = block.components as Record<string, unknown>[];
  const index = components.findIndex(
    (c) =>
      c.legacyComponentId === parts.introText!.legacyComponentId && c.type === "richText",
  );
  if (index !== -1) components.splice(index, 1);
}

function ensureEmbeddedToolIntroComponent(block: LessonRecord): Record<string, unknown> {
  const parts = getEmbeddedToolLayoutParts(block);
  if (!parts) throw new Error("Not an embedded tool layout block.");
  if (parts.introText) return parts.introText;

  const introId = maxLegacyComponentIdInCourse();
  const toolOrder = Number(parts.tool.order ?? 2);
  const intro = {
    type: "richText",
    html: "",
    legacyComponentId: introId,
    order: Math.max(1, toolOrder - 1),
    layoutRole: EMBEDDED_TOOL_INTRO_ROLE,
  };
  if (!Array.isArray(block.components)) block.components = [];
  const components = block.components as Record<string, unknown>[];
  const toolIndex = components.findIndex(
    (c) =>
      c.legacyComponentId === parts.tool.legacyComponentId && c.type === "embeddedTool",
  );
  components.splice(toolIndex === -1 ? components.length : toolIndex, 0, intro);
  return intro;
}

function applyEmbeddedToolPatch(patch: {
  introHtml?: string;
  toolKey?: string;
}) {
  if (!selectedLessonSlug || !contentEditingRef) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;
  const block = findBlock(lesson, contentEditingRef.blockSlug);
  if (!block || !isEmbeddedToolLayoutBlock(block)) return;
  const parts = getEmbeddedToolLayoutParts(block);
  if (!parts) return;

  if (patch.introHtml !== undefined) {
    if (richTextHasVisibleContent(patch.introHtml)) {
      const intro = ensureEmbeddedToolIntroComponent(block);
      intro.html = patch.introHtml;
      intro.layoutRole = EMBEDDED_TOOL_INTRO_ROLE;
    } else {
      removeEmbeddedToolIntroIfEmpty(block);
    }
  }

  if (patch.toolKey !== undefined) {
    parts.tool.toolKey = patch.toolKey.trim();
  }

  setLessonDraft(selectedLessonSlug, lesson);
  renderContentList();
  updateSaveState();
}

function getPreviousPlainTextItem(ref: ComponentRef): FlatContentItem | null {
  if (!selectedLessonSlug || ref.type !== "exerciseAccordion") return null;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson || !isAccordionLayoutItem(ref, lesson)) return null;
  const items = flattenLessonContent(lesson);
  const index = items.findIndex((item) => contentItemMatches(item, ref));
  if (index <= 0) return null;
  const prev = items[index - 1]!;
  if (prev.type !== "richText") return null;
  return prev;
}

function combineWithPreviousTextItem(ref: ComponentRef) {
  if (!selectedLessonSlug) return;
  const prev = getPreviousPlainTextItem(ref);
  if (!prev) return;

  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;
  const block = findBlock(lesson, ref.blockSlug);
  if (!block) return;

  const prevHtml = String(prev.component.html ?? "");
  const parts = getAccordionLayoutParts(block);
  if (!parts) return;

  let introHtml = prevHtml;
  if (parts.introText && richTextHasVisibleContent(String(parts.introText.html ?? ""))) {
    introHtml = `${String(parts.introText.html ?? "")}\n${prevHtml}`;
  }

  applyAccordionPatch({ introHtml });

  deleteContentItem({
    blockSlug: prev.blockSlug,
    legacyComponentId: prev.legacyComponentId,
    type: prev.type,
  });

  openAccordionLayoutEdit(ref);
  flashToast("Combined with previous text item");
  updateSaveState();
}

function updateCombinePreviousButton() {
  const btn = dom.editFields?.querySelector("#ce-acc-combine-prev") as HTMLButtonElement | null;
  if (!btn || !contentEditingRef) return;
  const prev = getPreviousPlainTextItem(contentEditingRef);
  btn.hidden = !prev;
}

function removeBottomTextIfEmpty(block: LessonRecord) {
  const parts = getTextVideoLayoutParts(block);
  if (!parts?.bottomText) return;
  const html = String(parts.bottomText.html ?? "");
  if (richTextHasVisibleContent(html)) return;

  const components = block.components as Record<string, unknown>[];
  const index = components.findIndex(
    (c) => c.legacyComponentId === parts.bottomText!.legacyComponentId && c.type === "richText",
  );
  if (index !== -1) components.splice(index, 1);
}

function getNextPlainTextItem(ref: ComponentRef): FlatContentItem | null {
  if (!selectedLessonSlug) return null;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return null;
  return getNextPlainTextItemInLesson(lesson as CourseLesson, ref);
}

function combineWithNextTextItem(ref: ComponentRef) {
  if (!selectedLessonSlug) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;

  const bottomId = maxLegacyComponentIdInCourse();
  const { lesson: updated, combined } = combineTextVideoWithNextPlainText(
    lesson as CourseLesson,
    ref,
    bottomId,
  );
  if (!combined) return;

  setLessonDraft(selectedLessonSlug, updated);
  openTextVideoLayoutEdit(ref);
  flashToast("Combined with next text item");
  updateSaveState();
}

function applyTextVideoPatch(patch: {
  leftHtml?: string;
  bottomHtml?: string;
  vimeoId?: string;
  title?: string | null;
}) {
  if (!selectedLessonSlug || !contentEditingRef) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;
  const block = findBlock(lesson, contentEditingRef.blockSlug);
  if (!block || !isTextVideoLayoutBlock(block)) return;
  const parts = getTextVideoLayoutParts(block);
  if (!parts) return;

  if (patch.leftHtml !== undefined) {
    parts.leftText.html = patch.leftHtml;
    parts.leftText.layoutRole = TEXT_VIDEO_LEFT_ROLE;
  }

  if (patch.vimeoId !== undefined) parts.video.vimeoId = patch.vimeoId;
  if (patch.title !== undefined) parts.video.title = patch.title;

  if (patch.bottomHtml !== undefined) {
    if (richTextHasVisibleContent(patch.bottomHtml)) {
      const bottom = ensureBottomTextComponent(block);
      bottom.html = patch.bottomHtml;
      bottom.layoutRole = TEXT_VIDEO_BOTTOM_ROLE;
    } else {
      removeBottomTextIfEmpty(block);
    }
  }

  setLessonDraft(selectedLessonSlug, lesson);
  renderContentList();
  updateTextVideoLayoutPreview();
  updateCombineNextButton();
  updateSaveState();
}

function updateTextVideoLayoutPreview() {
  const preview = dom.editFields?.querySelector("#ce-tv-layout-preview") as HTMLElement | null;
  if (!preview || !selectedLessonSlug || !contentEditingRef) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  const block = lesson ? findBlock(lesson, contentEditingRef.blockSlug) : null;
  const parts = block ? getTextVideoLayoutParts(block) : null;
  if (!parts) return;

  const leftHtml = rewriteLegacyHtml(
    unwrapTextVideoColumnHtml(String(parts.leftText.html ?? "")),
  );
  const vimeoId = String(parts.video.vimeoId ?? "").trim();
  const title = parts.video.title ? String(parts.video.title) : "";
  const bottomHtml =
    parts.bottomText && richTextHasVisibleContent(String(parts.bottomText.html ?? ""))
      ? rewriteLegacyHtml(String(parts.bottomText.html ?? ""))
      : "";

  preview.innerHTML = `
    <div class="course-preview__text-video-layout">
      <div class="lesson-media-row course-editor__layout-preview">
        <div class="lesson-text course-editor__prose">${leftHtml || "<p><em>Left text preview</em></p>"}</div>
        <div class="lesson-video">
          ${title ? `<p class="course-editor__field-label" style="text-transform:none;font-size:0.85rem;margin:0 0 0.35rem">${escapeHtml(title)}</p>` : ""}
          ${
            vimeoId
              ? `<div class="course-editor__video-preview"><iframe title="Video preview" src="https://player.vimeo.com/video/${escapeHtml(vimeoId)}" allowfullscreen></iframe></div>`
              : `<div class="course-editor__video-preview" style="display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.82rem;background:#f1f5f9">Video preview</div>`
          }
        </div>
      </div>
      ${
        bottomHtml
          ? `<div class="lesson-media-row-bottom course-editor__prose" style="margin-top:0.65rem;padding-top:0.65rem;border-top:1px solid #e2e8f0">${bottomHtml}</div>`
          : ""
      }
    </div>
  `;
}

function applyThreeVideosPatch(patch: {
  introHtml?: string;
  outroHtml?: string;
  slot?: 1 | 2 | 3;
  title?: string | null;
  vimeoId?: string;
  captionHtml?: string;
}) {
  if (!selectedLessonSlug || !contentEditingRef) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;
  const block = findBlock(lesson, contentEditingRef.blockSlug);
  if (!block || !isThreeVideosLayoutBlock(block)) return;
  const parts = getThreeVideosLayoutParts(block);
  if (!parts) return;

  if (patch.introHtml !== undefined && parts.intro) {
    parts.intro.html = patch.introHtml;
    parts.intro.layoutRole = THREE_VIDEOS_INTRO_ROLE;
  }

  if (patch.outroHtml !== undefined && parts.outro) {
    parts.outro.html = patch.outroHtml;
    parts.outro.layoutRole = THREE_VIDEOS_OUTRO_ROLE;
  }

  if (patch.slot) {
    const slotParts = parts.slots[patch.slot - 1];
    if (!slotParts) return;
    if (patch.title !== undefined) slotParts.video.title = patch.title;
    if (patch.vimeoId !== undefined) slotParts.video.vimeoId = patch.vimeoId;
    slotParts.video.layoutRole = threeVideosVideoRole(patch.slot);
    if (patch.captionHtml !== undefined && slotParts.caption) {
      slotParts.caption.html = patch.captionHtml;
      slotParts.caption.layoutRole = threeVideosCaptionRole(patch.slot);
    }
  }

  setLessonDraft(selectedLessonSlug, lesson);
  renderContentList();
  updateThreeVideosLayoutPreview();
  updateSaveState();
}

function updateThreeVideosLayoutPreview() {
  const preview = dom.editFields?.querySelector("#ce-3v-layout-preview") as HTMLElement | null;
  if (!preview || !selectedLessonSlug || !contentEditingRef) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  const block = lesson ? findBlock(lesson, contentEditingRef.blockSlug) : null;
  const parts = block ? getThreeVideosLayoutParts(block) : null;
  if (!parts) return;

  const introHtml =
    parts.intro && richTextHasVisibleContent(String(parts.intro.html ?? ""))
      ? rewriteLegacyHtml(unwrapTextVideoColumnHtml(String(parts.intro.html ?? "")))
      : "";
  const outroHtml =
    parts.outro && richTextHasVisibleContent(String(parts.outro.html ?? ""))
      ? rewriteLegacyHtml(String(parts.outro.html ?? ""))
      : "";
  const blockTitle = block ? blockTitleForEditing(block.title) : "";

  const columns = parts.slots
    .map((slot) => {
      const title = slot.video.title ? String(slot.video.title) : "";
      const vimeoId = String(slot.video.vimeoId ?? "").trim();
      const captionHtml =
        slot.caption && richTextHasVisibleContent(String(slot.caption.html ?? ""))
          ? rewriteLegacyHtml(String(slot.caption.html ?? ""))
          : "";
      return `
        <div class="three-videos-layout__column" style="flex:1 1 300px;min-width:0">
          ${title ? `<h4 style="margin:0 0 0.5rem;font-size:1rem;font-weight:700">${escapeHtml(title)}</h4>` : ""}
          ${
            vimeoId
              ? `<div class="course-editor__video-preview"><iframe title="Video preview" src="https://player.vimeo.com/video/${escapeHtml(vimeoId)}" allowfullscreen></iframe></div>`
              : `<div class="course-editor__video-preview" style="display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.82rem;background:#f1f5f9">Video preview</div>`
          }
          ${captionHtml ? `<div class="course-editor__prose" style="margin-top:0.65rem;font-size:0.92rem">${captionHtml}</div>` : ""}
        </div>
      `;
    })
    .join("");

  preview.innerHTML = `
    <div class="course-preview__three-videos-layout">
      ${blockTitle ? `<h3 style="margin:0 0 0.75rem;font-size:1.05rem;font-weight:700">${escapeHtml(blockTitle)}</h3>` : ""}
      ${introHtml ? `<div class="course-editor__prose" style="margin-bottom:1rem">${introHtml}</div>` : ""}
      <div class="course-editor__layout-preview three-videos-layout__row" style="display:flex;gap:1.5rem;flex-wrap:wrap;margin:1rem 0">
        ${columns}
      </div>
      ${outroHtml ? `<div class="course-editor__prose" style="margin-top:0.5rem">${outroHtml}</div>` : ""}
    </div>
  `;
}

function updateCombineNextButton() {
  const btn = dom.editFields?.querySelector("#ce-tv-combine-next") as HTMLButtonElement | null;
  if (!btn || !contentEditingRef) return;
  const next = getNextPlainTextItem(contentEditingRef);
  btn.hidden = !next;
}

function resolvePreviewAssetUrl(src: string) {
  const trimmed = src.trim();
  if (!trimmed) return "";
  if (/^data:/i.test(trimmed)) return trimmed;
  return legacyAssetUrl(trimmed);
}

function applyTextImagePatch(patch: {
  header?: string | null;
  textHtml?: string;
  src?: string;
  alt?: string;
  caption?: string | null;
  linkUrl?: string | null;
  imagePosition?: "left" | "right";
}) {
  if (!selectedLessonSlug || !contentEditingRef) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;
  const block = findBlock(lesson, contentEditingRef.blockSlug);
  if (!block || !isTextImageLayoutBlock(block)) return;
  const parts = getTextImageLayoutParts(block);
  if (!parts) return;

  if (patch.textHtml !== undefined) {
    parts.text.html = patch.textHtml;
    parts.text.layoutRole = TEXT_IMAGE_TEXT_ROLE;
  }

  if (patch.src !== undefined) parts.image.src = patch.src;
  if (patch.alt !== undefined) parts.image.alt = patch.alt;
  if (patch.caption !== undefined) {
    parts.image.caption = imageCaptionHasContent(patch.caption) ? patch.caption : null;
  }
  if (patch.linkUrl !== undefined) {
    setOptionalLinkUrl(parts.image, patch.linkUrl);
  }
  parts.image.layoutRole = TEXT_IMAGE_IMAGE_ROLE;

  if (patch.imagePosition !== undefined || patch.header !== undefined) {
    block.layoutOptions = {
      ...(block.layoutOptions as Record<string, unknown> | undefined),
      ...(patch.imagePosition !== undefined ? { imagePosition: patch.imagePosition } : {}),
      ...(patch.header !== undefined
        ? { header: layoutHeaderHasContent(patch.header) ? patch.header : null }
        : {}),
    };
  }

  if (patch.header !== undefined) {
    block.title = layoutHeaderHasContent(patch.header)
      ? String(patch.header).trim()
      : "Text + Image";
  }

  setLessonDraft(selectedLessonSlug, lesson);
  renderContentList();
  updateTextImageLayoutPreview();
  updateSaveState();
}

function updateTextImageLayoutPreview() {
  const preview = dom.editFields?.querySelector("#ce-ti-layout-preview") as HTMLElement | null;
  if (!preview || !selectedLessonSlug || !contentEditingRef) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  const block = lesson ? findBlock(lesson, contentEditingRef.blockSlug) : null;
  const parts = block ? getTextImageLayoutParts(block) : null;
  if (!parts || !block) return;

  const imagePosition = getImagePosition(block);
  const header = getLayoutHeader(block);
  const textHtml = rewriteLegacyHtml(
    unwrapTextVideoColumnHtml(String(parts.text.html ?? "")),
  );
  const src = String(parts.image.src ?? "").trim();
  const alt = String(parts.image.alt ?? "");
  const caption = parts.image.caption;
  const linkUrl = parts.image.linkUrl;

  preview.innerHTML = `
    <div class="course-preview__text-image-layout text-image-layout--image-${imagePosition}">
      ${
        header
          ? `<h4 class="course-preview__carousel-title text-image-layout__title">${escapeHtml(header)}</h4>`
          : ""
      }
      <div class="lesson-media-row course-editor__layout-preview text-image-layout__row">
        <div class="text-image-layout__text lesson-text course-editor__prose">
          ${textHtml || "<p><em>Text preview</em></p>"}
        </div>
        <figure class="text-image-layout__image">
          ${linkedImagePreviewHtml(src, alt, linkUrl, "text-image-layout__img")}
          ${
            imageCaptionHasContent(caption)
              ? `<figcaption class="text-image-layout__caption">${escapeHtml(String(caption))}</figcaption>`
              : ""
          }
        </figure>
      </div>
    </div>
  `;
}

function applyContentPatch(patch: Record<string, unknown>) {
  if (!selectedLessonSlug || !contentEditingRef) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;
  const block = findBlock(lesson, contentEditingRef.blockSlug);
  if (!block) return;
  const index = findComponentIndex(
    block,
    contentEditingRef.legacyComponentId,
    contentEditingRef.type,
  );
  if (index === -1) return;
  const target = (block.components as Record<string, unknown>[])[index]!;
  const { linkUrl, ...rest } = patch;
  Object.assign(target, rest);
  if (Object.prototype.hasOwnProperty.call(patch, "linkUrl")) {
    setOptionalLinkUrl(target, linkUrl);
  }
  setLessonDraft(selectedLessonSlug, lesson);
  renderContentList();
  updateSaveState();
}

function hideEditFormPanel() {
  if (dom.editForm) dom.editForm.hidden = true;
  if (dom.editEmpty) dom.editEmpty.hidden = false;
  refreshSnippetInsertButtons();
}

function mountRichTextEditor(
  container: HTMLElement,
  html: string,
  onChange: (html: string) => void = (value) => applyContentPatch({ html: value }),
  options: { tabs?: ("visual" | "html" | "preview")[] } = {},
) {
  const allowedTabs = options.tabs ?? ["visual", "html", "preview"];
  let tab: "visual" | "html" | "preview" = allowedTabs.includes("visual")
    ? "visual"
    : allowedTabs[0] ?? "html";
  let value = html;

  const render = () => {
    const tabButtons = allowedTabs
      .map((id) => {
        const label = id === "visual" ? "Write" : id === "html" ? "HTML" : "Preview";
        return `<button type="button" class="course-editor__rt-tab ${tab === id ? "is-active" : ""}" data-rt-tab="${id}">${label}</button>`;
      })
      .join("");

    container.innerHTML = `
      <div class="course-editor__rt-tabs">${tabButtons}</div>
      <div data-rt-body></div>
    `;

    const body = container.querySelector("[data-rt-body]") as HTMLElement;
    if (!body) return;

    if (tab === "visual") {
      body.innerHTML = `
        <div class="course-editor__rt-visual-wrap">
          <div class="course-editor__rt-toolbar">
            <button type="button" class="course-editor__icon-btn" data-cmd="bold" title="Bold"><b>B</b></button>
            <button type="button" class="course-editor__icon-btn" data-cmd="italic" title="Italic"><i>I</i></button>
            <button type="button" class="course-editor__icon-btn" data-cmd="formatBlock" data-arg="h2" title="Heading">H</button>
            <button type="button" class="course-editor__icon-btn" data-cmd="insertUnorderedList" title="Bullet list">•</button>
            <button type="button" class="course-editor__icon-btn" data-cmd="insertOrderedList" title="Numbered list">1.</button>
            <button type="button" class="course-editor__icon-btn course-editor__icon-btn--label" data-cmd="justifyCenter" title="Center align">Center</button>
            <button type="button" class="course-editor__icon-btn" data-cmd="link" title="Link">🔗</button>
            <button type="button" class="course-editor__icon-btn" data-cmd="removeFormat" title="Clear">⌫</button>
          </div>
          <div class="course-editor__rt-visual course-editor__prose" contenteditable="true"></div>
        </div>
      `;
      const visual = body.querySelector(".course-editor__rt-visual") as HTMLElement;
      visual.innerHTML = value || "";
      visual.addEventListener("input", () => {
        value = visual.innerHTML;
        onChange(value);
      });
      body.querySelectorAll("[data-cmd]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const cmd = btn.getAttribute("data-cmd");
          if (cmd === "link") {
            const url = window.prompt("Link address (https://…)");
            if (url) document.execCommand("createLink", false, url);
          } else if (cmd === "formatBlock") {
            document.execCommand("formatBlock", false, btn.getAttribute("data-arg") ?? "h2");
          } else if (cmd) {
            document.execCommand(cmd, false);
          }
          visual.focus();
          value = visual.innerHTML;
          onChange(value);
        });
      });
    } else if (tab === "html") {
      body.innerHTML = `<textarea class="course-editor__textarea course-editor__textarea--rt-html" spellcheck="false"></textarea>`;
      const textarea = body.querySelector("textarea") as HTMLTextAreaElement;
      textarea.value = value;
      textarea.addEventListener("input", () => {
        value = textarea.value;
        onChange(value);
      });
    } else {
      body.innerHTML = `<div class="course-editor__rt-preview course-editor__prose">${rewriteLegacyHtml(value) || "<p class='text-slate-400'>Nothing yet.</p>"}</div>`;
    }

    container.querySelectorAll("[data-rt-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (tab === "visual") {
          const visual = container.querySelector(".course-editor__rt-visual") as HTMLElement | null;
          if (visual) value = visual.innerHTML;
        } else if (tab === "html") {
          const textarea = container.querySelector("textarea") as HTMLTextAreaElement | null;
          if (textarea) value = textarea.value;
        }
        const nextTab = btn.getAttribute("data-rt-tab") as "visual" | "html" | "preview";
        if (allowedTabs.includes(nextTab)) tab = nextTab;
        render();
      });
    });
  };

  render();
}

function renderListEditor(
  container: HTMLElement,
  options: {
    items: Record<string, unknown>[];
    addLabel: string;
    makeNew: () => Record<string, unknown>;
    renderRow: (item: Record<string, unknown>, index: number) => string;
    onChange: (items: Record<string, unknown>[]) => void;
  },
) {
  const { items, addLabel, makeNew, renderRow, onChange } = options;

  const paint = () => {
    container.innerHTML =
      items.length === 0
        ? `<p class="course-editor__panel-empty" style="min-height:auto;padding:1rem">Nothing here yet.</p>`
        : items
            .map(
              (item, i) => `
        <div class="course-editor__list-card" data-list-index="${i}">
          <div class="course-editor__list-card-actions">
            <button type="button" class="course-editor__icon-btn" data-list-up="${i}" ${i === 0 ? "disabled" : ""} title="Move up">↑</button>
            <button type="button" class="course-editor__icon-btn" data-list-down="${i}" ${i === items.length - 1 ? "disabled" : ""} title="Move down">↓</button>
            <button type="button" class="course-editor__icon-btn is-danger" data-list-remove="${i}" title="Remove">✕</button>
          </div>
          ${renderRow(item, i)}
        </div>
      `,
            )
            .join("") +
          `<button type="button" class="course-editor__list-add" data-list-add>+ ${escapeHtml(addLabel)}</button>`;

    container.querySelectorAll("[data-list-up]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-list-up"));
        if (i <= 0) return;
        const next = [...items];
        [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
        onChange(next);
      });
    });
    container.querySelectorAll("[data-list-down]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-list-down"));
        if (i >= items.length - 1) return;
        const next = [...items];
        [next[i], next[i + 1]] = [next[i + 1]!, next[i]!];
        onChange(next);
      });
    });
    container.querySelectorAll("[data-list-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-list-remove"));
        onChange(items.filter((_, j) => j !== i));
      });
    });
    container.querySelector("[data-list-add]")?.addEventListener("click", () => {
      onChange([...items, makeNew()]);
    });
  };

  paint();
}

function openContentEdit(ref: ComponentRef) {
  expandSection(ref.blockSlug);
  if (ref.type === TEXT_VIDEO_LAYOUT_TYPE) {
    openTextVideoLayoutEdit(ref);
    return;
  }

  if (ref.type === TEXT_IMAGE_LAYOUT_TYPE) {
    openTextImageLayoutEdit(ref);
    return;
  }

  if (ref.type === THREE_VIDEOS_LAYOUT_TYPE) {
    openThreeVideosLayoutEdit(ref);
    return;
  }

  if (ref.type === "exerciseAccordion" && selectedLessonSlug) {
    const lesson = getLessonDraft(selectedLessonSlug);
    if (lesson && isAccordionLayoutItem(ref, lesson)) {
      openAccordionLayoutEdit(ref);
      return;
    }
  }

  if (ref.type === "embeddedTool" && selectedLessonSlug) {
    const lesson = getLessonDraft(selectedLessonSlug);
    if (lesson && isEmbeddedToolLayoutItem(ref, lesson)) {
      openEmbeddedToolLayoutEdit(ref);
      return;
    }
  }

  const component = getContentComponent(ref);
  if (!component || !dom.editForm || !dom.editEmpty || !dom.editFields || !dom.editHead) return;

  contentEditingRef = { ...ref };
  dom.editEmpty.hidden = true;
  dom.editForm.hidden = false;
  refreshSnippetInsertButtons();

  const meta = typeMeta(imageEditorKind(component));
  dom.editHead.innerHTML = `
    <span class="course-editor__item-icon" style="background:${meta.color}22;color:${meta.color}">${meta.abbrev}</span>
    <h3 class="course-editor__panel-title">Editing ${meta.label.toLowerCase()}</h3>
  `;

  dom.editFields.innerHTML = "";

  const lesson = selectedLessonSlug ? getLessonDraft(selectedLessonSlug) : null;

  if (component.type === "richText") {
    const block = lesson ? findBlock(lesson, ref.blockSlug) : null;
    dom.editFields.innerHTML = `
      <label class="course-editor__field"><span class="course-editor__field-label">Section title</span>
        <input class="course-editor__input" id="ce-rt-section-title" type="text" placeholder="Optional heading shown above this block">
        <span class="course-editor__field-hint">Shown as the block heading on the lesson page. Leave blank for no heading.</span></label>
      <div class="course-editor__field">
        <span class="course-editor__field-label">Text</span>
        <div id="ce-rt-body-editor"></div>
      </div>
    `;
    const sectionTitleEl = dom.editFields.querySelector("#ce-rt-section-title") as HTMLInputElement;
    sectionTitleEl.value = block ? blockTitleForEditing(block.title) : "";
    sectionTitleEl.addEventListener("input", () => {
      applyBlockSectionTitle(ref.blockSlug, sectionTitleEl.value);
    });
    mountRichTextEditor(
      dom.editFields.querySelector("#ce-rt-body-editor") as HTMLElement,
      String(component.html ?? ""),
    );
  } else if (component.type === "video") {
    dom.editFields.innerHTML = `
      <label class="course-editor__field"><span class="course-editor__field-label">Title</span>
        <input class="course-editor__input" id="ce-video-title" type="text" placeholder="What the video shows"></label>
      <label class="course-editor__field"><span class="course-editor__field-label">Vimeo ID</span>
        <input class="course-editor__input" id="ce-video-id" type="text" placeholder="76979871">
        <span class="course-editor__field-hint">The number from the video URL</span></label>
      <div id="ce-video-preview" class="course-editor__video-preview" hidden></div>
    `;
    const titleEl = dom.editFields.querySelector("#ce-video-title") as HTMLInputElement;
    const idEl = dom.editFields.querySelector("#ce-video-id") as HTMLInputElement;
    const preview = dom.editFields.querySelector("#ce-video-preview") as HTMLElement;
    titleEl.value = String(component.title ?? "");
    idEl.value = String(component.vimeoId ?? "");
    const sync = () => {
      applyContentPatch({ title: titleEl.value || null, vimeoId: idEl.value.trim() });
      if (idEl.value.trim()) {
        preview.hidden = false;
        preview.innerHTML = `<iframe title="Video preview" src="https://player.vimeo.com/video/${escapeHtml(idEl.value.trim())}" allowfullscreen></iframe>`;
      } else {
        preview.hidden = true;
        preview.innerHTML = "";
      }
    };
    titleEl.addEventListener("input", sync);
    idEl.addEventListener("input", sync);
    sync();
  } else if (component.type === "download") {
    dom.editFields.innerHTML = `
      <label class="course-editor__field"><span class="course-editor__field-label">Label</span>
        <input class="course-editor__input" id="ce-dl-label" type="text" placeholder="Setup checklist (PDF)">
        <span class="course-editor__field-hint">What the learner sees on the button</span></label>
      <label class="course-editor__field"><span class="course-editor__field-label">File path</span>
        <input class="course-editor__input" id="ce-dl-file" type="text" placeholder="downloads/quickstart_checklist.pdf">
        <span class="course-editor__field-hint">Stored exactly as entered — e.g. downloads/file.pdf or legacy filename only</span></label>
    `;
    const labelEl = dom.editFields.querySelector("#ce-dl-label") as HTMLInputElement;
    const fileEl = dom.editFields.querySelector("#ce-dl-file") as HTMLInputElement;
    labelEl.value = String(component.label ?? "");
    fileEl.value = String(component.filename ?? "");
    labelEl.addEventListener("input", () =>
      applyContentPatch({ label: labelEl.value, filename: fileEl.value }),
    );
    fileEl.addEventListener("input", () =>
      applyContentPatch({ label: labelEl.value, filename: fileEl.value }),
    );
  } else if (component.type === "image") {
    dom.editFields.innerHTML = `
      <label class="course-editor__field"><span class="course-editor__field-label">Image path</span>
        <input class="course-editor__input" id="ce-image-src" type="text" placeholder="/images/example.webp">
        <span class="course-editor__field-hint">Site path or full URL</span></label>
      <label class="course-editor__field"><span class="course-editor__field-label">Alt text</span>
        <input class="course-editor__input" id="ce-image-alt" type="text" placeholder="Describe the image"></label>
      <label class="course-editor__field"><span class="course-editor__field-label">Caption (optional)</span>
        <input class="course-editor__input" id="ce-image-caption" type="text" placeholder="Shown below the image when filled in">
        <span class="course-editor__field-hint">Leave blank for a plain image.</span></label>
      <label class="course-editor__field"><span class="course-editor__field-label">Link URL</span>
        <input class="course-editor__input" id="ce-image-link" type="text" placeholder="/patterns/diy-blanket">
        <span class="course-editor__field-hint">Optional. Leave blank for no link.</span></label>
      <div class="course-editor__field">
        <span class="course-editor__field-label">Preview</span>
        <div id="ce-image-preview"></div>
      </div>
    `;
    const srcEl = dom.editFields.querySelector("#ce-image-src") as HTMLInputElement;
    const altEl = dom.editFields.querySelector("#ce-image-alt") as HTMLInputElement;
    const captionEl = dom.editFields.querySelector("#ce-image-caption") as HTMLInputElement;
    const linkEl = dom.editFields.querySelector("#ce-image-link") as HTMLInputElement;
    const preview = dom.editFields.querySelector("#ce-image-preview") as HTMLElement;
    srcEl.value = String(component.src ?? "");
    altEl.value = String(component.alt ?? "");
    captionEl.value = imageCaptionHasContent(component.caption)
      ? String(component.caption)
      : "";
    linkEl.value = normalizeImageLinkUrl(component.linkUrl) ?? "";

    const syncImage = () => {
      applyContentPatch({
        src: srcEl.value.trim(),
        alt: altEl.value,
        caption: imageCaptionHasContent(captionEl.value) ? captionEl.value : null,
        linkUrl: linkEl.value,
      });
      preview.innerHTML = linkedImagePreviewHtml(
        srcEl.value.trim(),
        altEl.value,
        linkEl.value,
        "course-preview__image-img",
      );
      const head = dom.editHead;
      if (head) {
        const meta = typeMeta(imageEditorKind(getContentComponent(contentEditingRef)!));
        head.innerHTML = `
          <span class="course-editor__item-icon" style="background:${meta.color}22;color:${meta.color}">${meta.abbrev}</span>
          <h3 class="course-editor__panel-title">Editing ${meta.label.toLowerCase()}</h3>
        `;
      }
    };

    srcEl.addEventListener("input", syncImage);
    altEl.addEventListener("input", syncImage);
    captionEl.addEventListener("input", syncImage);
    linkEl.addEventListener("input", syncImage);
    syncImage();
  } else if (component.type === "exerciseAccordion") {
    const wrap = document.createElement("div");
    dom.editFields.appendChild(wrap);
    const sections = (Array.isArray(component.sections)
      ? component.sections
      : []) as Record<string, unknown>[];

    const paintAccordion = (list: Record<string, unknown>[]) => {
      renderListEditor(wrap, {
        items: list,
        addLabel: "Add section",
        makeNew: () => ({ title: "New section", bodyHtml: "<p></p>", iconSrc: "" }),
        renderRow: (section) => `
          <input class="course-editor__input" style="margin-bottom:0.4rem;font-weight:600" data-acc-title value="${escapeHtml(String(section.title ?? ""))}" placeholder="Section title">
          <textarea class="course-editor__textarea" data-acc-body placeholder="Section body HTML">${escapeHtml(String(section.bodyHtml ?? ""))}</textarea>
        `,
        onChange: (next) => {
          applyContentPatch({ sections: next });
          paintAccordion(next);
        },
      });
      wrap.querySelectorAll("[data-acc-title]").forEach((input, i) => {
        input.addEventListener("input", () => {
          const comp = getContentComponent(contentEditingRef);
          if (!comp || !Array.isArray(comp.sections)) return;
          const rows = comp.sections as Record<string, unknown>[];
          if (!rows[i]) return;
          rows[i]!.title = (input as HTMLInputElement).value;
          applyContentPatch({ sections: rows });
        });
      });
      wrap.querySelectorAll("[data-acc-body]").forEach((textarea, i) => {
        textarea.addEventListener("input", () => {
          const comp = getContentComponent(contentEditingRef);
          if (!comp || !Array.isArray(comp.sections)) return;
          const rows = comp.sections as Record<string, unknown>[];
          if (!rows[i]) return;
          rows[i]!.bodyHtml = (textarea as HTMLTextAreaElement).value;
          applyContentPatch({ sections: rows });
        });
      });
    };
    paintAccordion([...sections]);
  } else if (component.type === "imageGallery") {
    const wrap = document.createElement("div");
    dom.editFields.appendChild(wrap);
    const slides = (Array.isArray(component.slides) ? component.slides : []) as Record<
      string,
      unknown
    >[];

    const paintGallery = (list: Record<string, unknown>[]) => {
      renderListEditor(wrap, {
        items: list,
        addLabel: "Add image",
        makeNew: () => ({ src: "", caption: "" }),
        renderRow: (slide) => `
          <div class="course-editor__gallery-row">
            <div class="course-editor__gallery-thumb">${slide.src ? `<img src="${escapeHtml(String(slide.src))}" alt="">` : "img"}</div>
            <div style="flex:1">
              <input class="course-editor__input" style="margin-bottom:0.4rem" data-gal-src value="${escapeHtml(String(slide.src ?? ""))}" placeholder="Image path or URL">
              <input class="course-editor__input" style="margin-bottom:0.4rem" data-gal-cap value="${escapeHtml(String(slide.caption ?? ""))}" placeholder="Caption">
              <label class="course-editor__field" style="margin:0">
                <span class="course-editor__field-label">Link URL</span>
                <input class="course-editor__input" data-gal-link value="${escapeHtml(String(slide.linkUrl ?? ""))}" placeholder="/patterns/diy-blanket">
              </label>
            </div>
          </div>
        `,
        onChange: (next) => {
          applyContentPatch({ slides: next });
          paintGallery(next);
        },
      });
      wrap.querySelectorAll("[data-gal-src]").forEach((input, i) => {
        input.addEventListener("input", () => {
          const comp = getContentComponent(contentEditingRef);
          if (!comp || !Array.isArray(comp.slides)) return;
          const rows = comp.slides as Record<string, unknown>[];
          if (!rows[i]) return;
          rows[i]!.src = (input as HTMLInputElement).value;
          applyContentPatch({ slides: rows });
        });
      });
      wrap.querySelectorAll("[data-gal-cap]").forEach((input, i) => {
        input.addEventListener("input", () => {
          const comp = getContentComponent(contentEditingRef);
          if (!comp || !Array.isArray(comp.slides)) return;
          const rows = comp.slides as Record<string, unknown>[];
          if (!rows[i]) return;
          rows[i]!.caption = (input as HTMLInputElement).value;
          applyContentPatch({ slides: rows });
        });
      });
      wrap.querySelectorAll("[data-gal-link]").forEach((input, i) => {
        input.addEventListener("input", () => {
          const comp = getContentComponent(contentEditingRef);
          if (!comp || !Array.isArray(comp.slides)) return;
          const rows = comp.slides as Record<string, unknown>[];
          if (!rows[i]) return;
          setOptionalLinkUrl(rows[i]!, (input as HTMLInputElement).value);
          applyContentPatch({ slides: rows });
        });
      });
    };
    paintGallery([...slides]);
  } else if (component.type === "imageCarousel") {
    const titleField = document.createElement("label");
    titleField.className = "course-editor__field";
    titleField.innerHTML = `
      <span class="course-editor__field-label">Carousel title</span>
      <input class="course-editor__input" id="ce-carousel-title" type="text" placeholder="Optional heading above the slides">
    `;
    dom.editFields.appendChild(titleField);
    const titleEl = titleField.querySelector("#ce-carousel-title") as HTMLInputElement;
    titleEl.value = String(component.title ?? "");
    titleEl.addEventListener("input", () => {
      applyContentPatch({ title: titleEl.value.trim() || null });
    });

    const wrap = document.createElement("div");
    dom.editFields.appendChild(wrap);
    const slides = (Array.isArray(component.slides) ? component.slides : []) as Record<
      string,
      unknown
    >[];

    const paintCarousel = (list: Record<string, unknown>[]) => {
      renderListEditor(wrap, {
        items: list,
        addLabel: "Add slide",
        makeNew: () => ({ src: "", alt: "", caption: "" }),
        renderRow: (slide) => `
          <div class="course-editor__gallery-row">
            <div class="course-editor__gallery-thumb">${slide.src ? `<img src="${escapeHtml(String(slide.src))}" alt="">` : "img"}</div>
            <div style="flex:1">
              <input class="course-editor__input" style="margin-bottom:0.4rem" data-car-src value="${escapeHtml(String(slide.src ?? ""))}" placeholder="Image path, e.g. /challenge/images/v2/50/yarn-ball-1.jpg">
              <input class="course-editor__input" style="margin-bottom:0.4rem" data-car-alt value="${escapeHtml(String(slide.alt ?? ""))}" placeholder="Alt text">
              <input class="course-editor__input" data-car-cap value="${escapeHtml(String(slide.caption ?? ""))}" placeholder="Caption">
            </div>
          </div>
        `,
        onChange: (next) => {
          applyContentPatch({ slides: next });
          paintCarousel(next);
        },
      });
      wrap.querySelectorAll("[data-car-src]").forEach((input, i) => {
        input.addEventListener("input", () => {
          const comp = getContentComponent(contentEditingRef);
          if (!comp || !Array.isArray(comp.slides)) return;
          const rows = comp.slides as Record<string, unknown>[];
          if (!rows[i]) return;
          rows[i]!.src = (input as HTMLInputElement).value;
          applyContentPatch({ slides: rows });
        });
      });
      wrap.querySelectorAll("[data-car-alt]").forEach((input, i) => {
        input.addEventListener("input", () => {
          const comp = getContentComponent(contentEditingRef);
          if (!comp || !Array.isArray(comp.slides)) return;
          const rows = comp.slides as Record<string, unknown>[];
          if (!rows[i]) return;
          rows[i]!.alt = (input as HTMLInputElement).value;
          applyContentPatch({ slides: rows });
        });
      });
      wrap.querySelectorAll("[data-car-cap]").forEach((input, i) => {
        input.addEventListener("input", () => {
          const comp = getContentComponent(contentEditingRef);
          if (!comp || !Array.isArray(comp.slides)) return;
          const rows = comp.slides as Record<string, unknown>[];
          if (!rows[i]) return;
          rows[i]!.caption = (input as HTMLInputElement).value;
          applyContentPatch({ slides: rows });
        });
      });
    };
    paintCarousel([...slides]);
  } else {
    dom.editFields.innerHTML = `
      <label class="course-editor__field"><span class="course-editor__field-label">Component data (JSON)</span>
        <textarea class="course-editor__textarea" id="ce-raw-component" spellcheck="false"></textarea></label>
    `;
    const jsonEl = dom.editFields.querySelector("#ce-raw-component") as HTMLTextAreaElement;
    jsonEl.value = JSON.stringify(component, null, 2);
    jsonEl.addEventListener("input", () => {
      try {
        const parsed = JSON.parse(jsonEl.value) as Record<string, unknown>;
        if (!selectedLessonSlug || !contentEditingRef) return;
        const lesson = getLessonDraft(selectedLessonSlug);
        const block = findBlock(lesson!, contentEditingRef.blockSlug);
        if (!block) return;
        const index = findComponentIndex(
          block,
          contentEditingRef.legacyComponentId,
          contentEditingRef.type,
        );
        if (index === -1) return;
        (block.components as Record<string, unknown>[])[index] = parsed;
        contentEditingRef = {
          blockSlug: contentEditingRef.blockSlug,
          legacyComponentId: Number(parsed.legacyComponentId),
          type: String(parsed.type),
        };
        setLessonDraft(selectedLessonSlug, lesson!);
        renderContentList();
        updateSaveState();
      } catch {
        /* typing */
      }
    });
  }

  renderContentList();
}

function openAccordionLayoutEdit(ref: ComponentRef) {
  if (!selectedLessonSlug || !dom.editForm || !dom.editEmpty || !dom.editFields || !dom.editHead) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  const block = lesson ? findBlock(lesson, ref.blockSlug) : null;
  const parts = block ? getAccordionLayoutParts(block) : null;
  if (!parts) return;

  contentEditingRef = { ...ref };
  dom.editEmpty.hidden = true;
  dom.editForm.hidden = false;
  refreshSnippetInsertButtons();

  const meta = typeMeta("exerciseAccordion");
  dom.editHead.innerHTML = `
    <span class="course-editor__item-icon" style="background:${meta.color}22;color:${meta.color}">${meta.abbrev}</span>
    <h3 class="course-editor__panel-title">Editing ${meta.label.toLowerCase()}</h3>
  `;

  dom.editFields.innerHTML = `
    <div class="course-editor__field">
      <span class="course-editor__field-label">Optional intro text</span>
      <span class="course-editor__field-hint" style="margin-bottom:0.35rem">Leave blank to hide on the lesson page.</span>
      <div id="ce-acc-intro-editor"></div>
    </div>
    <div class="course-editor__field">
      <span class="course-editor__field-label">Accordion sections</span>
      <div id="ce-acc-sections-editor"></div>
    </div>
    <button type="button" id="ce-acc-combine-prev" class="course-editor__list-add" hidden>
      Combine with previous text item
    </button>
  `;

  const introWrap = dom.editFields.querySelector("#ce-acc-intro-editor") as HTMLElement;
  mountRichTextEditor(
    introWrap,
    String(parts.introText?.html ?? ""),
    (html) => applyAccordionPatch({ introHtml: html }),
    { tabs: ["html", "preview"] },
  );

  const sectionsWrap = dom.editFields.querySelector("#ce-acc-sections-editor") as HTMLElement;
  const paintAccordionSections = (list: Record<string, unknown>[]) => {
    renderListEditor(sectionsWrap, {
      items: list,
      addLabel: "Add section",
      makeNew: () => ({ title: "New section", bodyHtml: "<p></p>", iconSrc: "" }),
      renderRow: (section) => `
        <input class="course-editor__input" style="margin-bottom:0.4rem;font-weight:600" data-acc-title value="${escapeHtml(String(section.title ?? ""))}" placeholder="Section title">
        <textarea class="course-editor__textarea" data-acc-body placeholder="Section body HTML">${escapeHtml(String(section.bodyHtml ?? ""))}</textarea>
      `,
      onChange: (next) => {
        applyAccordionPatch({ sections: next });
        paintAccordionSections(next);
      },
    });
    sectionsWrap.querySelectorAll("[data-acc-title]").forEach((input, i) => {
      input.addEventListener("input", () => {
        const lessonDraft = selectedLessonSlug ? getLessonDraft(selectedLessonSlug) : null;
        const blockDraft = lessonDraft ? findBlock(lessonDraft, ref.blockSlug) : null;
        const layoutParts = blockDraft ? getAccordionLayoutParts(blockDraft) : null;
        if (!layoutParts || !Array.isArray(layoutParts.accordion.sections)) return;
        const rows = layoutParts.accordion.sections as Record<string, unknown>[];
        if (!rows[i]) return;
        rows[i]!.title = (input as HTMLInputElement).value;
        applyAccordionPatch({ sections: rows });
      });
    });
    sectionsWrap.querySelectorAll("[data-acc-body]").forEach((textarea, i) => {
      textarea.addEventListener("input", () => {
        const lessonDraft = selectedLessonSlug ? getLessonDraft(selectedLessonSlug) : null;
        const blockDraft = lessonDraft ? findBlock(lessonDraft, ref.blockSlug) : null;
        const layoutParts = blockDraft ? getAccordionLayoutParts(blockDraft) : null;
        if (!layoutParts || !Array.isArray(layoutParts.accordion.sections)) return;
        const rows = layoutParts.accordion.sections as Record<string, unknown>[];
        if (!rows[i]) return;
        rows[i]!.bodyHtml = (textarea as HTMLTextAreaElement).value;
        applyAccordionPatch({ sections: rows });
      });
    });
  };

  const sections = (Array.isArray(parts.accordion.sections)
    ? parts.accordion.sections
    : []) as Record<string, unknown>[];
  paintAccordionSections([...sections]);

  dom.editFields.querySelector("#ce-acc-combine-prev")?.addEventListener("click", () => {
    combineWithPreviousTextItem(ref);
  });

  updateCombinePreviousButton();
  renderContentList();
}

function openEmbeddedToolLayoutEdit(ref: ComponentRef) {
  if (!selectedLessonSlug || !dom.editForm || !dom.editEmpty || !dom.editFields || !dom.editHead) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  const block = lesson ? findBlock(lesson, ref.blockSlug) : null;
  const parts = block ? getEmbeddedToolLayoutParts(block) : null;
  if (!parts) return;

  contentEditingRef = { ...ref };
  dom.editEmpty.hidden = true;
  dom.editForm.hidden = false;
  refreshSnippetInsertButtons();

  const availableTools = availableEmbeddedToolsForContext("course");
  const currentKey = String(parts.tool.toolKey ?? "").trim();
  const optionsHtml = availableTools
    .map(
      (tool) =>
        `<option value="${escapeHtml(tool.key)}"${tool.key === currentKey ? " selected" : ""}>${escapeHtml(tool.name)}</option>`,
    )
    .join("");
  const selectedEntry = getEmbeddedToolByKey(currentKey);
  const meta = typeMeta("embeddedTool");

  dom.editHead.innerHTML = `
    <span class="course-editor__item-icon" style="background:${meta.color}22;color:${meta.color}">${meta.abbrev}</span>
    <h3 class="course-editor__panel-title">Editing ${meta.label.toLowerCase()}</h3>
  `;

  dom.editFields.innerHTML = `
    <label class="course-editor__field"><span class="course-editor__field-label">Section title</span>
      <input class="course-editor__input" id="ce-et-section-title" type="text" placeholder="Optional heading shown above this block">
      <span class="course-editor__field-hint">Shown as the block heading on the lesson page. Leave blank for no heading.</span></label>
    <div class="course-editor__field">
      <span class="course-editor__field-label">Optional intro text</span>
      <span class="course-editor__field-hint" style="margin-bottom:0.35rem">Shown above the tool on the lesson page. Leave blank to hide.</span>
      <div id="ce-et-intro-editor"></div>
    </div>
    <label class="course-editor__field"><span class="course-editor__field-label">Tool</span>
      <select class="course-editor__input" id="ce-et-tool-key"${availableTools.length === 0 ? " disabled" : ""}>
        ${optionsHtml || `<option value="">No available tools</option>`}
      </select>
      <span class="course-editor__field-hint">Only tools marked available in the embedded tools registry.</span></label>
    ${
      selectedEntry
        ? `<p class="course-editor__field-hint" style="margin:0">
            Standalone page: <a href="${escapeHtml(selectedEntry.standalonePath)}" target="_blank" rel="noopener noreferrer">${escapeHtml(selectedEntry.standalonePath)}</a>
            · <a href="/admin/embedded-tools" target="_blank" rel="noopener noreferrer">View registry</a>
          </p>`
        : `<p class="course-editor__field-hint" style="margin:0">
            <a href="/admin/embedded-tools" target="_blank" rel="noopener noreferrer">View embedded tools registry</a>
          </p>`
    }
  `;

  const sectionTitleEl = dom.editFields.querySelector("#ce-et-section-title") as HTMLInputElement;
  sectionTitleEl.value = block ? blockTitleForEditing(block.title) : "";
  sectionTitleEl.addEventListener("input", () => {
    applyBlockSectionTitle(ref.blockSlug, sectionTitleEl.value);
  });

  const introWrap = dom.editFields.querySelector("#ce-et-intro-editor") as HTMLElement;
  mountRichTextEditor(
    introWrap,
    String(parts.introText?.html ?? ""),
    (html) => applyEmbeddedToolPatch({ introHtml: html }),
    { tabs: ["html", "preview"] },
  );

  const toolKeyEl = dom.editFields.querySelector("#ce-et-tool-key") as HTMLSelectElement;
  toolKeyEl.addEventListener("change", () => {
    applyEmbeddedToolPatch({ toolKey: toolKeyEl.value.trim() });
    openEmbeddedToolLayoutEdit(ref);
  });

  renderContentList();
}

function openTextVideoLayoutEdit(ref: ComponentRef) {
  if (!selectedLessonSlug || !dom.editForm || !dom.editEmpty || !dom.editFields || !dom.editHead) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  const block = lesson ? findBlock(lesson, ref.blockSlug) : null;
  const parts = block ? getTextVideoLayoutParts(block) : null;
  if (!parts) return;

  contentEditingRef = { ...ref };
  dom.editEmpty.hidden = true;
  dom.editForm.hidden = false;
  refreshSnippetInsertButtons();

  const meta = typeMeta(TEXT_VIDEO_LAYOUT_TYPE);
  dom.editHead.innerHTML = `
    <span class="course-editor__item-icon" style="background:${meta.color}22;color:${meta.color}">${meta.abbrev}</span>
    <h3 class="course-editor__panel-title">Editing ${meta.label.toLowerCase()}</h3>
  `;

  dom.editFields.innerHTML = `
    <label class="course-editor__field"><span class="course-editor__field-label">Section title</span>
      <input class="course-editor__input" id="ce-tv-section-title" type="text" placeholder="Optional heading shown above this block">
      <span class="course-editor__field-hint">Shown as the block heading on the lesson page. Leave blank for no heading.</span></label>
    <div class="course-editor__field">
      <span class="course-editor__field-label">Left column text</span>
      <div id="ce-tv-left-editor"></div>
    </div>
    <div class="course-editor__field">
      <span class="course-editor__field-label">Right column video</span>
      <label class="course-editor__field"><span class="course-editor__field-label">Video title</span>
        <input class="course-editor__input" id="ce-tv-video-title" type="text" placeholder="What the video shows"></label>
      <label class="course-editor__field"><span class="course-editor__field-label">Vimeo ID</span>
        <input class="course-editor__input" id="ce-tv-video-id" type="text" placeholder="76979871">
        <span class="course-editor__field-hint">The number from the video URL</span></label>
      <div id="ce-tv-video-preview" class="course-editor__video-preview" hidden></div>
    </div>
    <div class="course-editor__field">
      <span class="course-editor__field-label">Optional text below columns</span>
      <span class="course-editor__field-hint" style="margin-bottom:0.35rem">Leave blank to hide on the lesson page.</span>
      <div id="ce-tv-bottom-editor"></div>
    </div>
    <div class="course-editor__field">
      <span class="course-editor__field-label">Layout preview</span>
      <div id="ce-tv-layout-preview"></div>
    </div>
    <button type="button" id="ce-tv-combine-next" class="course-editor__list-add" hidden>
      Combine with next text item
    </button>
  `;

  const sectionTitleEl = dom.editFields.querySelector("#ce-tv-section-title") as HTMLInputElement;
  sectionTitleEl.value = block ? blockTitleForEditing(block.title) : "";
  sectionTitleEl.addEventListener("input", () => {
    applyBlockSectionTitle(ref.blockSlug, sectionTitleEl.value);
  });

  const leftWrap = dom.editFields.querySelector("#ce-tv-left-editor") as HTMLElement;
  mountRichTextEditor(
    leftWrap,
    String(parts.leftText.html ?? ""),
    (html) => applyTextVideoPatch({ leftHtml: html }),
    { tabs: ["html", "preview"] },
  );

  const bottomWrap = dom.editFields.querySelector("#ce-tv-bottom-editor") as HTMLElement;
  mountRichTextEditor(
    bottomWrap,
    String(parts.bottomText?.html ?? ""),
    (html) => applyTextVideoPatch({ bottomHtml: html }),
    { tabs: ["html", "preview"] },
  );

  const titleEl = dom.editFields.querySelector("#ce-tv-video-title") as HTMLInputElement;
  const idEl = dom.editFields.querySelector("#ce-tv-video-id") as HTMLInputElement;
  const videoPreview = dom.editFields.querySelector("#ce-tv-video-preview") as HTMLElement;
  titleEl.value = String(parts.video.title ?? "");
  idEl.value = String(parts.video.vimeoId ?? "");

  const syncVideo = () => {
    applyTextVideoPatch({ title: titleEl.value || null, vimeoId: idEl.value.trim() });
    const vimeoId = idEl.value.trim();
    if (vimeoId) {
      videoPreview.hidden = false;
      videoPreview.innerHTML = `<iframe title="Video preview" src="https://player.vimeo.com/video/${escapeHtml(vimeoId)}" allowfullscreen></iframe>`;
    } else {
      videoPreview.hidden = true;
      videoPreview.innerHTML = "";
    }
  };
  titleEl.addEventListener("input", syncVideo);
  idEl.addEventListener("input", syncVideo);
  syncVideo();

  dom.editFields.querySelector("#ce-tv-combine-next")?.addEventListener("click", () => {
    combineWithNextTextItem(ref);
  });

  updateTextVideoLayoutPreview();
  updateCombineNextButton();
  renderContentList();
}

function openTextImageLayoutEdit(ref: ComponentRef) {
  if (!selectedLessonSlug || !dom.editForm || !dom.editEmpty || !dom.editFields || !dom.editHead) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  const block = lesson ? findBlock(lesson, ref.blockSlug) : null;
  const parts = block ? getTextImageLayoutParts(block) : null;
  if (!parts || !block) return;

  contentEditingRef = { ...ref };
  dom.editEmpty.hidden = true;
  dom.editForm.hidden = false;
  refreshSnippetInsertButtons();

  const imagePosition = getImagePosition(block);
  const layoutHeader = getLayoutHeader(block);
  const meta = typeMeta(TEXT_IMAGE_LAYOUT_TYPE);
  dom.editHead.innerHTML = `
    <span class="course-editor__item-icon" style="background:${meta.color}22;color:${meta.color}">${meta.abbrev}</span>
    <h3 class="course-editor__panel-title">Editing ${meta.label.toLowerCase()}</h3>
  `;

  dom.editFields.innerHTML = `
    <label class="course-editor__field"><span class="course-editor__field-label">Section title</span>
      <input class="course-editor__input" id="ce-ti-header" type="text" placeholder="Optional heading above this layout">
      <span class="course-editor__field-hint">Shown as a section heading in the lesson preview when filled in.</span></label>
    <div class="course-editor__field">
      <span class="course-editor__field-label">Text</span>
      <div id="ce-ti-text-editor"></div>
    </div>
    <div class="course-editor__field">
      <span class="course-editor__field-label">Image</span>
      <label class="course-editor__field"><span class="course-editor__field-label">Image path</span>
        <input class="course-editor__input" id="ce-ti-image-src" type="text" placeholder="/challenge/images/example.png">
        <span class="course-editor__field-hint">Site path or full URL</span></label>
      <label class="course-editor__field"><span class="course-editor__field-label">Alt text</span>
        <input class="course-editor__input" id="ce-ti-image-alt" type="text" placeholder="Describe the image"></label>
      <label class="course-editor__field"><span class="course-editor__field-label">Caption (optional)</span>
        <input class="course-editor__input" id="ce-ti-image-caption" type="text" placeholder="Shown below the image when filled in">
        <span class="course-editor__field-hint">Leave blank to hide on the lesson page.</span></label>
      <label class="course-editor__field"><span class="course-editor__field-label">Image Link URL</span>
        <input class="course-editor__input" id="ce-ti-image-link" type="text" placeholder="/patterns/diy-blanket">
        <span class="course-editor__field-hint">Optional. Wraps the image in a link when filled in.</span></label>
    </div>
    <fieldset class="course-editor__field">
      <legend class="course-editor__field-label">Image position</legend>
      <label class="course-editor__radio">
        <input type="radio" name="ce-ti-image-position" value="right" ${imagePosition === "right" ? "checked" : ""}>
        Image on right
      </label>
      <label class="course-editor__radio">
        <input type="radio" name="ce-ti-image-position" value="left" ${imagePosition === "left" ? "checked" : ""}>
        Image on left
      </label>
    </fieldset>
    <div class="course-editor__field">
      <span class="course-editor__field-label">Layout preview</span>
      <div id="ce-ti-layout-preview"></div>
    </div>
  `;

  const textWrap = dom.editFields.querySelector("#ce-ti-text-editor") as HTMLElement;
  mountRichTextEditor(
    textWrap,
    String(parts.text.html ?? ""),
    (html) => applyTextImagePatch({ textHtml: html }),
    { tabs: ["html", "preview"] },
  );

  const headerEl = dom.editFields.querySelector("#ce-ti-header") as HTMLInputElement;
  const srcEl = dom.editFields.querySelector("#ce-ti-image-src") as HTMLInputElement;
  const altEl = dom.editFields.querySelector("#ce-ti-image-alt") as HTMLInputElement;
  const captionEl = dom.editFields.querySelector("#ce-ti-image-caption") as HTMLInputElement;
  const linkEl = dom.editFields.querySelector("#ce-ti-image-link") as HTMLInputElement;
  headerEl.value = layoutHeader ?? "";
  srcEl.value = String(parts.image.src ?? "");
  altEl.value = String(parts.image.alt ?? "");
  captionEl.value = imageCaptionHasContent(parts.image.caption)
    ? String(parts.image.caption)
    : "";
  linkEl.value = normalizeImageLinkUrl(parts.image.linkUrl) ?? "";

  const syncImageFields = () => {
    const selected = dom.editFields?.querySelector(
      'input[name="ce-ti-image-position"]:checked',
    ) as HTMLInputElement | null;
    applyTextImagePatch({
      header: headerEl.value || null,
      src: srcEl.value.trim(),
      alt: altEl.value,
      caption: captionEl.value || null,
      linkUrl: linkEl.value || null,
      imagePosition: selected?.value === "left" ? "left" : "right",
    });
  };

  headerEl.addEventListener("input", syncImageFields);
  srcEl.addEventListener("input", syncImageFields);
  altEl.addEventListener("input", syncImageFields);
  captionEl.addEventListener("input", syncImageFields);
  linkEl.addEventListener("input", syncImageFields);
  dom.editFields.querySelectorAll('input[name="ce-ti-image-position"]').forEach((input) => {
    input.addEventListener("change", syncImageFields);
  });

  updateTextImageLayoutPreview();
  renderContentList();
}

function openThreeVideosLayoutEdit(ref: ComponentRef) {
  if (!selectedLessonSlug || !dom.editForm || !dom.editEmpty || !dom.editFields || !dom.editHead) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  const block = lesson ? findBlock(lesson, ref.blockSlug) : null;
  const parts = block ? getThreeVideosLayoutParts(block) : null;
  if (!parts || !block) return;

  contentEditingRef = { ...ref };
  dom.editEmpty.hidden = true;
  dom.editForm.hidden = false;
  refreshSnippetInsertButtons();

  const meta = typeMeta(THREE_VIDEOS_LAYOUT_TYPE);
  dom.editHead.innerHTML = `
    <span class="course-editor__item-icon" style="background:${meta.color}22;color:${meta.color}">${meta.abbrev}</span>
    <h3 class="course-editor__panel-title">Editing ${meta.label.toLowerCase()}</h3>
  `;

  const slotFields = ([1, 2, 3] as const)
    .map(
      (slot) => `
    <div class="course-editor__field course-editor__list-card">
      <span class="course-editor__field-label">Video ${slot}</span>
      <label class="course-editor__field"><span class="course-editor__field-label">Video title</span>
        <input class="course-editor__input" id="ce-3v-title-${slot}" type="text" placeholder="Video Title ${slot}"></label>
      <label class="course-editor__field"><span class="course-editor__field-label">Vimeo ID</span>
        <input class="course-editor__input" id="ce-3v-id-${slot}" type="text" placeholder="76979871">
        <span class="course-editor__field-hint">The number from the video URL</span></label>
      <div id="ce-3v-video-preview-${slot}" class="course-editor__video-preview" hidden></div>
      <span class="course-editor__field-label">Caption (optional)</span>
      <div id="ce-3v-caption-editor-${slot}"></div>
    </div>
  `,
    )
    .join("");

  dom.editFields.innerHTML = `
    <label class="course-editor__field"><span class="course-editor__field-label">Section title</span>
      <input class="course-editor__input" id="ce-3v-section-title" type="text" placeholder="Heading shown above this block">
      <span class="course-editor__field-hint">Also editable in the Section title field above the item list.</span></label>
    <div class="course-editor__field">
      <span class="course-editor__field-label">Intro text</span>
      <span class="course-editor__field-hint" style="margin-bottom:0.35rem">Optional text above the videos (not the section heading).</span>
      <div id="ce-3v-intro-editor"></div>
    </div>
    ${slotFields}
    <div class="course-editor__field">
      <span class="course-editor__field-label">Text below videos</span>
      <span class="course-editor__field-hint" style="margin-bottom:0.35rem">Leave blank to hide on the lesson page.</span>
      <div id="ce-3v-outro-editor"></div>
    </div>
    <div class="course-editor__field">
      <span class="course-editor__field-label">Layout preview</span>
      <div id="ce-3v-layout-preview"></div>
    </div>
  `;

  const sectionTitleEl = dom.editFields.querySelector("#ce-3v-section-title") as HTMLInputElement;
  sectionTitleEl.value = blockTitleForEditing(block.title);
  sectionTitleEl.addEventListener("input", () => {
    applyBlockSectionTitle(String(block.slug), sectionTitleEl.value);
    updateThreeVideosLayoutPreview();
  });

  const introWrap = dom.editFields.querySelector("#ce-3v-intro-editor") as HTMLElement;
  mountRichTextEditor(
    introWrap,
    String(parts.intro?.html ?? ""),
    (html) => applyThreeVideosPatch({ introHtml: html }),
    { tabs: ["html", "preview"] },
  );

  const outroWrap = dom.editFields.querySelector("#ce-3v-outro-editor") as HTMLElement;
  mountRichTextEditor(
    outroWrap,
    String(parts.outro?.html ?? ""),
    (html) => applyThreeVideosPatch({ outroHtml: html }),
    { tabs: ["html", "preview"] },
  );

  for (const slot of [1, 2, 3] as const) {
    const slotParts = parts.slots[slot - 1]!;
    const captionWrap = dom.editFields.querySelector(`#ce-3v-caption-editor-${slot}`) as HTMLElement;
    mountRichTextEditor(
      captionWrap,
      String(slotParts.caption?.html ?? ""),
      (html) => applyThreeVideosPatch({ slot, captionHtml: html }),
      { tabs: ["html", "preview"] },
    );

    const titleEl = dom.editFields.querySelector(`#ce-3v-title-${slot}`) as HTMLInputElement;
    const idEl = dom.editFields.querySelector(`#ce-3v-id-${slot}`) as HTMLInputElement;
    const videoPreview = dom.editFields.querySelector(
      `#ce-3v-video-preview-${slot}`,
    ) as HTMLElement;
    titleEl.value = String(slotParts.video.title ?? "");
    idEl.value = String(slotParts.video.vimeoId ?? "");

    const syncVideo = () => {
      applyThreeVideosPatch({
        slot,
        title: titleEl.value || null,
        vimeoId: idEl.value.trim(),
      });
      const vimeoId = idEl.value.trim();
      if (vimeoId) {
        videoPreview.hidden = false;
        videoPreview.innerHTML = `<iframe title="Video preview" src="https://player.vimeo.com/video/${escapeHtml(vimeoId)}" allowfullscreen></iframe>`;
      } else {
        videoPreview.hidden = true;
        videoPreview.innerHTML = "";
      }
    };
    titleEl.addEventListener("input", syncVideo);
    idEl.addEventListener("input", syncVideo);
    syncVideo();
  }

  updateThreeVideosLayoutPreview();
  renderContentList();
}

function contentItemTypeLabel(item: FlatContentItem): string {
  const kind =
    item.type === TEXT_VIDEO_LAYOUT_TYPE ||
    item.type === TEXT_IMAGE_LAYOUT_TYPE ||
    item.type === THREE_VIDEOS_LAYOUT_TYPE
      ? item.type
      : imageEditorKind(item.component);
  return typeMeta(kind).label;
}

function applyBlockSectionTitle(blockSlug: string, value: string, refreshList = true) {
  if (!selectedLessonSlug) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;
  const block = findBlock(lesson, blockSlug);
  if (!block) return;
  block.title = value;
  setLessonDraft(selectedLessonSlug, lesson);
  updateSaveState();
  syncRawTextarea();
  if (refreshList) renderContentList();
  for (const selector of [
    "#ce-3v-section-title",
    "#ce-rt-section-title",
    "#ce-tv-section-title",
    "#ce-et-section-title",
  ]) {
    const panelSectionTitle = dom.editFields?.querySelector(selector) as HTMLInputElement | null;
    if (panelSectionTitle && panelSectionTitle.value !== value) {
      panelSectionTitle.value = value;
    }
  }
  updateThreeVideosLayoutPreview();
}

function syncLessonTitleInput() {
  if (!dom.lessonTitleInput) return;
  if (!selectedLessonSlug) {
    dom.lessonTitleInput.value = "";
    dom.lessonTitleInput.disabled = true;
    return;
  }
  const lesson = getLessonDraft(selectedLessonSlug);
  dom.lessonTitleInput.disabled = !lesson;
  if (lesson) {
    dom.lessonTitleInput.value = lessonTitleForEditing(lesson.title);
  }
}

function focusLessonTitleIfPending() {
  if (!focusLessonTitlePending || !dom.lessonTitleInput || dom.lessonTitleInput.disabled) return;
  focusLessonTitlePending = false;
  dom.lessonTitleInput.focus();
  dom.lessonTitleInput.select();
}

function applyLessonTitleFromInput(rawValue: string, normalizeOnBlur = false) {
  if (!selectedLessonSlug) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;

  lesson.title = normalizeOnBlur ? normalizeLessonTitleInput(rawValue) : rawValue;
  setLessonDraft(selectedLessonSlug, lesson);
  renderLessonList();
  updateSaveState();
  syncRawTextarea();
  if (normalizeOnBlur) syncLessonTitleInput();
}

function renderContentList() {
  if (!selectedLessonSlug) {
    if (dom.itemsList) dom.itemsList.innerHTML = "";
    if (dom.itemsEmpty) {
      dom.itemsEmpty.hidden = false;
      dom.itemsEmpty.textContent = "Select a lesson to view its outline.";
    }
    syncLessonTitleInput();
    return;
  }

  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;

  syncLessonTitleInput();
  const items = flattenLessonContent(lesson);
  const { sectionCount } = countLessonSectionsAndBlocks(lesson);

  if (dom.itemsEmpty) {
    dom.itemsEmpty.hidden = sectionCount > 0;
    dom.itemsEmpty.textContent =
      "This lesson has no sections yet. Add a section to start building the outline.";
  }
  if (!dom.itemsList) return;

  const groups = buildContentListGroups(lesson, items);
  validateExpandedSectionSlug(groups);

  const sectionHtml = groups
    .map((group, groupIndex) => {
      const isExpanded = expandedSectionSlug === group.blockSlug;
      const navTitle = sectionNavLabel(
        group.blockTitle === "Untitled section" ? "" : group.blockTitle,
      );
      const sectionMoveBtns = `
        <button type="button" class="course-editor__outline-action" data-move-section-up="${groupIndex}" ${groupIndex === 0 ? "disabled" : ""} title="Move section up">↑</button>
        <button type="button" class="course-editor__outline-action" data-move-section-down="${groupIndex}" ${groupIndex === groups.length - 1 ? "disabled" : ""} title="Move section down">↓</button>
        ${
          group.canSplit
            ? `<button type="button" class="course-editor__outline-action" data-split-section="${escapeHtml(group.blockSlug)}" title="Split into separate sections">Split</button>`
            : ""
        }
        <button type="button" class="course-editor__outline-action is-danger" data-delete-section="${escapeHtml(group.blockSlug)}" title="Delete section">✕</button>
      `;

      const blocksHtml = isExpanded
        ? group.entries
            .map(({ item, index }, blockIndex) => {
              const meta = typeMeta(
                item.type === TEXT_VIDEO_LAYOUT_TYPE ||
                  item.type === TEXT_IMAGE_LAYOUT_TYPE ||
                  item.type === THREE_VIDEOS_LAYOUT_TYPE
                  ? (item.type as EditorContentKind)
                  : imageEditorKind(item.component),
              );
              const typeLabel = contentItemTypeLabel(item);
              const selected = contentItemMatches(contentEditingRef, item);
              const prevInSection = group.entries[blockIndex - 1];
              const nextInSection = group.entries[blockIndex + 1];
              return `
                <div class="course-editor__outline-block ${selected ? "is-selected" : ""}" data-item-index="${index}" draggable="true">
                  <span class="course-editor__outline-block-icon" style="background:${meta.color}1c;color:${meta.color}">${meta.abbrev}</span>
                  <div class="course-editor__outline-block-body">
                    <span class="course-editor__outline-block-type" style="color:${meta.color}">${escapeHtml(typeLabel)}</span>
                    <span class="course-editor__outline-block-summary">${escapeHtml(contentSummary(item.component))}</span>
                  </div>
                  <div class="course-editor__outline-block-actions">
                    <button type="button" class="course-editor__outline-action" data-action="edit" data-index="${index}" title="Edit block">Edit</button>
                    <button type="button" class="course-editor__outline-action" data-action="up" data-index="${index}" data-swap-index="${prevInSection ? prevInSection.index : index}" ${blockIndex === 0 ? "disabled" : ""} title="Move block up">↑</button>
                    <button type="button" class="course-editor__outline-action" data-action="down" data-index="${index}" data-swap-index="${nextInSection ? nextInSection.index : index}" ${blockIndex === group.entries.length - 1 ? "disabled" : ""} title="Move block down">↓</button>
                    <button type="button" class="course-editor__outline-action" data-action="dup" data-index="${index}" title="Duplicate block">⧉</button>
                    <button type="button" class="course-editor__outline-action is-danger" data-action="del" data-index="${index}" title="Delete block">✕</button>
                  </div>
                </div>
              `;
            })
            .join("")
        : "";

      const addBlockRow =
        isExpanded && !group.isLayout ? renderSectionAddBlockRow(group.blockSlug) : "";
      const layoutHint =
        isExpanded && group.isLayout
          ? `<p class="course-editor__outline-layout-hint">This section is one combined layout. Click <strong>Edit</strong> on the block below to add content. For a separate block under its own heading, use <strong>+ Add Section</strong> above.</p>`
          : "";
      const emptyBlocksHint =
        isExpanded && group.blockCount === 0 && !group.isLayout
          ? `<p class="course-editor__outline-empty">No blocks yet. Add one below.</p>`
          : "";

      return `
        <div class="course-editor__outline-section ${isExpanded ? "is-expanded" : ""}" data-block-slug="${escapeHtml(group.blockSlug)}">
          <div
            class="course-editor__outline-section-row"
            data-outline-section-row="${escapeHtml(group.blockSlug)}"
          >
            <button
              type="button"
              class="course-editor__outline-caret"
              data-toggle-section="${escapeHtml(group.blockSlug)}"
              aria-expanded="${isExpanded ? "true" : "false"}"
              title="${isExpanded ? "Collapse section" : "Expand section"}"
            >${isExpanded ? "▾" : "▸"}</button>
            <div class="course-editor__outline-section-main">
              <input
                type="text"
                class="course-editor__input course-editor__outline-section-title"
                data-section-title="${escapeHtml(group.blockSlug)}"
                value="${escapeHtml(group.blockTitle === "Untitled section" ? "" : group.blockTitle)}"
                placeholder="${escapeHtml(navTitle)}"
                aria-label="${escapeHtml(navTitle)} title"
                autocomplete="off"
                spellcheck="true"
              />
              <span class="course-editor__outline-section-meta">
                <span class="course-editor__outline-section-num">Section ${group.sectionNumber}</span>
                <span class="course-editor__outline-section-count">${escapeHtml(formatSectionBlockCount(group.blockCount))}</span>
              </span>
            </div>
            <div class="course-editor__outline-section-actions">${sectionMoveBtns}</div>
          </div>
          ${
            isExpanded
              ? `<div class="course-editor__outline-blocks">${layoutHint}${emptyBlocksHint}${blocksHtml}${addBlockRow}</div>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  dom.itemsList.innerHTML = sectionHtml;

  bindContentListActions();

  const deleteConfirm = new Set<number>();

  dom.itemsList.querySelectorAll(".course-editor__outline-block").forEach((card) => {
    const index = Number(card.getAttribute("data-item-index"));

    card.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest(".course-editor__outline-block-actions")) return;
      const current = flattenLessonContent(getLessonDraft(selectedLessonSlug!)!)[index];
      if (current) openContentEdit(current);
    });

    card.addEventListener("dragstart", () => {
      dragState.kind = "item";
      dragState.index = index;
    });
    card.addEventListener("dragover", (e) => {
      if (dragState.kind === "item") e.preventDefault();
    });
    card.addEventListener("drop", () => {
      if (dragState.kind === "item" && dragState.index !== null && dragState.index !== index) {
        moveContentItem(dragState.index, index);
      }
      dragState.kind = null;
      dragState.index = null;
    });
  });

  dom.itemsList.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = btn.getAttribute("data-action");
      const index = Number(btn.getAttribute("data-index"));
      const swapIndex = Number(btn.getAttribute("data-swap-index"));
      const currentItems = flattenLessonContent(getLessonDraft(selectedLessonSlug!)!);
      const item = currentItems[index];
      if (!item) return;

      if (action === "edit") openContentEdit(item);
      else if (action === "up" && Number.isFinite(swapIndex) && swapIndex !== index)
        moveContentItem(index, swapIndex);
      else if (action === "down" && Number.isFinite(swapIndex) && swapIndex !== index)
        moveContentItem(index, swapIndex);
      else if (action === "dup") duplicateContentItem(item);
      else if (action === "del") {
        if (deleteConfirm.has(index)) {
          deleteContentItem(item);
          deleteConfirm.delete(index);
        } else {
          deleteConfirm.add(index);
          const delBtn = btn as HTMLButtonElement;
          delBtn.textContent = "Delete?";
          delBtn.classList.add("course-editor__item-delete-confirm");
          window.setTimeout(() => {
            deleteConfirm.delete(index);
            delBtn.textContent = "✕";
            delBtn.classList.remove("course-editor__item-delete-confirm");
          }, 3000);
        }
      }
    });
  });

  renderLessonList();
}

function removeBlockFromLesson(lesson: LessonRecord, blockSlug: string) {
  if (!Array.isArray(lesson.blocks)) return null;
  const blocks = lesson.blocks as LessonRecord[];
  const index = blocks.findIndex((block) => block.slug === blockSlug);
  if (index === -1) return null;
  return blocks.splice(index, 1)[0] ?? null;
}

function moveBlockRelativeToTarget(
  lesson: LessonRecord,
  blockSlug: string,
  targetBlockSlug: string,
  moveDown: boolean,
) {
  moveBlockRelativeToTargetInLesson(lesson, blockSlug, targetBlockSlug, moveDown);
}

function insertComponentBesideBlock(
  lesson: LessonRecord,
  component: Record<string, unknown>,
  targetBlockSlug: string,
  after: boolean,
) {
  insertStandaloneComponentBlockRelative(lesson, component, targetBlockSlug, after);
  reassignAllContentOrders(lesson);
}

function moveContentItem(fromIndex: number, toIndex: number) {
  if (!selectedLessonSlug || fromIndex === toIndex) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;

  const items = flattenLessonContent(lesson);
  if (toIndex < 0 || toIndex >= items.length) return;

  const current = items[fromIndex]!;
  const target = items[toIndex]!;
  const moveDown = fromIndex < toIndex;

  if (current.type === TEXT_VIDEO_LAYOUT_TYPE) {
    moveBlockRelativeToTarget(lesson, current.blockSlug, target.blockSlug, moveDown);
    reassignAllContentOrders(lesson);
    setLessonDraft(selectedLessonSlug, lesson);
    contentEditingRef = { ...current };
    renderContentList();
    updateSaveState();
    return;
  }

  if (current.type === TEXT_IMAGE_LAYOUT_TYPE) {
    moveBlockRelativeToTarget(lesson, current.blockSlug, target.blockSlug, moveDown);
    reassignAllContentOrders(lesson);
    setLessonDraft(selectedLessonSlug, lesson);
    contentEditingRef = { ...current };
    renderContentList();
    updateSaveState();
    return;
  }

  if (current.type === THREE_VIDEOS_LAYOUT_TYPE) {
    moveBlockRelativeToTarget(lesson, current.blockSlug, target.blockSlug, moveDown);
    reassignAllContentOrders(lesson);
    setLessonDraft(selectedLessonSlug, lesson);
    contentEditingRef = { ...current };
    renderContentList();
    updateSaveState();
    return;
  }

  if (isAccordionLayoutItem(current, lesson)) {
    moveBlockRelativeToTarget(lesson, current.blockSlug, target.blockSlug, moveDown);
    reassignAllContentOrders(lesson);
    setLessonDraft(selectedLessonSlug, lesson);
    contentEditingRef = { ...current };
    renderContentList();
    updateSaveState();
    return;
  }

  if (isEmbeddedToolLayoutItem(current, lesson)) {
    moveBlockRelativeToTarget(lesson, current.blockSlug, target.blockSlug, moveDown);
    reassignAllContentOrders(lesson);
    setLessonDraft(selectedLessonSlug, lesson);
    contentEditingRef = { ...current };
    renderContentList();
    updateSaveState();
    return;
  }

  if (target.type === TEXT_VIDEO_LAYOUT_TYPE) {
    const comp = removeComponentFromBlock(
      lesson,
      current.blockSlug,
      current.legacyComponentId,
      current.type,
    );
    if (!comp) return;
    pruneEmptyBlocks(lesson);
    insertComponentBesideBlock(lesson, comp, target.blockSlug, moveDown);
    setLessonDraft(selectedLessonSlug, lesson);
    const host = findBlockContainingComponent(
      lesson as CourseLesson,
      Number(comp.legacyComponentId),
      String(comp.type),
    );
    contentEditingRef = {
      blockSlug: String(host?.slug ?? target.blockSlug),
      legacyComponentId: Number(comp.legacyComponentId),
      type: String(comp.type),
    };
    renderContentList();
    updateSaveState();
    return;
  }

  if (target.type === TEXT_IMAGE_LAYOUT_TYPE) {
    const comp = removeComponentFromBlock(
      lesson,
      current.blockSlug,
      current.legacyComponentId,
      current.type,
    );
    if (!comp) return;
    pruneEmptyBlocks(lesson);
    insertComponentBesideBlock(lesson, comp, target.blockSlug, moveDown);
    setLessonDraft(selectedLessonSlug, lesson);
    const host = findBlockContainingComponent(
      lesson as CourseLesson,
      Number(comp.legacyComponentId),
      String(comp.type),
    );
    contentEditingRef = {
      blockSlug: String(host?.slug ?? target.blockSlug),
      legacyComponentId: Number(comp.legacyComponentId),
      type: String(comp.type),
    };
    renderContentList();
    updateSaveState();
    return;
  }

  if (target.type === THREE_VIDEOS_LAYOUT_TYPE) {
    const comp = removeComponentFromBlock(
      lesson,
      current.blockSlug,
      current.legacyComponentId,
      current.type,
    );
    if (!comp) return;
    pruneEmptyBlocks(lesson);
    insertComponentBesideBlock(lesson, comp, target.blockSlug, moveDown);
    setLessonDraft(selectedLessonSlug, lesson);
    const host = findBlockContainingComponent(
      lesson as CourseLesson,
      Number(comp.legacyComponentId),
      String(comp.type),
    );
    contentEditingRef = {
      blockSlug: String(host?.slug ?? target.blockSlug),
      legacyComponentId: Number(comp.legacyComponentId),
      type: String(comp.type),
    };
    renderContentList();
    updateSaveState();
    return;
  }

  if (isAccordionLayoutItem(target, lesson)) {
    const comp = removeComponentFromBlock(
      lesson,
      current.blockSlug,
      current.legacyComponentId,
      current.type,
    );
    if (!comp) return;
    pruneEmptyBlocks(lesson);
    insertComponentBesideBlock(lesson, comp, target.blockSlug, moveDown);
    setLessonDraft(selectedLessonSlug, lesson);
    const host = findBlockContainingComponent(
      lesson as CourseLesson,
      Number(comp.legacyComponentId),
      String(comp.type),
    );
    contentEditingRef = {
      blockSlug: String(host?.slug ?? target.blockSlug),
      legacyComponentId: Number(comp.legacyComponentId),
      type: String(comp.type),
    };
    renderContentList();
    updateSaveState();
    return;
  }

  if (isEmbeddedToolLayoutItem(target, lesson)) {
    const comp = removeComponentFromBlock(
      lesson,
      current.blockSlug,
      current.legacyComponentId,
      current.type,
    );
    if (!comp) return;
    pruneEmptyBlocks(lesson);
    insertComponentBesideBlock(lesson, comp, target.blockSlug, moveDown);
    setLessonDraft(selectedLessonSlug, lesson);
    const host = findBlockContainingComponent(
      lesson as CourseLesson,
      Number(comp.legacyComponentId),
      String(comp.type),
    );
    contentEditingRef = {
      blockSlug: String(host?.slug ?? target.blockSlug),
      legacyComponentId: Number(comp.legacyComponentId),
      type: String(comp.type),
    };
    renderContentList();
    updateSaveState();
    return;
  }

  const movedRef = movePlainContentComponent(
    lesson as CourseLesson,
    current,
    target,
    moveDown,
  );
  if (!movedRef) return;

  setLessonDraft(selectedLessonSlug, lesson);
  contentEditingRef = movedRef;
  renderContentList();
  updateSaveState();
}

function duplicateContentItem(ref: ComponentRef) {
  if (!selectedLessonSlug) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;

  if (ref.type === TEXT_VIDEO_LAYOUT_TYPE) {
    const block = findBlock(lesson, ref.blockSlug);
    if (!block) return;
    const clone = JSON.parse(JSON.stringify(block)) as LessonRecord;
    const timestamp = Date.now();
    clone.slug = `text-video-${timestamp}`;
    clone.order = nextBlockOrder(lesson);
    clone.legacy = {
      ...(clone.legacy as Record<string, unknown>),
      assignId: nextAssignId(lesson),
      editorLayout: "textVideo",
    };
    const parts = getTextVideoLayoutParts(clone);
    if (!parts) return;
    const leftId = maxLegacyComponentIdInCourse();
    parts.leftText.legacyComponentId = leftId;
    parts.leftText.layoutRole = TEXT_VIDEO_LEFT_ROLE;
    parts.video.legacyComponentId = leftId + 1;
    if (parts.bottomText) {
      parts.bottomText.legacyComponentId = leftId + 2;
      parts.bottomText.layoutRole = TEXT_VIDEO_BOTTOM_ROLE;
    }

    const blocks = (lesson.blocks ?? []) as LessonRecord[];
    const index = blocks.findIndex((item) => item.slug === ref.blockSlug);
    blocks.splice(index + 1, 0, clone);
    lesson.blocks = blocks;
    reassignAllContentOrders(lesson);
    setLessonDraft(selectedLessonSlug, lesson);

    contentEditingRef = {
      blockSlug: String(clone.slug),
      legacyComponentId: Number(parts.leftText.legacyComponentId),
      type: TEXT_VIDEO_LAYOUT_TYPE,
      pairedLegacyComponentId: Number(parts.video.legacyComponentId),
    };
    openContentEdit(contentEditingRef);
    flashToast("Duplicated");
    updateSaveState();
    return;
  }

  if (ref.type === THREE_VIDEOS_LAYOUT_TYPE) {
    const block = findBlock(lesson, ref.blockSlug);
    if (!block) return;
    const clone = JSON.parse(JSON.stringify(block)) as LessonRecord;
    const timestamp = Date.now();
    clone.slug = `three-videos-${timestamp}`;
    clone.order = nextBlockOrder(lesson);
    clone.legacy = {
      ...(clone.legacy as Record<string, unknown>),
      assignId: nextAssignId(lesson),
      editorLayout: THREE_VIDEOS_EDITOR_LAYOUT,
    };
    reassignThreeVideosLayoutIds(clone, maxLegacyComponentIdInCourse());

    const blocks = (lesson.blocks ?? []) as LessonRecord[];
    const index = blocks.findIndex((item) => item.slug === ref.blockSlug);
    blocks.splice(index + 1, 0, clone);
    lesson.blocks = blocks;
    reassignAllContentOrders(lesson);
    setLessonDraft(selectedLessonSlug, lesson);

    const parts = getThreeVideosLayoutParts(clone);
    if (!parts) return;
    contentEditingRef = {
      blockSlug: String(clone.slug),
      legacyComponentId: Number(
        parts.intro?.legacyComponentId ?? parts.slots[0]!.video.legacyComponentId,
      ),
      type: THREE_VIDEOS_LAYOUT_TYPE,
    };
    openContentEdit(contentEditingRef);
    flashToast("Duplicated");
    updateSaveState();
    return;
  }

  if (ref.type === TEXT_IMAGE_LAYOUT_TYPE) {
    const block = findBlock(lesson, ref.blockSlug);
    if (!block) return;
    const clone = JSON.parse(JSON.stringify(block)) as LessonRecord;
    const timestamp = Date.now();
    clone.slug = `text-image-${timestamp}`;
    clone.order = nextBlockOrder(lesson);
    clone.legacy = {
      ...(clone.legacy as Record<string, unknown>),
      assignId: nextAssignId(lesson),
      editorLayout: "textImage",
    };
    const parts = getTextImageLayoutParts(clone);
    if (!parts) return;
    const textId = maxLegacyComponentIdInCourse();
    parts.text.legacyComponentId = textId;
    parts.text.layoutRole = TEXT_IMAGE_TEXT_ROLE;
    parts.image.legacyComponentId = textId + 1;
    parts.image.layoutRole = TEXT_IMAGE_IMAGE_ROLE;

    const blocks = (lesson.blocks ?? []) as LessonRecord[];
    const index = blocks.findIndex((item) => item.slug === ref.blockSlug);
    blocks.splice(index + 1, 0, clone);
    lesson.blocks = blocks;
    reassignAllContentOrders(lesson);
    setLessonDraft(selectedLessonSlug, lesson);

    contentEditingRef = {
      blockSlug: String(clone.slug),
      legacyComponentId: Number(parts.text.legacyComponentId),
      type: TEXT_IMAGE_LAYOUT_TYPE,
      pairedLegacyComponentId: Number(parts.image.legacyComponentId),
    };
    openContentEdit(contentEditingRef);
    flashToast("Duplicated");
    updateSaveState();
    return;
  }

  if (isAccordionLayoutItem(ref, lesson)) {
    const block = findBlock(lesson, ref.blockSlug);
    if (!block) return;
    const clone = JSON.parse(JSON.stringify(block)) as LessonRecord;
    const timestamp = Date.now();
    clone.slug = `accordion-${timestamp}`;
    clone.order = nextBlockOrder(lesson);
    clone.legacy = {
      ...(clone.legacy as Record<string, unknown>),
      assignId: nextAssignId(lesson),
      editorLayout: "accordion",
    };
    const parts = getAccordionLayoutParts(clone);
    if (!parts) return;
    const baseId = maxLegacyComponentIdInCourse();
    if (parts.introText) {
      parts.introText.legacyComponentId = baseId;
      parts.introText.layoutRole = ACCORDION_INTRO_ROLE;
    }
    parts.accordion.legacyComponentId = parts.introText ? baseId + 1 : baseId;

    const blocks = (lesson.blocks ?? []) as LessonRecord[];
    const index = blocks.findIndex((item) => item.slug === ref.blockSlug);
    blocks.splice(index + 1, 0, clone);
    lesson.blocks = blocks;
    reassignAllContentOrders(lesson);
    setLessonDraft(selectedLessonSlug, lesson);

    contentEditingRef = {
      blockSlug: String(clone.slug),
      legacyComponentId: Number(parts.accordion.legacyComponentId),
      type: "exerciseAccordion",
      introLegacyComponentId: parts.introText
        ? Number(parts.introText.legacyComponentId)
        : undefined,
    };
    openContentEdit(contentEditingRef);
    flashToast("Duplicated");
    updateSaveState();
    return;
  }

  if (isEmbeddedToolLayoutItem(ref, lesson)) {
    const block = findBlock(lesson, ref.blockSlug);
    if (!block) return;
    const clone = JSON.parse(JSON.stringify(block)) as LessonRecord;
    const timestamp = Date.now();
    clone.slug = `embedded-tool-${timestamp}`;
    clone.order = nextBlockOrder(lesson);
    clone.legacy = {
      ...(clone.legacy as Record<string, unknown>),
      assignId: nextAssignId(lesson),
      editorLayout: "embeddedTool",
    };
    const parts = getEmbeddedToolLayoutParts(clone);
    if (!parts) return;
    const baseId = maxLegacyComponentIdInCourse();
    if (parts.introText) {
      parts.introText.legacyComponentId = baseId;
      parts.introText.layoutRole = EMBEDDED_TOOL_INTRO_ROLE;
    }
    parts.tool.legacyComponentId = parts.introText ? baseId + 1 : baseId;

    const blocks = (lesson.blocks ?? []) as LessonRecord[];
    const index = blocks.findIndex((item) => item.slug === ref.blockSlug);
    blocks.splice(index + 1, 0, clone);
    lesson.blocks = blocks;
    reassignAllContentOrders(lesson);
    setLessonDraft(selectedLessonSlug, lesson);

    contentEditingRef = {
      blockSlug: String(clone.slug),
      legacyComponentId: Number(parts.tool.legacyComponentId),
      type: "embeddedTool",
      introLegacyComponentId: parts.introText
        ? Number(parts.introText.legacyComponentId)
        : undefined,
    };
    openContentEdit(contentEditingRef);
    flashToast("Duplicated");
    updateSaveState();
    return;
  }

  const items = flattenLessonContent(lesson);
  const index = items.findIndex(
    (i) =>
      i.blockSlug === ref.blockSlug &&
      i.legacyComponentId === ref.legacyComponentId &&
      i.type === ref.type,
  );
  if (index === -1) return;

  const source = items[index]!.component;
  const clone = JSON.parse(JSON.stringify(source)) as Record<string, unknown>;
  clone.legacyComponentId = maxLegacyComponentIdInCourse();

  const block = findBlock(lesson, ref.blockSlug);
  if (!block) return;
  const compIndex = findComponentIndex(block, ref.legacyComponentId, ref.type);
  (block.components as Record<string, unknown>[]).splice(compIndex + 1, 0, clone);
  reassignAllContentOrders(lesson);
  setLessonDraft(selectedLessonSlug, lesson);

  contentEditingRef = {
    blockSlug: ref.blockSlug,
    legacyComponentId: Number(clone.legacyComponentId),
    type: String(clone.type),
  };
  openContentEdit(contentEditingRef);
  flashToast("Duplicated");
  updateSaveState();
}

function deleteContentItem(ref: ComponentRef) {
  if (!selectedLessonSlug) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;

  if (ref.type === TEXT_VIDEO_LAYOUT_TYPE) {
    removeBlockFromLesson(lesson, ref.blockSlug);
    reassignAllContentOrders(lesson);
    setLessonDraft(selectedLessonSlug, lesson);
    if (contentItemMatches(contentEditingRef, ref)) {
      contentEditingRef = null;
      hideEditFormPanel();
    }
    renderContentList();
    updateSaveState();
    return;
  }

  if (ref.type === TEXT_IMAGE_LAYOUT_TYPE) {
    removeBlockFromLesson(lesson, ref.blockSlug);
    reassignAllContentOrders(lesson);
    setLessonDraft(selectedLessonSlug, lesson);
    if (contentItemMatches(contentEditingRef, ref)) {
      contentEditingRef = null;
      hideEditFormPanel();
    }
    renderContentList();
    updateSaveState();
    return;
  }

  if (ref.type === THREE_VIDEOS_LAYOUT_TYPE) {
    removeBlockFromLesson(lesson, ref.blockSlug);
    reassignAllContentOrders(lesson);
    setLessonDraft(selectedLessonSlug, lesson);
    if (contentItemMatches(contentEditingRef, ref)) {
      contentEditingRef = null;
      hideEditFormPanel();
    }
    renderContentList();
    updateSaveState();
    return;
  }

  if (isAccordionLayoutItem(ref, lesson)) {
    removeBlockFromLesson(lesson, ref.blockSlug);
    reassignAllContentOrders(lesson);
    setLessonDraft(selectedLessonSlug, lesson);
    if (contentItemMatches(contentEditingRef, ref)) {
      contentEditingRef = null;
      hideEditFormPanel();
    }
    renderContentList();
    updateSaveState();
    return;
  }

  if (isEmbeddedToolLayoutItem(ref, lesson)) {
    removeBlockFromLesson(lesson, ref.blockSlug);
    reassignAllContentOrders(lesson);
    setLessonDraft(selectedLessonSlug, lesson);
    if (contentItemMatches(contentEditingRef, ref)) {
      contentEditingRef = null;
      hideEditFormPanel();
    }
    renderContentList();
    updateSaveState();
    return;
  }

  const blockBeforeRemoval = findBlock(lesson, ref.blockSlug);
  const keepEmptySection = Boolean(
    blockBeforeRemoval &&
      !isEditorLayoutBlock(blockBeforeRemoval) &&
      Array.isArray(blockBeforeRemoval.components) &&
      blockBeforeRemoval.components.length === 1,
  );

  removeComponentFromBlock(lesson, ref.blockSlug, ref.legacyComponentId, ref.type);

  const blockAfterRemoval = findBlock(lesson, ref.blockSlug);
  const keptEmptySection =
    keepEmptySection &&
    blockAfterRemoval &&
    Array.isArray(blockAfterRemoval.components) &&
    blockAfterRemoval.components.length === 0;

  if (!keptEmptySection) {
    pruneEmptyBlocks(lesson);
  }

  reassignAllContentOrders(lesson);
  setLessonDraft(selectedLessonSlug, lesson);

  if (
    contentEditingRef &&
    contentEditingRef.blockSlug === ref.blockSlug &&
    contentEditingRef.legacyComponentId === ref.legacyComponentId &&
    contentEditingRef.type === ref.type
  ) {
    contentEditingRef = null;
    hideEditFormPanel();
  }

  if (keptEmptySection) {
    expandSection(ref.blockSlug);
    flashToast("Block removed — section kept. Use + Add Block to add content.");
  }

  renderContentList();
  updateSaveState();
}

function appendContentItem(kind: string) {
  if (!selectedLessonSlug) return;
  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;

  if (kind === TEXT_VIDEO_LAYOUT_TYPE) {
    if (!Array.isArray(lesson.blocks)) lesson.blocks = [];
    const block = createTextVideoLayoutBlock(lesson);
    (lesson.blocks as LessonRecord[]).push(block);
    setLessonDraft(selectedLessonSlug, lesson);

    const parts = getTextVideoLayoutParts(block);
    if (!parts) return;
    contentEditingRef = {
      blockSlug: String(block.slug),
      legacyComponentId: Number(parts.leftText.legacyComponentId),
      type: TEXT_VIDEO_LAYOUT_TYPE,
      pairedLegacyComponentId: Number(parts.video.legacyComponentId),
    };
    openContentEdit(contentEditingRef);
    updateSaveState();
    flashToast(`Added ${typeMeta(TEXT_VIDEO_LAYOUT_TYPE).label}`);
    return;
  }

  if (kind === TEXT_IMAGE_LAYOUT_TYPE) {
    if (!Array.isArray(lesson.blocks)) lesson.blocks = [];
    const block = createTextImageLayoutBlock(lesson);
    (lesson.blocks as LessonRecord[]).push(block);
    setLessonDraft(selectedLessonSlug, lesson);

    const parts = getTextImageLayoutParts(block);
    if (!parts) return;
    contentEditingRef = {
      blockSlug: String(block.slug),
      legacyComponentId: Number(parts.text.legacyComponentId),
      type: TEXT_IMAGE_LAYOUT_TYPE,
      pairedLegacyComponentId: Number(parts.image.legacyComponentId),
    };
    openContentEdit(contentEditingRef);
    updateSaveState();
    flashToast(`Added ${typeMeta(TEXT_IMAGE_LAYOUT_TYPE).label}`);
    return;
  }

  if (kind === THREE_VIDEOS_LAYOUT_TYPE) {
    if (!Array.isArray(lesson.blocks)) lesson.blocks = [];
    const block = createThreeVideosLayoutBlock(lesson);
    (lesson.blocks as LessonRecord[]).push(block);
    setLessonDraft(selectedLessonSlug, lesson);

    const parts = getThreeVideosLayoutParts(block);
    if (!parts) return;
    contentEditingRef = {
      blockSlug: String(block.slug),
      legacyComponentId: Number(
        parts.intro?.legacyComponentId ?? parts.slots[0]!.video.legacyComponentId,
      ),
      type: THREE_VIDEOS_LAYOUT_TYPE,
    };
    openContentEdit(contentEditingRef);
    updateSaveState();
    flashToast(`Added ${typeMeta(THREE_VIDEOS_LAYOUT_TYPE).label}`);
    return;
  }

  if (kind === "exerciseAccordion") {
    if (!Array.isArray(lesson.blocks)) lesson.blocks = [];
    const block = createAccordionLayoutBlock(lesson);
    (lesson.blocks as LessonRecord[]).push(block);
    setLessonDraft(selectedLessonSlug, lesson);

    const parts = getAccordionLayoutParts(block);
    if (!parts) return;
    contentEditingRef = {
      blockSlug: String(block.slug),
      legacyComponentId: Number(parts.accordion.legacyComponentId),
      type: "exerciseAccordion",
      introLegacyComponentId: parts.introText
        ? Number(parts.introText.legacyComponentId)
        : undefined,
    };
    openContentEdit(contentEditingRef);
    updateSaveState();
    flashToast(`Added ${typeMeta("exerciseAccordion").label}`);
    return;
  }

  if (kind === "embeddedTool") {
    if (!Array.isArray(lesson.blocks)) lesson.blocks = [];
    const block = createEmbeddedToolLayoutBlock(lesson);
    (lesson.blocks as LessonRecord[]).push(block);
    setLessonDraft(selectedLessonSlug, lesson);

    const parts = getEmbeddedToolLayoutParts(block);
    if (!parts) return;
    contentEditingRef = {
      blockSlug: String(block.slug),
      legacyComponentId: Number(parts.tool.legacyComponentId),
      type: "embeddedTool",
      introLegacyComponentId: parts.introText
        ? Number(parts.introText.legacyComponentId)
        : undefined,
    };
    openContentEdit(contentEditingRef);
    updateSaveState();
    flashToast(`Added ${typeMeta("embeddedTool").label}`);
    return;
  }

  const component = createComponent(kind);
  const newBlock = appendStandaloneComponentBlock(lesson, component);
  setLessonDraft(selectedLessonSlug, lesson);

  contentEditingRef = {
    blockSlug: String(newBlock.slug),
    legacyComponentId: Number(component.legacyComponentId),
    type: String(component.type),
  };
  openContentEdit(contentEditingRef);
  updateSaveState();
  flashToast(`Added ${typeMeta(String(component.type)).label}`);
}

function renderLessonList() {
  if (!dom.lessonList || !courseData) return;
  const lessons = sortedLessons(courseData);
  const canDeleteLesson = lessons.length > 1;

  dom.lessonList.innerHTML = lessons
    .map((lesson, index) => {
      const slug = String(lesson.slug ?? "");
      const draft = getLessonDraft(slug) ?? lesson;
      const active = slug === selectedLessonSlug;
      const dirty = isLessonDirty(slug);
      const renaming = renamingLessonSlug === slug;
      const { sectionCount, blockCount } = countLessonSectionsAndBlocks(draft);
      const metaLabel = formatLessonSidebarMeta(sectionCount, blockCount);
      return `
        <div class="course-editor__lesson-row ${active ? "is-active" : ""} ${dirty ? "is-dirty" : ""}"
          data-lesson-slug="${escapeHtml(slug)}" data-lesson-index="${index}" draggable="true">
          <span class="course-editor__lesson-grip" title="Drag to reorder">⋮⋮</span>
          <span class="course-editor__lesson-number">${index + 1}</span>
          <div class="course-editor__lesson-body">
            ${
              renaming
                ? `<input class="course-editor__lesson-rename" data-rename-input value="${escapeHtml(lessonTitleForEditing(draft.title))}">`
                : `<span class="course-editor__lesson-title">${escapeHtml(lessonDisplayTitle(draft.title))}</span>`
            }
            <span class="course-editor__lesson-meta">${metaLabel}</span>
          </div>
          <span class="course-editor__lesson-actions">
            <button type="button" class="course-editor__icon-btn" data-lesson-edit="${index}" title="Edit lesson">Edit</button>
            <button type="button" class="course-editor__icon-btn" data-lesson-rename="${index}" title="Rename">✎</button>
            <button type="button" class="course-editor__icon-btn" data-lesson-up="${index}" ${index === 0 ? "disabled" : ""} title="Move up">↑</button>
            <button type="button" class="course-editor__icon-btn" data-lesson-down="${index}" ${index === lessons.length - 1 ? "disabled" : ""} title="Move down">↓</button>
            <button type="button" class="course-editor__icon-btn" data-lesson-dup="${index}" title="Duplicate lesson">⧉</button>
            <button type="button" class="course-editor__icon-btn is-danger" data-lesson-del="${index}" ${canDeleteLesson ? "" : "disabled"} title="Delete lesson">✕</button>
          </span>
        </div>
      `;
    })
    .join("");

  dom.lessonList.querySelectorAll(".course-editor__lesson-row").forEach((row) => {
    const slug = row.getAttribute("data-lesson-slug")!;
    const index = Number(row.getAttribute("data-lesson-index"));

    row.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest(".course-editor__lesson-actions, .course-editor__lesson-rename"))
        return;
      selectLesson(slug);
    });

    row.addEventListener("dragstart", () => {
      dragState.kind = "lesson";
      dragState.index = index;
    });
    row.addEventListener("dragover", (e) => {
      if (dragState.kind === "lesson") e.preventDefault();
    });
    row.addEventListener("drop", () => {
      if (dragState.kind === "lesson" && dragState.index !== null && dragState.index !== index) {
        void moveLesson(dragState.index, index);
      }
      dragState.kind = null;
      dragState.index = null;
    });
  });

  dom.lessonList.querySelectorAll("[data-lesson-edit]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const i = Number(btn.getAttribute("data-lesson-edit"));
      const lesson = sortedLessons(courseData!)[i];
      if (lesson) selectLesson(String(lesson.slug));
    });
  });

  dom.lessonList.querySelectorAll("[data-lesson-rename]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const i = Number(btn.getAttribute("data-lesson-rename"));
      const lesson = sortedLessons(courseData!)[i];
      if (lesson) startLessonRename(String(lesson.slug));
    });
  });

  dom.lessonList.querySelectorAll("[data-lesson-up], [data-lesson-down]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const up = btn.hasAttribute("data-lesson-up");
      const i = Number(btn.getAttribute(up ? "data-lesson-up" : "data-lesson-down"));
      void moveLesson(i, up ? i - 1 : i + 1);
    });
  });

  dom.lessonList.querySelectorAll("[data-lesson-dup]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const i = Number(btn.getAttribute("data-lesson-dup"));
      const lesson = sortedLessons(courseData!)[i];
      if (lesson) void duplicateLesson(String(lesson.slug));
    });
  });

  dom.lessonList.querySelectorAll("[data-lesson-del]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const i = Number(btn.getAttribute("data-lesson-del"));
      const lesson = sortedLessons(courseData!)[i];
      if (lesson) void deleteLesson(String(lesson.slug));
    });
  });

  const renameInput = dom.lessonList.querySelector("[data-rename-input]") as HTMLInputElement | null;
  if (renameInput && renamingLessonSlug) {
    renameInput.focus();
    renameInput.select();
    renameInput.addEventListener("blur", () => finishRename(renamingLessonSlug!, renameInput.value));
    renameInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") renameInput.blur();
      if (ev.key === "Escape") {
        renamingLessonSlug = null;
        renderLessonList();
      }
    });
  }

  if (dom.deleteLessonBtn) {
    dom.deleteLessonBtn.hidden = !selectedLessonSlug;
    dom.deleteLessonBtn.disabled = !canDeleteLesson;
  }
}

function startLessonRename(slug: string) {
  renamingLessonSlug = slug;
  renderLessonList();
}

async function moveLesson(fromIndex: number, toIndex: number) {
  if (!courseData || currentCourseId == null || toIndex < 0) return;
  const lessons = sortedLessons(courseData);
  if (toIndex >= lessons.length || fromIndex === toIndex) return;

  const scrollSnapshot = captureScrollSnapshot();
  setStatus("Reordering lessons…");

  try {
    const payload = await postCourseAction("moveLesson", { fromIndex, toIndex });
    if (payload.course) {
      applyCourseFromServer(payload.course, {
        selectSlug: selectedLessonSlug,
        preserveScroll: true,
      });
      restoreScrollSnapshot(scrollSnapshot);
    }
    setStatus("Lesson order saved.", "is-success");
    flashToast("Lesson order updated");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Could not reorder lessons.", "is-error");
  }
}

async function addLesson() {
  if (currentCourseId == null) return;
  const scrollSnapshot = captureScrollSnapshot();
  setStatus("Adding lesson…");

  try {
    const payload = await postCourseAction("addLesson", {});
    if (!payload.course || !payload.lessonSlug) {
      throw new Error("Add lesson response was incomplete.");
    }
    focusLessonTitlePending = true;
    applyCourseFromServer(payload.course, {
      selectSlug: payload.lessonSlug,
      preserveScroll: true,
    });
    restoreScrollSnapshot(scrollSnapshot);
    setStatus("New lesson added.", "is-success");
    flashToast("Lesson added");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Could not add lesson.", "is-error");
  }
}

async function duplicateLesson(slug: string) {
  if (currentCourseId == null) return;
  const draft = getLessonDraft(slug);
  const dirty = isLessonDirty(slug);
  if (dirty) {
    const proceed = window.confirm(
      "This lesson has unsaved changes. Duplicate the saved version on disk, or cancel and save first.",
    );
    if (!proceed) return;
  }

  const scrollSnapshot = captureScrollSnapshot();
  setStatus("Duplicating lesson…");

  try {
    const payload = await postCourseAction("duplicateLesson", {
      lessonSlug: slug,
      ...(dirty ? {} : { lesson: draft }),
    });
    if (!payload.course || !payload.lessonSlug) {
      throw new Error("Duplicate lesson response was incomplete.");
    }
    applyCourseFromServer(payload.course, {
      selectSlug: payload.lessonSlug,
      preserveScroll: true,
    });
    restoreScrollSnapshot(scrollSnapshot);
    setStatus("Lesson duplicated.", "is-success");
    flashToast("Lesson duplicated");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Could not duplicate lesson.", "is-error");
  }
}

async function deleteLesson(slug: string) {
  if (!courseData || currentCourseId == null) return;
  const lessons = sortedLessons(courseData);
  if (lessons.length <= 1) {
    window.alert("Cannot delete the last remaining lesson in a course.");
    return;
  }

  const lesson = getLessonDraft(slug) ?? lessons.find((item) => item.slug === slug);
  const title = lessonDisplayTitle(lesson?.title);
  let message = `Delete lesson '${title}'?`;
  if (isLessonDirty(slug)) {
    message += "\n\nThis lesson has unsaved changes that will be lost.";
  }
  if (!window.confirm(message)) return;

  const currentIndex = lessons.findIndex((item) => item.slug === slug);
  const scrollSnapshot = captureScrollSnapshot();
  setStatus("Deleting lesson…");

  try {
    const payload = await postCourseAction("deleteLesson", { lessonSlug: slug });
    if (!payload.course) throw new Error("Delete lesson response was incomplete.");

    const remaining = sortedLessons(payload.course);
    const fallbackSlug =
      remaining[Math.min(currentIndex, remaining.length - 1)]?.slug ??
      remaining[remaining.length - 1]?.slug ??
      null;

    contentEditingRef = null;
    hideEditFormPanel();
    applyCourseFromServer(payload.course, {
      selectSlug: fallbackSlug,
      preserveScroll: true,
    });
    restoreScrollSnapshot(scrollSnapshot);
    setStatus("Lesson deleted.", "is-success");
    flashToast("Lesson deleted");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Could not delete lesson.", "is-error");
  }
}

function finishRename(slug: string, title: string) {
  renamingLessonSlug = null;
  const lesson = getLessonDraft(slug);
  if (lesson) {
    lesson.title = normalizeLessonTitleInput(title);
    setLessonDraft(slug, lesson);
    updateSaveState();
  }
  renderLessonList();
  if (slug === selectedLessonSlug) {
    syncLessonTitleInput();
    syncRawTextarea();
  }
}

function selectLesson(slug: string, force = false) {
  if (
    !force &&
    selectedLessonSlug &&
    isLessonDirty(selectedLessonSlug) &&
    slug !== selectedLessonSlug
  ) {
    if (
      !window.confirm(
        "This lesson has unsaved changes. Switch anyway and lose those edits?",
      )
    ) {
      return;
    }
  }

  selectedLessonSlug = slug;
  contentEditingRef = null;
  renamingLessonSlug = null;
  resetOutlineExpandState();

  if (currentCourseId != null) {
    persistSelectedLesson(currentCourseId, slug);
  }

  const lesson = sortedLessons(courseData).find((l) => l.slug === slug);
  if (!lesson) return;

  if (!lessonDrafts.has(slug)) {
    setLessonDraft(slug, lesson);
    lessonSavedJson.set(slug, JSON.stringify(cloneLesson(lesson)));
  }

  if (dom.previewLink && currentCourseId != null) {
    updateCoursePreviewLink(courseData?.course, slug);
  }
  if (dom.courseTitle) {
    dom.courseTitle.value = String(courseData?.course?.title ?? "");
    dom.courseTitle.readOnly = true;
  }

  hideEditFormPanel();

  syncRawTextarea();
  renderLessonList();
  renderContentList();
  updateSaveState();
  syncEditorUrl();
  focusLessonTitleIfPending();
}

function syncRawTextarea() {
  if (!dom.rawLesson || !selectedLessonSlug) return;
  const draft = getLessonDraft(selectedLessonSlug);
  dom.rawLesson.value = draft ? JSON.stringify(draft, null, 2) : "";
  if (dom.rawError) {
    dom.rawError.hidden = true;
    dom.rawError.textContent = "";
  }
}

function findEmptyBlockSlugs(lesson: LessonRecord) {
  return sortedBlocks(lesson)
    .filter((block) => !Array.isArray(block.components) || (block.components as unknown[]).length === 0)
    .map((block) => String(block.slug ?? ""));
}

async function saveLesson(fromRaw = false) {
  if (!selectedLessonSlug || currentCourseId == null) return;

  const savedLessonSlug = selectedLessonSlug;
  const editingRef = contentEditingRef ? { ...contentEditingRef } : null;
  const scrollSnapshot = captureScrollSnapshot();
  captureSnippetsOpen();

  if (fromRaw && dom.rawLesson) {
    try {
      setLessonDraft(selectedLessonSlug, JSON.parse(dom.rawLesson.value) as LessonRecord);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON.";
      if (dom.rawError) {
        dom.rawError.hidden = false;
        dom.rawError.textContent = message;
      }
      setStatus(message, "is-error");
      return;
    }
  }

  const lesson = getLessonDraft(selectedLessonSlug);
  if (!lesson) return;

  lesson.title = normalizeLessonTitleInput(String(lesson.title ?? ""));
  setLessonDraft(selectedLessonSlug, lesson);
  syncLessonTitleInput();

  const emptyBlocks = findEmptyBlockSlugs(lesson);
  if (emptyBlocks.length > 0) {
    const ok = window.confirm(
      `This lesson has ${emptyBlocks.length} empty block(s) that will be removed on save:\n${emptyBlocks.join(", ")}\n\nContinue?`,
    );
    if (!ok) return;
  }

  setStatus("Saving lesson…");
  syncEditorUrl();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId: currentCourseId,
        lessonSlug: selectedLessonSlug,
        lesson,
        removeEmptyBlocks: true,
      }),
    });
    const payload = (await res.json()) as { ok?: boolean; error?: string; backupPath?: string; removedEmptyBlocks?: string[] };
    if (!res.ok || !payload.ok) throw new Error(payload.error || "Save failed.");

    lessonSavedJson.set(selectedLessonSlug, JSON.stringify(cloneLesson(lesson)));

    const refreshRes = await fetch(`${API_URL}?courseId=${currentCourseId}`);
    const refreshPayload = (await refreshRes.json()) as { ok?: boolean; course?: CourseRecord };
    if (refreshRes.ok && refreshPayload.ok && refreshPayload.course) {
      applyCourseFromServer(refreshPayload.course, {
        selectSlug: savedLessonSlug,
        preserveScroll: true,
      });
    }

    restoreContentEditIfPossible(editingRef);
    restoreSnippetsOpen();
    restoreScrollSnapshot(scrollSnapshot);
    updateSaveState();
    syncEditorUrl();

    const backupName = payload.backupPath
      ? String(payload.backupPath).split(/[/\\]/).pop()
      : "created";
    setStatus(`Lesson saved. Backup: ${backupName}`, "is-success");
    flashToast("Lesson saved");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Save failed.", "is-error");
  }
}

function revertLesson() {
  if (!selectedLessonSlug) return;
  const saved = lessonSavedJson.get(selectedLessonSlug);
  if (!saved) return;
  setLessonDraft(selectedLessonSlug, JSON.parse(saved) as LessonRecord);
  contentEditingRef = null;
  hideEditFormPanel();
  syncRawTextarea();
  renderContentList();
  updateSaveState();
  flashToast("Reverted");
}

async function loadCourse(
  courseId: number,
  options: {
    lessonSlug?: string | null;
    lessonIndex?: number | null;
    advancedOpen?: boolean;
    preserveScroll?: boolean;
  } = {},
) {
  const scrollSnapshot = options.preserveScroll ? captureScrollSnapshot() : null;
  const preferredLessonSlug = options.lessonSlug ?? selectedLessonSlug;
  const preferredLessonIndex = options.lessonIndex ?? null;
  const preferredAdvancedOpen = options.advancedOpen;

  if (dom.loading) dom.loading.hidden = false;
  if (dom.app) dom.app.hidden = true;
  setStatus("");

  try {
    const res = await fetch(`${API_URL}?courseId=${courseId}`);
    const payload = (await res.json()) as { ok?: boolean; error?: string; course?: CourseRecord };
    if (!res.ok || !payload.ok || !payload.course) {
      throw new Error(payload.error || "Could not load course.");
    }

    currentCourseId = courseId;
    persistSelectedCourse(courseId);
    courseData = payload.course;
    lessonDrafts.clear();
    lessonSavedJson.clear();
    selectedLessonSlug = null;
    contentEditingRef = null;

    for (const lesson of sortedLessons(courseData)) {
      const slug = String(lesson.slug ?? "");
      setLessonDraft(slug, cloneLesson(lesson));
      lessonSavedJson.set(slug, JSON.stringify(cloneLesson(lesson)));
    }

    if (dom.courseSelect) dom.courseSelect.value = String(courseId);
    updateCoursePreviewLink(courseData.course);
    if (dom.courseTitle) dom.courseTitle.value = String(courseData.course?.title ?? "");
    syncCourseSettingsFields(courseData.course);

    if (dom.loading) dom.loading.hidden = true;
    if (dom.app) dom.app.hidden = false;

    const lessons = sortedLessons(courseData);
    const persistedSlug = readPersistedLessonSlug(courseId);
    const targetSlug = resolveInitialLessonSlug(lessons, {
      lessonSlug: options.lessonSlug ?? preferredLessonSlug ?? persistedSlug,
      lessonIndex: options.lessonIndex ?? preferredLessonIndex,
    });
    if (targetSlug) selectLesson(targetSlug, true);

    if (preferredAdvancedOpen != null) {
      setAdvancedOpen(preferredAdvancedOpen);
    }
    restoreSnippetsOpen();
    if (scrollSnapshot) restoreScrollSnapshot(scrollSnapshot);
    syncEditorUrl();
    flashToast("Course loaded");
  } catch (err) {
    if (dom.loading) dom.loading.hidden = true;
    setStatus(err instanceof Error ? err.message : "Could not load course.", "is-error");
  }
}

function toggleAdvanced() {
  setAdvancedOpen(!advancedOpen);
  syncEditorUrl();
}

export function initCourseContentEditor() {
  bindDom();
  bindContentListActions();
  populateAddSectionTypes();
  bindAddSectionControls();
  setCourseHtmlSnippetsToast(flashToast);
  initCourseHtmlSnippetsPanel();

  dom.saveBtn?.addEventListener("click", () => saveLesson(false));
  dom.revertBtn?.addEventListener("click", revertLesson);
  dom.lessonTitleInput?.addEventListener("input", () => {
    if (!dom.lessonTitleInput) return;
    applyLessonTitleFromInput(dom.lessonTitleInput.value);
  });
  dom.lessonTitleInput?.addEventListener("blur", () => {
    if (!dom.lessonTitleInput) return;
    applyLessonTitleFromInput(dom.lessonTitleInput.value, true);
  });
  dom.addLessonBtn?.addEventListener("click", () => {
    void addLesson();
  });
  dom.deleteLessonBtn?.addEventListener("click", () => {
    if (selectedLessonSlug) void deleteLesson(selectedLessonSlug);
  });
  dom.reloadBtn?.addEventListener("click", () => {
    if (currentCourseId != null) {
      void loadCourse(currentCourseId, {
        lessonSlug: selectedLessonSlug,
        advancedOpen,
        preserveScroll: true,
      });
    }
  });
  dom.advancedToggle?.addEventListener("click", toggleAdvanced);
  dom.advancedSaveBtn?.addEventListener("click", () => saveLesson(true));

  dom.courseSelect?.addEventListener("change", () => {
    const courseId = Number.parseInt(dom.courseSelect!.value, 10);
    if (Number.isFinite(courseId)) {
      void loadCourse(courseId, { lessonSlug: null, lessonIndex: null, advancedOpen: false });
    }
  });

  dom.courseThumbnail?.addEventListener("input", () => {
    updateCourseThumbnailPreview();
    updateCourseSettingsSaveState();
  });
  dom.courseCatalogDescription?.addEventListener("input", () => {
    updateCatalogDescriptionSourceUi();
    updateCourseSettingsSaveState();
  });
  dom.catalogDescriptionClearBtn?.addEventListener("click", () => {
    clearCustomCatalogDescription();
  });
  dom.coursePublished?.addEventListener("change", () => {
    updateCourseStatusSelectStyles();
    updateCourseSettingsSaveState();
  });
  dom.courseContentStatus?.addEventListener("change", () => {
    updateCourseContentStatusSelectStyles();
    updateCourseSettingsSaveState();
  });
  dom.courseActive?.addEventListener("change", () => {
    updateCourseStatusSelectStyles();
    updateCourseSettingsSaveState();
  });
  dom.courseSettingsSaveBtn?.addEventListener("click", () => {
    void saveCourseSettings();
  });
  dom.courseStatusSaveBtn?.addEventListener("click", () => {
    void saveCourseVisibilitySettings();
  });

  dom.snippetsPanel?.addEventListener("toggle", () => {
    captureSnippetsOpen();
  });

  dom.rawLesson?.addEventListener("input", () => {
    if (!selectedLessonSlug || !dom.rawLesson) return;
    try {
      setLessonDraft(selectedLessonSlug, JSON.parse(dom.rawLesson.value) as LessonRecord);
      if (dom.rawError) dom.rawError.hidden = true;
      renderContentList();
      updateSaveState();
    } catch (err) {
      if (dom.rawError) {
        dom.rawError.hidden = false;
        dom.rawError.textContent = err instanceof Error ? err.message : "Invalid JSON.";
      }
    }
  });

  void (async () => {
    try {
      const res = await fetch(API_URL);
      const payload = (await res.json()) as {
        ok?: boolean;
        error?: string;
        courses?: CourseCatalogEntry[];
      };
      if (!res.ok || !payload.ok) throw new Error(payload.error || "Could not load courses.");

      courseCatalog = payload.courses ?? [];
      if (dom.courseSelect) {
        dom.courseSelect.innerHTML = courseCatalog
          .map(
            (c) =>
              `<option value="${c.id}">${escapeHtml(formatCourseCatalogLabel(c))}</option>`,
          )
          .join("");
      }

      const allowedCourseIds = courseCatalog.map((course) => course.id);
      const nav = parseEditorNavigationState(window.location.search, allowedCourseIds);
      const initialCourseId =
        nav.courseId ??
        readPersistedCourseId(allowedCourseIds) ??
        (courseCatalog.length > 0 ? courseCatalog[0]!.id : null);

      if (initialCourseId != null) {
        await loadCourse(initialCourseId, {
          lessonSlug: nav.lessonSlug,
          lessonIndex: nav.lessonIndex,
          advancedOpen: nav.advancedOpen,
        });
      }
    } catch (err) {
      if (dom.loading) dom.loading.hidden = true;
      setStatus(err instanceof Error ? err.message : "Could not initialize.", "is-error");
    }
  })();
}
