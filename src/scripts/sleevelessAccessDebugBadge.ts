/**
 * LOCALHOST-ONLY access-source debug badge for Dynamic Patterns.
 *
 * Renders a small fixed overlay showing HOW the current visitor's access was resolved:
 *   - memberstack-plan → active membership plan id in MEMBER_PLAN_IDS
 *   - free             → logged-in without active membership (no pattern access)
 *   - logged-out       → no Memberstack member
 *
 * Diagnostic only. Lifetime / JSON unlock metadata may appear in the detail text but never
 * grant access.
 *
 * Safety: gated behind `import.meta.env.DEV` AND a localhost hostname check.
 */
import { memberIdFromMemberstackPayload } from "../lib/patterns/memberstackMember";
import { waitForMemberstackDom } from "../lib/patterns/sleevelessPatternLoginGate";
import {
  getSleevelessAccessDebug,
  resolveSleevelessUserAccess,
  type SleevelessAccessSource,
} from "../lib/patterns/sleevelessPatternSystemAccessClient";

const BADGE_ID = "kbm-sleeveless-access-debug-badge";
const COLLAPSED_LS_KEY = "kbm_sleeveless_access_debug_collapsed";

interface RealMemberProbe {
  loggedIn: boolean;
  memberId?: string;
  resolved: boolean;
}

let realMember: RealMemberProbe = { loggedIn: false, resolved: false };

async function probeRealMemberstackMember(): Promise<RealMemberProbe> {
  if (typeof window === "undefined") return { loggedIn: false, resolved: true };
  await waitForMemberstackDom();
  const ms = window.$memberstackDom;
  if (!ms?.getCurrentMember) return { loggedIn: false, resolved: true };
  try {
    const payload = await ms.getCurrentMember();
    const memberId = memberIdFromMemberstackPayload(payload);
    return { loggedIn: Boolean(memberId), memberId: memberId || undefined, resolved: true };
  } catch {
    return { loggedIn: false, resolved: true };
  }
}

interface SourceStyle {
  label: string;
  bg: string;
  note: string;
}

const SOURCE_STYLES: Record<SleevelessAccessSource, SourceStyle> = {
  "memberstack-plan": {
    label: "MEMBERSTACK PLAN",
    bg: "#15803d",
    note: "Access granted by active membership (hasMemberAccess / MEMBER_PLAN_IDS).",
  },
  free: {
    label: "NO MEMBERSHIP",
    bg: "#475569",
    note: "Logged in without active membership — Dynamic Patterns stay locked.",
  },
  "logged-out": {
    label: "LOGGED OUT",
    bg: "#b91c1c",
    note: "No Memberstack member detected.",
  },
};

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_LS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_LS_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function ensureBadge(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(BADGE_ID);
  if (el) return el;

  el = document.createElement("aside");
  el.id = BADGE_ID;
  el.setAttribute("data-kbm-sleeveless-access-debug", "");
  el.style.cssText = [
    "position:fixed",
    "bottom:12px",
    "right:12px",
    "z-index:99999",
    "max-width:min(92vw,22rem)",
    "font:12px/1.4 ui-sans-serif,system-ui,sans-serif",
    "color:#fff",
    "border-radius:10px",
    "box-shadow:0 8px 24px rgba(0,0,0,.25)",
    "overflow:hidden",
  ].join(";");

  const header = document.createElement("button");
  header.type = "button";
  header.setAttribute("data-debug-header", "");
  header.style.cssText =
    "display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:0;background:inherit;color:inherit;cursor:pointer;text-align:left;font:inherit;";
  header.innerHTML = `<strong data-debug-label>PATTERN ACCESS</strong><span data-debug-toggle aria-hidden="true">▾</span>`;
  el.appendChild(header);

  const body = document.createElement("div");
  body.setAttribute("data-debug-body", "");
  body.style.cssText = "padding:0 10px 10px;white-space:pre-wrap;";
  el.appendChild(body);

  header.addEventListener("click", () => {
    const collapsed = el!.getAttribute("data-collapsed") !== "1";
    el!.setAttribute("data-collapsed", collapsed ? "1" : "0");
    body.hidden = collapsed;
    const toggle = header.querySelector("[data-debug-toggle]");
    if (toggle) toggle.textContent = collapsed ? "▸" : "▾";
    writeCollapsed(collapsed);
  });

  document.body.appendChild(el);
  if (readCollapsed()) {
    el.setAttribute("data-collapsed", "1");
    body.hidden = true;
    const toggle = header.querySelector("[data-debug-toggle]");
    if (toggle) toggle.textContent = "▸";
  }
  return el;
}

function renderBadge(): void {
  const el = ensureBadge();
  if (!el) return;

  const debug = getSleevelessAccessDebug();
  const source: SleevelessAccessSource = debug?.source ?? "logged-out";
  const style = SOURCE_STYLES[source];
  el.style.background = style.bg;

  const label = el.querySelector("[data-debug-label]");
  if (label) label.textContent = style.label;

  const body = el.querySelector("[data-debug-body]");
  if (!(body instanceof HTMLElement)) return;

  const lines = [
    style.note,
    "",
    `hasSystemAccess: ${debug?.hasSystemAccess ?? false}`,
    `loggedIn (access): ${debug?.loggedIn ?? false}`,
    `real Memberstack: ${realMember.resolved ? (realMember.loggedIn ? "yes" : "no") : "checking…"}`,
    `memberId: ${debug?.memberId ?? realMember.memberId ?? "—"}`,
    `planIds: ${(debug?.planIds ?? []).join(", ") || "—"}`,
    `jsonUnlock (ignored): ${debug?.unlockedViaJson ? "yes" : "no"}`,
  ];
  body.textContent = lines.join("\n");
}

async function boot(): Promise<void> {
  if (!import.meta.env.DEV || !isLocalhost()) return;
  await resolveSleevelessUserAccess();
  realMember = await probeRealMemberstackMember();
  renderBadge();
  window.setInterval(() => {
    void resolveSleevelessUserAccess().then(() => {
      renderBadge();
    });
  }, 2500);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      void boot();
    });
  } else {
    void boot();
  }
}
