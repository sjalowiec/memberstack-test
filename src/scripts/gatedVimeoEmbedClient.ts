import { hasKinVideoAccess, logKinVideoAccessDebug } from "../lib/kinVideoAccess";

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
  const videoId = root.dataset.videoId ?? "";
  const slot = root.querySelector<HTMLElement>(`#kbm-vimeo-slot-${videoId}`);
  if (!videoId || !slot) return null;

  return {
    root,
    slot,
    videoId,
    iframeSrc: root.dataset.iframeSrc ?? "",
    title: root.dataset.videoTitle ?? "Video",
    videoDevBypass: root.dataset.videoDevBypass === "true",
    enableVimeoPlayerApi: root.dataset.enableVimeoPlayerApi === "true",
    iframePlayerId: `kbm-gated-vimeo-${videoId}`,
    ctaHref: root.dataset.ctaHref ?? "/membership",
    ctaText: root.dataset.ctaText ?? "Join to watch",
  };
}

function initGatedVimeoEmbed(root: HTMLElement) {
  const config = readConfig(root);
  if (!config) return;

  const {
    slot,
    videoId,
    iframeSrc,
    title,
    videoDevBypass,
    enableVimeoPlayerApi,
    iframePlayerId,
    ctaHref,
    ctaText,
  } = config;

  const iframeIdAttr =
    enableVimeoPlayerApi && iframePlayerId ? ` id="${iframePlayerId}"` : "";
  let authListenersBound = false;

  function buildLockedMarkup(showLogin: boolean) {
    const loginBtn = showLogin
      ? `<button type="button" class="kbm-video__cta kbm-video__cta--login" data-kbm-video-login>Log in to watch</button>`
      : "";
    return `
  <div class="kbm-video__locked">
    <div class="kbm-video__overlay">
      <div class="kbm-video__lockline">
        ?? <strong>Members only</strong>
      </div>
      <p>This video is available with membership.</p>
      <div class="kbm-video__actions">
        ${loginBtn}
        <a href="${ctaHref}" class="kbm-video__cta">${ctaText}</a>
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
      if (typeof window.kbmOpenMemberstackLoginModal === "function") {
        window.kbmOpenMemberstackLoginModal();
        return;
      }
      const ms = window.$memberstackDom;
      if (ms && typeof ms.openModal === "function") {
        void ms.openModal("LOGIN");
      }
    });
  }

  function showLocked(showLogin: boolean) {
    slot.innerHTML = buildLockedMarkup(showLogin);
    if (showLogin) wireVideoLoginButton();
    slot.setAttribute("data-state", "ready");
  }

  function showUnlockedIframe() {
    slot.innerHTML = `
        <iframe${iframeIdAttr}
          src="${iframeSrc}"
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

  async function resolveAccessAndRender() {
    try {
      if (videoDevBypass) {
        console.log("[KBM video access debug]", "GatedVimeoEmbed.unlock", {
          videoId,
          reason: "videoDevBypass(PUBLIC_DEV_BYPASS_GATING=true)",
        });
        showUnlockedIframe();
        return;
      }

      const res = await waitForMemberstackReady();
      const member = res?.data?.member ?? null;
      const isLoggedIn = Boolean(member);
      const rawKinAccess = member?.customFields?.["kin-access"];
      const hasVideoAccess = res ? hasKinVideoAccess(res) : false;

      logKinVideoAccessDebug("GatedVimeoEmbed.iframe", {
        member: res,
        rawKinAccess,
        finalHasVideoAccess: hasVideoAccess,
      });

      if (!hasVideoAccess) {
        showLocked(!isLoggedIn);
        return;
      }

      showUnlockedIframe();
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
