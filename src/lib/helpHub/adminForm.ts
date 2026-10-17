import { normalizeRelatedLessonRefs } from "./document";
import {
  normalizeMemberResourceOrder,
  normalizeRelatedLibraryVideos,
  type HelpHubLibraryVideoRef,
  type MemberResourceOrderRef,
} from "./memberResources";

const MEDIA_KEYS_TO_PRESERVE = [
  "mediaType",
  "mediaUrl",
  "mediaPoster",
  "mediaAlt",
  "mediaCaption",
  "thumbnailAlt",
  "videoId",
] as const;

export type HelpHubAdminFormValues = {
  question: string;
  bubbleAnswer: string;
  hook: string;
  aboutTitle: string;
  solutionText: string;
  tryThis: string;
  trySteps: string[];
  tryNote: string;
  tryImage: string;
  tryImageAlt: string;
  tryImageCaption: string;
  mediaUrl: string;
  mediaAlt: string;
  mediaCaption: string;
  relatedToolEyebrow: string;
  relatedToolTitle: string;
  relatedToolNote: string;
  relatedToolLabel: string;
  relatedToolUrl: string;
  publicVideoUrl: string;
  publicVideoTitle: string;
  relatedLessons: (string | number)[];
  relatedLibraryVideos: HelpHubLibraryVideoRef[];
  memberResourceOrder?: MemberResourceOrderRef[];
  category: string;
  isNew: boolean;
  slug: string;
  status: string;
};

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Load Explanation from solutionText, or legacy bridge when solutionText is empty. */
export function explanationForAdminForm(entry: Record<string, unknown> | null | undefined): string {
  if (!entry) return "";
  const solution = asTrimmed(entry.solutionText);
  if (solution) return solution;
  return asTrimmed(entry.bridge);
}

export function tryThisIntroForForm(entry: Record<string, unknown> | null | undefined): string {
  if (!entry) return "";
  const t = entry.tryThis;
  if (typeof t === "string") return t;
  if (t && typeof t === "object" && !Array.isArray(t)) {
    const o = t as { quickActionTitle?: unknown };
    if (typeof o.quickActionTitle === "string") return o.quickActionTitle;
  }
  return "";
}

export function tryStepsLinesForForm(entry: Record<string, unknown> | null | undefined): string {
  if (!entry) return "";
  const steps = entry.trySteps;
  if (Array.isArray(steps)) {
    return steps.map(String).filter((s) => s.trim() && s.trim() !== "...").join("\n");
  }
  const t = entry.tryThis;
  if (t && typeof t === "object" && !Array.isArray(t)) {
    const quick = (t as { quickAction?: unknown }).quickAction;
    if (Array.isArray(quick)) {
      return quick.map(String).filter((s) => s.trim() && s.trim() !== "...").join("\n");
    }
  }
  return "";
}

