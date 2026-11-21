import { fetchAdminJson } from "../lib/admin/adminAuthClient";
import {
  HELP_HUB_IMAGE_SIZE_ERROR,
  helpHubImageUploadProblem,
} from "../lib/helpHub/imagePolicy";
import { billboardImageTag } from "../lib/whatsNew/sanitizeBillboardHtml";
import { normalizeWhatsNewDestinationUrl } from "../lib/whatsNew/destinationUrl";
import { sanitizeTipSectionHtml } from "../lib/tipOfTheWeek/richTextFieldHtml";
import {
  initCompactRichText,
  insertCompactRichTextHtml,
  syncCompactRichText,
} from "./watsonRichTextEditor";

function promptLinkUrl(): string | null {
  const raw = window.prompt("Link URL (site path like /tools, or https://…)");
  if (raw == null) return null;
  const result = normalizeWhatsNewDestinationUrl(raw);
  if (!result.ok || !result.value) {
    window.alert(result.ok ? "Enter a site path or https:// URL." : result.error);
    return null;
  }
  return result.value;
}

/**
 * Compact contenteditable editors for Watson Tip of the Week.
 * Same allowlist as the What's New billboard message, plus Visual / Edit HTML.
 */
export function initWatsonTipTryItRichText(root: ParentNode = document): void {
  const wraps = root.querySelectorAll<HTMLElement>("[data-totw-rte], [data-totw-try-rte]");
  wraps.forEach((wrap) => {
    initCompactRichText(wrap, {
      sanitize: sanitizeTipSectionHtml,
      enableLink: true,
      promptLink: promptLinkUrl,
      labeledHtmlToggle: true,
    });
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
}

/** Insert Image panel: path, alt, width, centering, and the Help Hub image upload. */
export function initWatsonTipImageInsert(root: ParentNode = document): void {
  const dialog = root.querySelector<HTMLElement>("[data-totw-image-dialog]");
  if (!dialog || dialog.dataset.wired === "1") return;
  dialog.dataset.wired = "1";

  const srcInput = dialog.querySelector<HTMLInputElement>("[data-totw-image-src]");
  const altInput = dialog.querySelector<HTMLInputElement>("[data-totw-image-alt]");
  const widthInput = dialog.querySelector<HTMLInputElement>("[data-totw-image-width]");
  const centerInput = dialog.querySelector<HTMLInputElement>("[data-totw-image-center]");
  const fileInput = dialog.querySelector<HTMLInputElement>("[data-totw-image-file]");
  const status = dialog.querySelector<HTMLElement>("[data-totw-image-status]");
  let target: HTMLElement | null = null;

  const setStatus = (message: string, isError = false): void => {
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = isError ? "error" : message ? "ok" : "";
  };

  const close = (): void => {
    dialog.hidden = true;
    target = null;
    setStatus("");
  };

  const openFor = (wrap: HTMLElement): void => {
    target = wrap;
    if (srcInput) srcInput.value = "";
    if (altInput) altInput.value = "";
    if (widthInput) widthInput.value = "";
    if (centerInput) centerInput.checked = false;
    setStatus("");
    dialog.hidden = false;
    srcInput?.focus();
  };

  root.addEventListener("click", (event) => {
    const click = event.target;
    if (!(click instanceof Element)) return;
    const opener = click.closest<HTMLButtonElement>("[data-totw-insert-image]");
    if (!opener) return;
    event.preventDefault();
    const wrap = opener.closest<HTMLElement>("[data-totw-rte]");
    if (!wrap) return;
    openFor(wrap);
  });

  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
    }
  });

  dialog.querySelector("[data-totw-image-cancel]")?.addEventListener("click", () => {
    close();
  });

  dialog.querySelector("[data-totw-image-choose]")?.addEventListener("click", () => {
    fileInput?.click();
  });

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    void uploadImage(file);
  });

  dialog.querySelector("[data-totw-image-add]")?.addEventListener("click", () => {
    if (!target || !srcInput) return;
    const tag = billboardImageTag({
      src: srcInput.value,
      alt: altInput?.value ?? "",
      width: widthInput?.value ?? "",
      center: Boolean(centerInput?.checked),
    });
    if (!tag) {
      setStatus("Use a site image address such as /images/photo.jpg.", true);
      return;
    }
    insertCompactRichTextHtml(target, tag);
    syncCompactRichText(target, sanitizeTipSectionHtml);
    close();
  });

  async function uploadImage(file: File): Promise<void> {
    const problem = helpHubImageUploadProblem(file, { allowGif: true });
    if (problem) {
      setStatus(problem, true);
      return;
    }
    setStatus("Uploading image…");
    try {
      const dataBase64 = await readFileAsDataUrl(file);
      const result = await fetchAdminJson<{ url?: string }>("/api/admin/help-hub/images", {
        method: "POST",
        body: { filename: file.name, mimeType: file.type || "", dataBase64 },
      });
      if (!result.ok) {
        const tooBig = result.status === 413 || /too large/i.test(result.error || "");
        setStatus(
          tooBig
            ? HELP_HUB_IMAGE_SIZE_ERROR
            : result.error || "Could not upload that image. You can still paste a site path.",
          true,
        );
        return;
      }
      const url = typeof result.data.url === "string" ? result.data.url.trim() : "";
      if (!url || !srcInput) {
        setStatus("Upload did not return an image address. Paste a site path instead.", true);
        return;
      }
      srcInput.value = url;
      setStatus("Image address filled in. Add alt text, then insert it.");
    } catch {
      setStatus(
        "Could not upload that image. Check your connection, or paste a site path. Files must be under 4 MB.",
        true,
      );
    }
  }
}
