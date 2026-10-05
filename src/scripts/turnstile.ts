/** Cloudflare Turnstile client helpers (explicit render). */

export type TurnstileApi = {
  ready: (callback: () => void) => void;
  render: (
    container: string | HTMLElement,
    options: {
      sitekey: string;
      appearance?: "always" | "execute" | "interaction-only";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __kbmTurnstileLoaded?: boolean;
  }
}

const widgetIds = new WeakMap<HTMLElement, string>();

function getSiteKey(slot: HTMLElement): string {
  return (slot.dataset.sitekey || "").trim();
}

function getStoredWidgetId(slot: HTMLElement): string | undefined {
  return widgetIds.get(slot) || slot.dataset.widgetId || undefined;
}

function storeWidgetId(slot: HTMLElement, id: string) {
  widgetIds.set(slot, id);
  slot.dataset.widgetId = id;
}

/** Wait until `window.turnstile` is available (api.js is async). */
export function whenTurnstileReady(callback: () => void): void {
  if (typeof window === "undefined") return;

  // api.js is loaded with async/defer. turnstile.ready() throws in that mode;
  // the onload callback and this waiter only run after window.turnstile exists.
  const run = () => {
    if (window.turnstile) callback();
  };

  if (window.turnstile) {
    run();
    return;
  }

  let settled = false;
  const finish = () => {
    if (settled || !window.turnstile) return;
    settled = true;
    window.clearInterval(timer);
    window.clearTimeout(timeout);
    document.removeEventListener("kbm-turnstile-api", onApi);
    run();
  };
  const onApi = () => finish();
  const timer = window.setInterval(finish, 100);
  const timeout = window.setTimeout(() => {
    settled = true;
    window.clearInterval(timer);
    document.removeEventListener("kbm-turnstile-api", onApi);
  }, 15000);
  document.addEventListener("kbm-turnstile-api", onApi);
}

/**
 * Render (or reset) a Turnstile widget in a slot element.
 * Slots use: data-turnstile-slot data-sitekey="..."
 */
export function ensureTurnstileWidget(slot: HTMLElement | null): string | null {
  if (!slot || !window.turnstile) return null;
  const sitekey = getSiteKey(slot);
  if (!sitekey) return null;

  const existing = getStoredWidgetId(slot);
  if (existing) {
    try {
      window.turnstile.reset(existing);
      return existing;
    } catch {
      try {
        window.turnstile.remove(existing);
      } catch {
        /* ignore */
      }
      widgetIds.delete(slot);
      delete slot.dataset.widgetId;
    }
  }

  const id = window.turnstile.render(slot, {
    sitekey,
    appearance: "interaction-only",
  });
  storeWidgetId(slot, id);
  return id;
}

/** Reset a previously rendered widget so the next submit gets a fresh token. */
export function resetTurnstileWidget(slot: HTMLElement | null): void {
  if (!slot || !window.turnstile) return;
  const id = getStoredWidgetId(slot);
  if (!id) return;
  try {
    window.turnstile.reset(id);
  } catch {
    /* ignore */
  }
}

/**
 * Render page-level Turnstile slots. Skips the Contact Sue modal until it opens
 * (modal is `display:none` and must be rendered when shown).
 */
export function initPageTurnstileWidgets(root: ParentNode = document): void {
  whenTurnstileReady(() => {
    root.querySelectorAll<HTMLElement>("[data-turnstile-slot]").forEach((slot) => {
      const modal = slot.closest("#contact-modal");
      if (modal && !modal.classList.contains("contact-modal--open")) {
        return;
      }
      ensureTurnstileWidget(slot);
    });
  });
}

export function getTurnstileSlot(container: ParentNode | null): HTMLElement | null {
  if (!container) return null;
  return container.querySelector<HTMLElement>("[data-turnstile-slot]");
}
