import { QUICK_HELP_SESSION } from "../config/quickHelpSession";
import { memberIdFromMemberstackPayload } from "../lib/patterns/memberstackMember";

type MemberstackPurchaseCheckout = (opts: {
  priceId: string;
  successUrl?: string;
  cancelUrl?: string;
  autoRedirect?: boolean;
}) => Promise<{ data?: { url?: string } }>;

type MemberstackError = {
  code?: string;
  message?: string;
};

const STATUS_ID = "quick-help-checkout-status";

function showStatus(message: string, tone: "info" | "error" | "success" = "info"): void {
  const el = document.getElementById(STATUS_ID);
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  el.classList.remove(
    "quick-help-checkout-status--info",
    "quick-help-checkout-status--error",
    "quick-help-checkout-status--success",
  );
  el.classList.add(`quick-help-checkout-status--${tone}`);
}

function clearStatus(): void {
  const el = document.getElementById(STATUS_ID);
  if (!el) return;
  el.hidden = true;
  el.textContent = "";
}

function memberstackErrorInfo(error: unknown): MemberstackError {
  if (error && typeof error === "object") return error as MemberstackError;
  if (typeof error === "string") return { message: error };
  return { message: "Something went wrong starting checkout." };
}

async function waitForMemberstackDom() {
  for (let i = 0; i < 35; i++) {
    const ms = window.$memberstackDom;
    if (ms?.getCurrentMember) {
      if (ms.onReady) await ms.onReady;
      return ms;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return window.$memberstackDom;
}

function setCheckoutBusy(busy: boolean): void {
  document.querySelectorAll<HTMLButtonElement>("[data-quick-help-checkout]").forEach((btn) => {
    btn.disabled = busy;
    btn.setAttribute("aria-busy", busy ? "true" : "false");
  });
}

async function startQuickHelpCheckout(): Promise<void> {
  clearStatus();
  setCheckoutBusy(true);

  try {
    const ms = await waitForMemberstackDom();

    if (!ms?.getCurrentMember) {
      showStatus("Checkout is not ready yet. Please refresh and try again.", "error");
      return;
    }

    const purchasePlansWithCheckout = (ms as Record<string, unknown>)
      .purchasePlansWithCheckout as MemberstackPurchaseCheckout | undefined;

    if (typeof purchasePlansWithCheckout !== "function") {
      showStatus("Checkout is unavailable. Please refresh and try again.", "error");
      return;
    }

    let memberPayload: unknown = null;
    try {
      memberPayload = await ms.getCurrentMember();
    } catch (error) {
      console.error("[quick help checkout] getCurrentMember failed:", error);
    }

    if (!memberIdFromMemberstackPayload(memberPayload)) {
      showStatus("Create your account or log in to continue to checkout.", "info");

      const signupResult = await ms.openModal?.("SIGNUP");
      const signupType = (signupResult as { type?: string } | undefined)?.type;
      if (signupType !== "SIGNUP") {
        clearStatus();
        return;
      }

      memberPayload = await ms.getCurrentMember();
      if (!memberIdFromMemberstackPayload(memberPayload)) {
        showStatus("Account created, but login did not complete. Try again or log in first.", "error");
        return;
      }
    }

    showStatus("Opening checkout...", "info");

    const checkoutResult = await purchasePlansWithCheckout.call(ms, {
      priceId: QUICK_HELP_SESSION.memberstackPriceId,
      successUrl: QUICK_HELP_SESSION.tidycalUrl,
      cancelUrl: window.location.href,
      autoRedirect: false,
    });

    const checkoutUrl = checkoutResult?.data?.url;
    if (typeof checkoutUrl === "string" && checkoutUrl.trim()) {
      window.location.href = checkoutUrl;
      return;
    }

    showStatus("Checkout did not return a redirect URL. Please try again.", "error");
  } catch (error) {
    const info = memberstackErrorInfo(error);
    console.error("[quick help checkout] error:", error);
    showStatus(info.message?.trim() || "Could not start checkout. Please try again.", "error");
  } finally {
    setCheckoutBusy(false);
  }
}

export function initQuickHelpCheckout(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-quick-help-checkout]").forEach((btn) => {
    btn.addEventListener("click", () => {
      void startQuickHelpCheckout();
    });
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector("[data-quick-help-checkout]")) {
      initQuickHelpCheckout();
    }
  });
}
