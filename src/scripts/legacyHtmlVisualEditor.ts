/**
 * Visual editor for legacy course HTML.
 * Loads existing markup into contenteditable without sanitizing or splitting it.
 * HTML / Advanced stays available; visual is the default.
 */

export type LegacyHtmlVisualEditorOptions = {
  html: string;
  onChange: (html: string) => void;
};

function exec(cmd: string, value?: string): void {
  try {
    document.execCommand(cmd, false, value);
  } catch {
    // Unsupported commands are ignored.
  }
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function closestFromSelection<T extends Element>(
  selector: string,
): T | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const node = selection.anchorNode;
  if (!node) return null;
  const el = node instanceof Element ? node : node.parentElement;
  return el?.closest(selector) as T | null;
}

function unwrapAnchor(anchor: HTMLAnchorElement): void {
  const parent = anchor.parentNode;
  if (!parent) return;
  while (anchor.firstChild) parent.insertBefore(anchor.firstChild, anchor);
  parent.removeChild(anchor);
}

function editLink(anchor: HTMLAnchorElement | null, visual: HTMLElement): boolean {
  const current = anchor?.getAttribute("href") ?? "";
  const next = window.prompt("Link address", current);
  if (next == null) return false;
  const href = next.trim();
  if (anchor) {
    if (!href) unwrapAnchor(anchor);
    else anchor.setAttribute("href", href);
  } else if (href) {
    visual.focus();
    exec("createLink", href);
  }
  return true;
}

function editImage(img: HTMLImageElement | null, visual: HTMLElement): boolean {
  const current = img?.getAttribute("src") ?? "";
  const next = window.prompt(
    img
      ? "Image source (leave blank to remove)"
      : "Image source path or URL",
    current,
  );
  if (next == null) return false;
  const src = next.trim();
  if (img) {
    if (!src) img.remove();
    else img.setAttribute("src", src);
  } else if (src) {
    visual.focus();
    exec("insertHTML", `<img src="${escapeAttr(src)}" alt="">`);
  }
  return true;
}

/**
 * Mount a visual-first HTML editor. Existing markup is shown as rendered content.
 * Stored HTML is only overwritten after the user edits.
 */
export function mountLegacyHtmlVisualEditor(
  container: HTMLElement,
  options: LegacyHtmlVisualEditorOptions,
): void {
  let tab: "visual" | "html" = "visual";
  let value = options.html ?? "";
  let visualDirty = false;

  const emit = (next: string) => {
    value = next;
    visualDirty = true;
    options.onChange(next);
  };

  const render = () => {
    container.innerHTML = `
      <div class="course111-admin__rte">
        <div class="course111-admin__rte-tabs" role="tablist">
          <button type="button" class="course111-admin__rte-tab ${tab === "visual" ? "is-active" : ""}" data-rte-tab="visual">Visual</button>
          <button type="button" class="course111-admin__rte-tab ${tab === "html" ? "is-active" : ""}" data-rte-tab="html">HTML / Advanced</button>
        </div>
        <div data-rte-body></div>
      </div>
    `;
    const body = container.querySelector("[data-rte-body]") as HTMLElement | null;
    if (!body) return;

    if (tab === "html") {
      body.innerHTML = `
        <textarea class="course111-admin__textarea course111-admin__rte-html" spellcheck="false"></textarea>
        <p class="course111-admin__hint">Unusual legacy markup only. Visual is the normal editor.</p>
      `;
      const textarea = body.querySelector("textarea") as HTMLTextAreaElement;
      textarea.value = value;
      textarea.addEventListener("input", () => emit(textarea.value));
    } else {
      body.innerHTML = `
        <div class="course111-admin__rte-visual-wrap">
          <div class="course111-admin__rte-toolbar">
            <button type="button" class="course111-admin__rte-btn" data-cmd="bold" title="Bold"><b>B</b></button>
            <button type="button" class="course111-admin__rte-btn" data-cmd="italic" title="Italic"><i>I</i></button>
            <button type="button" class="course111-admin__rte-btn" data-cmd="formatBlock" data-arg="h3" title="Heading">H</button>
            <button type="button" class="course111-admin__rte-btn" data-cmd="insertUnorderedList" title="Bullet list">•</button>
            <button type="button" class="course111-admin__rte-btn" data-cmd="insertOrderedList" title="Numbered list">1.</button>
            <button type="button" class="course111-admin__rte-btn" data-cmd="link" title="Edit link">Link</button>
            <button type="button" class="course111-admin__rte-btn" data-cmd="image" title="Edit or insert image">Image</button>
            <button type="button" class="course111-admin__rte-btn" data-cmd="unlink" title="Remove link">Unlink</button>
          </div>
          <div class="course111-admin__rte-visual" contenteditable="true"></div>
        </div>
        <p class="course111-admin__hint">Edit text in place. Double-click a link to change its address, or an image to change or remove it.</p>
      `;
      const visual = body.querySelector(".course111-admin__rte-visual") as HTMLElement;
      visual.innerHTML = value || "";

      visual.addEventListener("input", () => emit(visual.innerHTML));

      visual.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest("a")) event.preventDefault();
      });

      visual.addEventListener("dblclick", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const img = target.closest("img");
        if (img instanceof HTMLImageElement) {
          event.preventDefault();
          if (editImage(img, visual)) emit(visual.innerHTML);
          return;
        }
        const anchor = target.closest("a");
        if (anchor instanceof HTMLAnchorElement) {
          event.preventDefault();
          if (editLink(anchor, visual)) emit(visual.innerHTML);
        }
      });

      body.querySelectorAll("[data-cmd]").forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          const cmd = btn.getAttribute("data-cmd");
          visual.focus();
          if (cmd === "link") {
            if (editLink(closestFromSelection<HTMLAnchorElement>("a"), visual)) {
              emit(visual.innerHTML);
            }
            return;
          }
          if (cmd === "image") {
            if (editImage(closestFromSelection<HTMLImageElement>("img"), visual)) {
              emit(visual.innerHTML);
            }
            return;
          }
          if (cmd === "formatBlock") {
            exec("formatBlock", btn.getAttribute("data-arg") ?? "h3");
          } else if (cmd) {
            exec(cmd);
          }
          emit(visual.innerHTML);
        });
      });
    }

    container.querySelectorAll("[data-rte-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (tab === "visual") {
          const visual = container.querySelector(
            ".course111-admin__rte-visual",
          ) as HTMLElement | null;
          if (visual && visualDirty) value = visual.innerHTML;
        } else {
          const textarea = container.querySelector(
            "textarea",
          ) as HTMLTextAreaElement | null;
          if (textarea) value = textarea.value;
        }
        const next = btn.getAttribute("data-rte-tab");
        if (next === "visual" || next === "html") tab = next;
        render();
      });
    });
  };

  render();
}
