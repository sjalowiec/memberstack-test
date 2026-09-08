import { hasMemberAccess, getViewerAccessState } from "../lib/memberAccess";
import { ensureLegacyPaidThroughContext } from "../lib/memberAccessClient";
import { getMembershipStatusAuthHeaders } from "../lib/membership/membershipStatusClient";
import { openMemberstackLoginModal } from "../lib/memberstackLogin";
import { getMemberstackReturnPath } from "../lib/memberstackReturnUrl";
import { catalogVideoPlaybackAccess } from "../lib/videos/catalogVideoPlaybackAccess";
import { buildCatalogVimeoEmbedSrc } from "../lib/videos/catalogVideoEmbedSrc";
import { decideGatedVimeoPlayback } from "../lib/videos/gatedVimeoEmbedDelivery";

export const CATALOG_VIDEO_EMBED_API_PATH = "/.netlify/functions/catalog-video-embed";

async function waitForMemberstackReady({ attempts = 30, delayMs = 200 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const api = window.$memberstackDom?.getAppAndMember;
      if (typeof api === "function") return await api();
    } catch {
      /* keep polling until Memberstack is ready */
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

function readConfig(root: HTMLElement) {
  const contentId = (root.dataset.contentId ?? "").trim();
  const videoId = (root.dataset.videoId ?? "").trim();
  const slotKey = contentId || videoId;
  const slot = slotKey
    ? root.querySelector<HTMLElement>(`#kbm-vimeo-slot-${slotKey}`)
    : null;
  if (!slot) return null;

  return {
    root,
    slot,
    contentId,
    videoId,
    iframeSrc: (root.dataset.iframeSrc ?? "").trim(),
    title: root.dataset.videoTitle ?? "Video",
    videoDevBypass: root.dataset.videoDevBypass === "true",
    enableVimeoPlayerApi: root.dataset.enableVimeoPlayerApi === "true",
    accessLevel: catalogVideoPlaybackAccess({
      access_level: root.dataset.accessLevel ?? "member",
    }),
    iframePlayerId: videoId ? `kbm-gated-vimeo-${videoId}` : contentId ? `kbm-gated-vimeo-${contentId}` : "",
    ctaHref: root.dataset.ctaHref ?? "/membership",
    ctaText: root.dataset.ctaText ?? "Join to watch",
  };
}

async function fetchCatalogEmbedSrc(
  contentId: string,
  enableVimeoPlayerApi: boolean,
): Promise<string | null> {
  const headers = await getMembershipStatusAuthHeaders();
  const params = new URLSearchParams({ contentId });
  if (enableVimeoPlayerApi) params.set("playerApi", "1");
  const res = await fetch(`${CATALOG_VIDEO_EMBED_API_PATH}?${params.toString()}`, {
    method: "GET",
    headers,
    credentials: "same-origin",
  });
  if (!res.ok) return null;
  let body: { ok?: boolean; iframeSrc?: string } | null = null;
  try {
    body = (await res.json()) as { ok?: boolean; iframeSrc?: string };
  } catch {
    return null;
  }
  if (!body || body.ok === false) return null;
  const src = typeof body.iframeSrc === "string" ? body.iframeSrc.trim() : "";
  return src.startsWith("https://player.vimeo.com/video/") ? src : null;
}

function initGatedVimeoEmbed(root: HTMLElement) {
  const config = readConfig(root);
  if (!config) return;

  const {
    slot,
    contentId,
    videoId,
    iframeSrc: deliveredIframeSrc,
    title,
    videoDevBypass,
    enableVimeoPlayerApi,
    accessLevel,
    iframePlayerId,
    ctaHref,
    ctaText,
  } = config;

  const iframeIdAttr =
    enableVimeoPlayerApi && iframePlayerId ? ` id="${iframePlayerId}"` : "";
  let authListenersBound = false;
  let renderedSrc: string | null = accessLevel === "open" ? deliveredIframeSrc || null : null;

  function buildLockedMarkup(showLogin: boolean) {
    const loginBtn = showLogin
      ? `<button type="button" class="kbm-video__cta kbm-video__cta--login" data-kbm-video-login>Already a member? Log in</button>`
      : "";
    const membershipCta = `<a href="${ctaHref}" class="kbm-video__cta">${ctaText}</a>`;
    return `
  <div class="kbm-video__locked">
    <div class="kbm-video__overlay">
      <div class="kbm-video__lockline">
        <strong>Members only</strong>
      </div>
      <p>This video is available with membership.</p>
      <div class="kbm-video__actions">
        ${membershipCta}
        ${loginBtn}
      </div>
    </div>
  </div>
`;
  }

  function wireVideoLoginButton() {
    const btn = slot.querySelector("[data-kbm-video-login]");
    if (!(btn instanceof HTMLElement)) return;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openMemberstackLoginModal(getMemberstackReturnPath());
    });
  }

  function showLocked(showLogin: boolean) {
    renderedSrc = null;
    slot.innerHTML = buildLockedMarkup(showLogin);
    if (showLogin) wireVideoLoginButton();
    slot.setAttribute("data-state", "ready");
  }

  function showUnlockedIframe(src: string) {
    if (renderedSrc === src && slot.querySelector("iframe")) {
      slot.setAttribute("data-state", "ready");
      return;
    }
    renderedSrc = src;
    slot.innerHTML = `
        <iframe${iframeIdAttr}
          src="${src}"
          title="${title}"
          loading="lazy"
          frameborder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowfullscreen
          style="position:absolute; inset:0; width:100%; height:100%; border:0;"
        ></iframe>
      `;
    slot.setAttribute("data-state", "ready");
  }

  async function resolveEmbedSrc(hasAccess: boolean): Promise<string | null> {
    if (deliveredIframeSrc) return deliveredIframeSrc;
    if (contentId && (hasAccess || accessLevel === "open" || videoDevBypass)) {
      return fetchCatalogEmbedSrc(contentId, enableVimeoPlayerApi);
    }
    if (hasAccess && videoId) {
      return buildCatalogVimeoEmbedSrc({
        vimeoId: videoId,
        enableVimeoPlayerApi,
        iframePlayerId,
      });
    }
    return null;
  }

  async function resolveAccessAndRender() {
    try {
      if (accessLevel === "open") {
        const src = deliveredIframeSrc || (await resolveEmbedSrc(false));
        const decision = decideGatedVimeoPlayback({
          accessLevel,
          videoDevBypass,
          membershipResolved: true,
          hasMemberAccess: true,
          isLoggedIn: true,
          embedSrc: src,
        });
        if (decision.action === "unlock") showUnlockedIframe(decision.iframeSrc);
        return;
      }

      if (videoDevBypass) {
        const src = await resolveEmbedSrc(true);
        const decision = decideGatedVimeoPlayback({
          accessLevel,
          videoDevBypass: true,
          membershipResolved: true,
          hasMemberAccess: true,
          isLoggedIn: true,
          embedSrc: src,
        });
        if (decision.action === "unlock") {
          showUnlockedIframe(decision.iframeSrc);
          return;
        }
      }

      const res = await waitForMemberstackReady();
      await ensureLegacyPaidThroughContext(res);
      const viewerState = getViewerAccessState(res);
      const isLoggedIn = viewerState !== "loggedOut";
      const memberAccess = hasMemberAccess(res);
      const embedSrc = await resolveEmbedSrc(memberAccess);
      const decision = decideGatedVimeoPlayback({
        accessLevel,
        videoDevBypass: false,
        membershipResolved: true,
        hasMemberAccess: memberAccess,
        isLoggedIn,
        embedSrc,
      });

      if (decision.action === "unlock") {
        showUnlockedIframe(decision.iframeSrc);
        return;
      }
      if (decision.action === "lock") {
        showLocked(decision.showLogin);
        return;
      }
    } catch (error) {
      console.error("GatedVimeoEmbed resolveAccessAndRender failed:", error);
      showLocked(true);
    }
  }

  function bindMemberstackAuthRefresh() {
    if (authListenersBound) return;
    const ms = window.$memberstackDom;
    if (!ms || typeof ms.on !== "function") return;
    authListenersBound = true;
    ms.on("member.login", () => {
      void resolveAccessAndRender();
    });
    ms.on("member.logout", () => {
      void resolveAccessAndRender();
    });
  }

  void (async () => {
    await resolveAccessAndRender();
    bindMemberstackAuthRefresh();
    void window.$memberstackDom?.onReady?.then(() => {
      bindMemberstackAuthRefresh();
    });
    window.addEventListener("auth:updated", () => {
      void resolveAccessAndRender();
    });
  })();
}

/** Initialize all member-gated Vimeo embeds under `root`. */
export function initGatedVimeoEmbeds(root: ParentNode = document): void {
  root.querySelectorAll('.kbm-video[data-access-level="member"]').forEach((el) => {
    if (el instanceof HTMLElement) initGatedVimeoEmbed(el);
  });
}

export function runGatedVimeoEmbedBoot(): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initGatedVimeoEmbeds());
  } else {
    initGatedVimeoEmbeds();
  }
}
