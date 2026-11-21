/**
 * Markup for a Tip of the Week rich-text section.
 * Visual / Edit HTML and Insert image are shared by every content section.
 */
import { sanitizeBillboardHtml } from "../whatsNew/sanitizeBillboardHtml";

/** The visual editor uses divs for Enter. Store those as paragraphs. */
export function sanitizeTipSectionHtml(html: string): string {
  const withParagraphs = html
    .replace(/<\s*div\b/gi, "<p")
    .replace(/<\s*\/\s*div\s*>/gi, "</p>");
  return sanitizeBillboardHtml(withParagraphs);
}

function toolbarHtml(toolbarLabel: string): string {
  return `
    <div class="watson-totw__rte-toolbar" data-wn-rte-toolbar role="toolbar" aria-label="${toolbarLabel}">
      <button type="button" class="watson-totw__rte-btn" data-wn-rte-cmd="bold" title="Bold"><strong>B</strong></button>
      <button type="button" class="watson-totw__rte-btn" data-wn-rte-cmd="italic" title="Italic"><em>I</em></button>
      <button type="button" class="watson-totw__rte-btn" data-wn-rte-cmd="paragraph" title="Paragraph">¶</button>
      <button type="button" class="watson-totw__rte-btn" data-wn-rte-cmd="ul" title="Bulleted list">• List</button>
      <button type="button" class="watson-totw__rte-btn" data-wn-rte-cmd="ol" title="Numbered list">1. List</button>
      <button type="button" class="watson-totw__rte-btn" data-wn-rte-cmd="link" title="Add or edit link">Link</button>
      <button type="button" class="watson-totw__rte-btn" data-wn-rte-cmd="clear" title="Remove formatting">Clear</button>
    </div>
  `;
}

/** Editor shell shared by Introduction, Try It, Sue’s Tip, and each learning point. */
export function tipRichTextEditorHtml(options: {
  labelId: string;
  toolbarLabel: string;
  sourceLabel: string;
  fieldName?: string;
  markers?: string;
}): string {
  const name = options.fieldName ? ` name="${options.fieldName}"` : "";
  const markers = options.markers ?? "data-totw-rte";
  return `
    <div class="watson-totw__rte watson-totw__rte--compact" ${markers}>
      <div class="watson-totw__rte-modes" role="group" aria-label="${options.sourceLabel}">
        <button type="button" class="watson-totw__rte-mode is-active" data-wn-rte-mode="visual" aria-pressed="true">Visual</button>
        <button type="button" class="watson-totw__rte-mode" data-wn-rte-mode="html" aria-pressed="false">Edit HTML</button>
      </div>
      <div class="watson-totw__image-actions">
        <button type="button" class="watson-totw__rte-btn" data-totw-insert-image>Insert image</button>
      </div>
      ${toolbarHtml(options.toolbarLabel)}
      <div
        class="watson-totw__rte-editor"
        data-wn-rte-editor
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        aria-labelledby="${options.labelId}"
      ></div>
      <textarea class="watson-totw__rte-source" data-wn-rte-source hidden spellcheck="false" aria-label="${options.sourceLabel} HTML"></textarea>
      <textarea class="watson-totw__rte-input" data-wn-rte-input${name} hidden tabindex="-1" aria-hidden="true"></textarea>
    </div>
  `;
}
