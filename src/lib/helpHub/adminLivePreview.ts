import { htmlWithHelpHubPreviewBase } from "./previewDocument";

export type HelpHubEditorPreviewTarget = {
  group: string;
  fieldId: string;
};

const PREVIEW_SECTION_TARGETS: Record<string, HelpHubEditorPreviewTarget> = {
  hook: { group: "question", fieldId: "help-hub-hook" },
  question: { group: "question", fieldId: "help-hub-question" },
  answer: { group: "question", fieldId: "help-hub-bubble" },
  image: { group: "image", fieldId: "help-hub-top-image" },
  explanation: { group: "explanation", fieldId: "help-hub-solution-text" },
  video: { group: "video", fieldId: "help-hub-public-video-url" },
  try: { group: "try", fieldId: "help-hub-try-this-intro" },
  note: { group: "note", fieldId: "help-hub-try-note" },
  "image-support": { group: "support", fieldId: "help-hub-try-image" },
  cta: { group: "cta", fieldId: "help-hub-related-tool-eyebrow" },
  lessons: { group: "lessons", fieldId: "member-resources-search" },
};

export function editorTargetForPreviewSection(section: string): HelpHubEditorPreviewTarget | null {
  return PREVIEW_SECTION_TARGETS[section] ?? null;
}

const PREVIEW_HIGHLIGHT_STYLE =
  '<style id="help-hub-editor-preview-style">[data-help-hub-section].is-editor-selected{outline:3px solid #3f6212;outline-offset:4px;border-radius:10px}</style>';

/** Public preview HTML plus a preview-only highlight. Does not change the published stylesheet. */
export function htmlForHelpHubEditorFrame(html: string, baseHref: string): string {
  const withBase = htmlWithHelpHubPreviewBase(html, baseHref);
  if (withBase.includes("help-hub-editor-preview-style")) return withBase;
  if (/<\/head>/i.test(withBase)) {
    return withBase.replace(/<\/head>/i, `${PREVIEW_HIGHLIGHT_STYLE}</head>`);
  }
  return `${PREVIEW_HIGHLIGHT_STYLE}${withBase}`;
}

export function helpHubPreviewClickShouldStay(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== "function") return false;
  return Boolean((target as Element).closest("a, button, input, select, textarea, summary"));
}
