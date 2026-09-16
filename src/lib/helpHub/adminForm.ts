import { normalizeRelatedLessonRefs } from "./document";
import {
  normalizeRelatedLibraryVideos,
  type HelpHubLibraryVideoRef,
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
  relatedToolLabel: string;
  relatedToolUrl: string;
  relatedLessons: (string | number)[];
  relatedLibraryVideos: HelpHubLibraryVideoRef[];
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

export type HelpHubRelatedToolButton = { label: string; href: string };

export function helpHubRelatedToolButton(tip: {
  relatedToolLabel?: unknown;
  relatedToolUrl?: unknown;
}): HelpHubRelatedToolButton | null {
  const label = typeof tip.relatedToolLabel === "string" ? tip.relatedToolLabel.trim() : "";
  const href = typeof tip.relatedToolUrl === "string" ? tip.relatedToolUrl.trim() : "";
  if (!label || !href || !isHelpHubInternalHref(href)) return null;
  return { label, href };
}

export function shouldAutofillSlug(options: {
  isNewEntry: boolean;
  slugManuallyEdited: boolean;
}): boolean {
  return options.isNewEntry && !options.slugManuallyEdited;
}

function applyTryThis(existing: unknown, intro: string): unknown {
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    const copy = { ...(existing as Record<string, unknown>) };
    if (intro) copy.quickActionTitle = intro;
    else delete copy.quickActionTitle;
    return copy;
  }
  return intro;
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

  out.tryThis = applyTryThis(out.tryThis, form.tryThis);
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
  });
  if (relatedTool) {
    out.relatedToolLabel = relatedTool.label;
    out.relatedToolUrl = relatedTool.href;
  } else {
    delete out.relatedToolLabel;
    delete out.relatedToolUrl;
  }

  out.relatedLessons = normalizeRelatedLessonRefs(form.relatedLessons);
  out.relatedLibraryVideos = normalizeRelatedLibraryVideos(form.relatedLibraryVideos);

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