export function sanitizeHelpHubSlug(raw: string): string {
  return String(raw)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function slugFromQuestion(question: string): string {
  return sanitizeHelpHubSlug(question);
}

/** Public Help Hub images are site paths, never embeds or remote video URLs. */
export function isHelpHubImageUrl(url: string): boolean {
  const t = url.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return false;
  return true;
}

export function isHelpHubInternalHref(href: string): boolean {
  const t = href.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return false;
  return true;
}

const HELP_HUB_CTA_HOSTS = new Set(["knititnow.com", "www.knititnow.com"]);

/** Site path, or an https link on knititnow.com. Other sites stay blocked. */
export function isHelpHubCtaHref(href: string): boolean {
  const t = href.trim();
  if (isHelpHubInternalHref(t)) return true;
  try {
    const url = new URL(t);
    return url.protocol === "https:" && HELP_HUB_CTA_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function storedHeroMediaIsImage(
  entry: Record<string, unknown> | null | undefined,
): boolean {
  if (!entry) return false;
  const type = asTrimmed(entry.mediaType).toLowerCase();
  if (type === "vimeo" || type === "video") return false;
  const url = asTrimmed(entry.mediaUrl);
  if (!url || !isHelpHubImageUrl(url)) return false;
  return type === "image" || type === "";
}

export function topImageFieldsForAdminForm(
  entry: Record<string, unknown> | null | undefined,
): { url: string; alt: string; caption: string } {
  if (!storedHeroMediaIsImage(entry)) return { url: "", alt: "", caption: "" };
  return {
    url: asTrimmed(entry?.mediaUrl),
    alt: asTrimmed(entry?.mediaAlt) || asTrimmed(entry?.thumbnailAlt),
    caption: asTrimmed(entry?.mediaCaption),
  };
}

export type HelpHubRelatedToolButton = {
  label: string;
  href: string;
  eyebrow: string;
  title: string;
  note: string;
};

export function helpHubRelatedToolButton(tip: {
  relatedToolLabel?: unknown;
  relatedToolUrl?: unknown;
  relatedToolEyebrow?: unknown;
  relatedToolTitle?: unknown;
  relatedToolNote?: unknown;
}): HelpHubRelatedToolButton | null {
  const label = typeof tip.relatedToolLabel === "string" ? tip.relatedToolLabel.trim() : "";
  const href = typeof tip.relatedToolUrl === "string" ? tip.relatedToolUrl.trim() : "";
  if (!label || !href || !isHelpHubCtaHref(href)) return null;
  return {
    label,
    href,
    eyebrow: typeof tip.relatedToolEyebrow === "string" ? tip.relatedToolEyebrow.trim() : "",
    title: typeof tip.relatedToolTitle === "string" ? tip.relatedToolTitle.trim() : "",
    note: typeof tip.relatedToolNote === "string" ? tip.relatedToolNote.trim() : "",
  };
}

export function shouldAutofillSlug(options: {
  isNewEntry: boolean;
  slugManuallyEdited: boolean;
}): boolean {
  return options.isNewEntry && !options.slugManuallyEdited;
}

function quickActionNote(entry: Record<string, unknown> | null | undefined): string {
  if (!entry) return "";
  const tryThis = entry.tryThis;
  if (!tryThis || typeof tryThis !== "object" || Array.isArray(tryThis)) return "";
  return asTrimmed((tryThis as { quickActionNote?: unknown }).quickActionNote);
}

/** The important note shown with Try This. Prefers tryNote, then a legacy quick-action note. */
export function noteForAdminForm(entry: Record<string, unknown> | null | undefined): string {
  if (!entry) return "";
  const note = asTrimmed(entry.tryNote);
  if (note) return note;
  return quickActionNote(entry);
}

export function tryStepListForForm(entry: Record<string, unknown> | null | undefined): string[] {
  const lines = tryStepsLinesForForm(entry);
  if (!lines) return [];
  return lines.split(/\r?\n/).map((step) => step.trim()).filter((step) => step && step !== "...");
}

function applyTryThis(existing: unknown, intro: string, clearQuickNote: boolean): unknown {
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    const copy = { ...(existing as Record<string, unknown>) };
    if (intro) copy.quickActionTitle = intro;
    else delete copy.quickActionTitle;
    if (clearQuickNote) delete copy.quickActionNote;
    return copy;
  }
  return intro;
}

export type HelpHubSaveIntent = "keep" | "publish";

/**
 * Save draft never publishes.
 * An existing published entry stays published unless the status field was changed.
 */
export function statusForHelpHubSave(options: {
  intent: HelpHubSaveIntent;
  selectedStatus: string;
  storedStatus: string;
}): string {
  if (options.intent === "publish") return "published";
  const selected = options.selectedStatus.trim().toLowerCase() || "draft";
  const stored = options.storedStatus.trim().toLowerCase() || "draft";
  if (selected === "published") {
    if (stored === "published") return "published";
    if (stored === "review") return "review";
    return "draft";
  }
  if (selected === "review") return "review";
  return "draft";
}

export function helpHubSaveActionLabel(options: {
  intent: HelpHubSaveIntent;
  selectedStatus: string;
  storedStatus: string;
}): string {
  if (options.intent === "publish") return "Publish";
  const next = statusForHelpHubSave(options);
  if (next === "published") return "Update";
  if (next === "review") return "Save for review";
  return "Save draft";
}

/**
 * Merge visible admin fields onto the existing document.
 * Unedited media and other hidden fields stay in place.
 */
export function applyAdminFormToDocument(
  existing: Record<string, unknown> | null | undefined,
  form: HelpHubAdminFormValues,
): Record<string, unknown> {
  const out: Record<string, unknown> = existing && typeof existing === "object" ? { ...existing } : {};

  out.question = form.question;
  if (form.bubbleAnswer) out.bubbleAnswer = form.bubbleAnswer;
  else delete out.bubbleAnswer;
  if (form.hook) out.hook = form.hook;
  else delete out.hook;
  if (form.aboutTitle) out.aboutTitle = form.aboutTitle;
  else delete out.aboutTitle;
  if (form.solutionText) out.solutionText = form.solutionText;
  else delete out.solutionText;
  const publicVideoUrl = form.publicVideoUrl.trim();
  const publicVideoTitle = form.publicVideoTitle.trim();
  if (publicVideoUrl) out.publicVideoUrl = publicVideoUrl;
  else delete out.publicVideoUrl;
  if (publicVideoTitle) out.publicVideoTitle = publicVideoTitle;
  else delete out.publicVideoTitle;

  const loadedNoteFromQuickAction = !asTrimmed(existing?.tryNote) && Boolean(quickActionNote(existing));
  out.tryThis = applyTryThis(out.tryThis, form.tryThis, loadedNoteFromQuickAction);
  if (form.trySteps.length) out.trySteps = form.trySteps;
  else delete out.trySteps;
  if (form.tryNote) out.tryNote = form.tryNote;
  else delete out.tryNote;
  if (form.tryImage) out.tryImage = form.tryImage;
  else delete out.tryImage;
  if (form.tryImageAlt) out.tryImageAlt = form.tryImageAlt;
  else delete out.tryImageAlt;
  if (form.tryImageCaption) out.tryImageCaption = form.tryImageCaption;
  else delete out.tryImageCaption;

  const relatedTool = helpHubRelatedToolButton({
    relatedToolLabel: form.relatedToolLabel,
    relatedToolUrl: form.relatedToolUrl,
    relatedToolEyebrow: form.relatedToolEyebrow,
    relatedToolTitle: form.relatedToolTitle,
    relatedToolNote: form.relatedToolNote,
  });
  if (relatedTool) {
    out.relatedToolLabel = relatedTool.label;
    out.relatedToolUrl = relatedTool.href;
    if (relatedTool.eyebrow) out.relatedToolEyebrow = relatedTool.eyebrow;
    else delete out.relatedToolEyebrow;
    if (relatedTool.title) out.relatedToolTitle = relatedTool.title;
    else delete out.relatedToolTitle;
    if (relatedTool.note) out.relatedToolNote = relatedTool.note;
    else delete out.relatedToolNote;
  } else {
    delete out.relatedToolLabel;
    delete out.relatedToolUrl;
    delete out.relatedToolEyebrow;
    delete out.relatedToolTitle;
    delete out.relatedToolNote;
  }

  out.relatedLessons = normalizeRelatedLessonRefs(form.relatedLessons);
  out.relatedLibraryVideos = normalizeRelatedLibraryVideos(form.relatedLibraryVideos);
  if (Array.isArray(form.memberResourceOrder)) {
    const order = normalizeMemberResourceOrder(form.memberResourceOrder);
    if (order.length) out.memberResourceOrder = order;
    else delete out.memberResourceOrder;
  }

  out.category = form.category;
  out.isNew = form.isNew;
  out.slug = form.slug;
  out.status = form.status || "draft";

  if (!asTrimmed(out.title)) {
    out.title = form.question || form.slug || "Untitled";
  }

  const topImageUrl = form.mediaUrl.trim();
  if (topImageUrl && isHelpHubImageUrl(topImageUrl)) {
    out.mediaType = "image";
    out.mediaUrl = topImageUrl;
    if (form.mediaAlt.trim()) out.mediaAlt = form.mediaAlt.trim();
    else delete out.mediaAlt;
    if (form.mediaCaption.trim()) out.mediaCaption = form.mediaCaption.trim();
    else delete out.mediaCaption;
  } else if (storedHeroMediaIsImage(existing)) {
    for (const key of MEDIA_KEYS_TO_PRESERVE) delete out[key];
  } else {
    for (const key of MEDIA_KEYS_TO_PRESERVE) {
      if (existing && Object.prototype.hasOwnProperty.call(existing, key)) {
        out[key] = existing[key];
      }
    }
  }

  return out;
}

export function missingRequiredAdminFields(form: HelpHubAdminFormValues): string[] {
  const required: Array<keyof HelpHubAdminFormValues> = ["question", "slug", "status", "category"];
  return required.filter((name) => {
    const value = form[name];
    return typeof value !== "string" || value.trim() === "";
  });
}

export function saveButtonLabelForStatus(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "published") return "Publish";
  if (s === "review") return "Save for review";
  return "Save draft";
}

/** Editor boot only needs the form and save control — not JSON Preview. */
export function helpHubAdminEditorCanInit(options: {
  form: unknown;
  saveButton: unknown;
}): boolean {
  return Boolean(options.form && options.saveButton);
}

export function documentOmitsVimeoId(doc: Record<string, unknown>, vimeoId: string): boolean {
  return !JSON.stringify(doc).includes(vimeoId);
}

export type HelpHubEditorEntryChoice = {
  slug: string;
  label: string;
  status: "published" | "draft" | "review";
};

export type HelpHubChooserPlacement = {
  box: "draft" | "published";
  key: "draft" | "published" | "review";
  statusLabel: "Draft" | "Published" | "Needs review";
  action: "Open" | "Edit";
};

/**
 * The split Draft / Published chooser is for DEV (localhost and kin-dev).
 * Production keeps the mixed entry list.
 */
export function helpHubSplitEntryChooserEnabled(
  env: "localhost" | "dev" | "production",
): boolean {
  return env !== "production";
}

/** Published entries get their own box. Draft and needs-review stay in the draft box. */
export function helpHubChooserPlacement(status: string): HelpHubChooserPlacement {
  const raw = status.trim().toLowerCase();
  if (raw === "published") {
    return { box: "published", key: "published", statusLabel: "Published", action: "Edit" };
  }
  if (raw === "review") {
    return { box: "draft", key: "review", statusLabel: "Needs review", action: "Open" };
  }
  return { box: "draft", key: "draft", statusLabel: "Draft", action: "Open" };
}

export type HelpHubEditorEntryGroups = Record<HelpHubEditorEntryChoice["status"], HelpHubEditorEntryChoice[]>;

function choiceText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Published, draft, and review entries Sue can open in the editor. Entries without a URL are omitted. */
export function helpHubEditorEntryChoices(
  entries: Array<{ slug?: unknown; question?: unknown; title?: unknown; status?: unknown }>,
): HelpHubEditorEntryGroups {
  const groups: HelpHubEditorEntryGroups = { published: [], draft: [], review: [] };
  for (const entry of entries) {
    const slug = choiceText(entry.slug);
    if (!slug) continue;
    const label = choiceText(entry.question) || choiceText(entry.title) || slug;
    const raw = choiceText(entry.status).toLowerCase();
    const status: HelpHubEditorEntryChoice["status"] =
      raw === "published" || raw === "review" ? raw : "draft";
    groups[status].push({ slug, label, status });
  }
  for (const status of ["published", "draft", "review"] as const) {
    groups[status].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }
  return groups;
}
