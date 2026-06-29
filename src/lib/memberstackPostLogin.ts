/** Close the Memberstack modal and tell gated UI (videos, header, etc.) to re-check access. */
export function notifyMemberstackLoginSuccess(): void {
  window.$memberstackDom?.hideModal?.();
  window.dispatchEvent(new Event("auth:updated"));
}

let loginHandlersBound = false;
let fetchLoginPatched = false;

function bindMemberstackLoginListener(): boolean {
  const ms = window.$memberstackDom;
  if (!ms?.on || loginHandlersBound) return Boolean(ms?.on);

  loginHandlersBound = true;
  ms.on("member.login", () => {
    window.setTimeout(notifyMemberstackLoginSuccess, 100);
  });
  return true;
}

/** Detect successful modal login when Memberstack events are unreliable (Netlify prebuilt UI). */
function patchFetchLoginSuccess(): void {
  if (fetchLoginPatched || typeof window.fetch !== "function") return;
  fetchLoginPatched = true;

  const origFetch = window.fetch.bind(window);
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const res = await origFetch(...args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url ?? "";
      if (url.includes("/auth/login") && res.ok) {
        window.setTimeout(notifyMemberstackLoginSuccess, 100);
      }
    } catch {
      /* ignore */
    }
    return res;
  };
}

/** Site-wide: bind member.login + fetch fallback once Memberstack DOM is available. */
export function initMemberstackPostLoginHandlers(): void {
  patchFetchLoginSuccess();
  bindMemberstackLoginListener();

  void window.$memberstackDom?.onReady?.then(() => {
    bindMemberstackLoginListener();
  });

  let attempts = 0;
  const poll = window.setInterval(() => {
    attempts += 1;
    if (bindMemberstackLoginListener() || attempts >= 50) {
      window.clearInterval(poll);
    }
  }, 200);
}
