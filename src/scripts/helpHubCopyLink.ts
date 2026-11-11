import { helpHubArticleAbsoluteUrl } from "../lib/helpHub/articleLink";

const COPY_LABEL = "Copy link";
const COPIED_LABEL = "Copied";

function statusFor(button: HTMLButtonElement): HTMLElement | null {
  const wrap = button.closest(".help-hub-copy-link-wrap");
  const status = wrap?.querySelector("[data-help-hub-copy-status]");
  return status instanceof HTMLElement ? status : null;
}

function slugFor(button: HTMLButtonElement): string {
  return button.dataset.helpHubCopySlug?.trim() ?? "";
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      const wrote = await Promise.race([
        navigator.clipboard.writeText(text).then(() => true),
        new Promise<boolean>((resolve) => {
          window.setTimeout(() => resolve(false), 700);
        }),
      ]);
      if (wrote) return true;
    }
  } catch {
    /* Fall through to the older copy command. */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

function showResult(button: HTMLButtonElement, message: string, copied: boolean): void {
  const status = statusFor(button);
  if (copied) button.textContent = COPIED_LABEL;
  if (status) status.textContent = message;
  const previous = button.dataset.helpHubCopyTimer;
  if (previous) window.clearTimeout(Number(previous));
  const timer = window.setTimeout(() => {
    button.textContent = COPY_LABEL;
    if (status) status.textContent = "";
    delete button.dataset.helpHubCopyTimer;
  }, 2000);
  button.dataset.helpHubCopyTimer = String(timer);
}

/** Copy the permanent article URL. The button's slug is read when it is clicked. */
export function initHelpHubCopyLinks(root: ParentNode): void {
  root.querySelectorAll("[data-help-hub-copy-link]").forEach((node) => {
    if (!(node instanceof HTMLButtonElement)) return;
    if (node.dataset.helpHubCopyBound === "true") return;
    node.dataset.helpHubCopyBound = "true";
    node.addEventListener("click", () => {
      const url = helpHubArticleAbsoluteUrl(slugFor(node), window.location.origin);
      if (!url) {
        showResult(node, "Could not copy the link", false);
        return;
      }
      void writeClipboard(url).then((copied) => {
        showResult(node, copied ? "Link copied" : "Could not copy the link", copied);
      });
    });
  });
}
