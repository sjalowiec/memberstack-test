/**
 * Opens Circle Calculator technique cards in KinCatalogVideoModal.
 * The calculator page stays in place, so entries and results are kept.
 * Member videos request a player URL only after membership is confirmed.
 */
import { videoDevBypass } from "../devBypass";
import { getMembershipStatusAuthHeaders } from "../membership/membershipStatusClient";
import { CATALOG_VIDEO_EMBED_API_PATH } from "../../scripts/gatedVimeoEmbedClient";
import {
  planCircleVideoHelpClick,
  vimeoIdFromPlayerSrc,
} from "./circleCalculatorVideoHelp";

async function requestCircleVideoEmbedSrc(contentId: string): Promise<string | null> {
  const headers = await getMembershipStatusAuthHeaders();
  let response: Response;
  try {
    response = await fetch(
      `${CATALOG_VIDEO_EMBED_API_PATH}?contentId=${encodeURIComponent(contentId)}`,
      { method: "GET", headers, credentials: "same-origin" },
    );
  } catch {
    return null;
  }
  if (!response.ok) return null;
  let body: { ok?: boolean; iframeSrc?: string } | null = null;
  try {
    body = (await response.json()) as { ok?: boolean; iframeSrc?: string };
  } catch {
    return null;
  }
  const src = typeof body?.iframeSrc === "string" ? body.iframeSrc.trim() : "";
  if (body?.ok === false || !src.startsWith("https://player.vimeo.com/video/")) return null;
  return src;
}

function memberAccessGranted(): boolean {
  return window.__KIN_MEMBER_ACCESS__?.hasMemberAccess === true;
}

function applyCircleVideoHelpAccess(section: HTMLElement): void {
  const granted = videoDevBypass || memberAccessGranted();
  section.classList.toggle("is-unlocked", granted);
  section.querySelectorAll<HTMLButtonElement>("[data-circle-video-help]").forEach((button) => {
    if (granted || button.dataset.vimeoId) button.removeAttribute("aria-disabled");
    else button.setAttribute("aria-disabled", "true");
  });
}

function armCircleVideoHelpButton(button: HTMLButtonElement, iframeSrc: string): boolean {
  const vimeoId = vimeoIdFromPlayerSrc(iframeSrc);
  if (!vimeoId) return false;
  button.setAttribute("data-vimeo-defer", "");
  button.dataset.vimeoId = vimeoId;
  button.classList.add("kbm-kin-catalog-video");
  button.removeAttribute("aria-disabled");
  return true;
}

export function initCircleCalculatorVideoHelp(root: ParentNode = document): void {
  const section = root.querySelector("[data-circle-video-help-section]");
  if (!(section instanceof HTMLElement) || section.dataset.circleVideoHelpReady === "true") return;
  section.dataset.circleVideoHelpReady = "true";

  const syncAccess = () => applyCircleVideoHelpAccess(section);
  syncAccess();
  window.addEventListener("kin:member-access", syncAccess);

  section.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("[data-circle-video-help]");
    if (!(button instanceof HTMLButtonElement) || button.dataset.circleVideoHelpOpening === "true") return;

    const plan = planCircleVideoHelpClick({
      armedWithVimeoId: Boolean(button.dataset.vimeoId),
      hasMemberAccess: memberAccessGranted(),
      videoDevBypass,
    });
    if (plan === "open-modal") return;
    event.preventDefault();
    if (plan === "stay-locked") return;

    const contentId = button.dataset.contentId?.trim() ?? "";
    if (!contentId) return;
    button.dataset.circleVideoHelpOpening = "true";
    button.setAttribute("aria-busy", "true");
    void requestCircleVideoEmbedSrc(contentId)
      .then((iframeSrc) => {
        if (!iframeSrc || !armCircleVideoHelpButton(button, iframeSrc)) return;
        button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      })
      .finally(() => {
        delete button.dataset.circleVideoHelpOpening;
        button.removeAttribute("aria-busy");
      });
  });
}
