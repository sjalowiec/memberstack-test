/**
 * LOCALHOST-ONLY access-source debug badge for the Sleeveless Pattern System.
 *
 * Renders a small fixed overlay showing HOW the current visitor's access was resolved:
 *   - dev-bypass         → PUBLIC_DEV_BYPASS_GATING short-circuit (NOT real Memberstack)
 *   - memberstack-plan   → a granting Memberstack plan id was found on the member
 *   - member-json-unlock → the `sleevelessPatternSystemUnlocked` member-JSON flag
 *   - free               → logged-in member with no granting plan / unlock
 *   - logged-out         → no Memberstack member
 *
 * This is diagnostic only. It never changes access rules — it just reads the snapshot from
 * `resolveSleevelessUserAccess()` and the diagnostic recorded by `sleevelessPatternSystemAccessClient`.
 *
 * Safety: the whole module is gated behind `import.meta.env.DEV` (Astro dev server) AND a localhost
 * hostname check, so production builds dead-code-eliminate it and it never appears on deployed sites.
 */
import { devBypass } from "../lib/devBypass";
import { memberIdFromMemberstackPayload } from "../lib/patterns/memberstackMember";
import { waitForMemberstackDom } from "../lib/patterns/sleevelessPatternLoginGate";
import {
  getSleevelessAccessDebug,
  resolveSleevelessUserAccess,
  type SleevelessAccessSource,
} from "../lib/patterns/sleevelessPatternSystemAccessClient";

const BADGE_ID = "kbm-sleeveless-access-debug-badge";
const COLLAPSED_LS_KEY = "kbm_sleeveless_access_debug_collapsed";

/**
 * Independent read of the REAL Memberstack member, ignoring dev bypass entirely.
 * The access snapshot's `loggedIn` is forced true under dev bypass; this probe reflects whether an
 * actual current Memberstack member exists (matching what the site header shows).
 */
interface RealMemberProbe {
  /** True only when Memberstack reports an actual current member. */
  loggedIn: boolean;
  memberId?: string;
  /** True once the probe has run (so the badge can show "checking…" first). */
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
  "dev-bypass": {
    label: "DEV BYPASS",
    bg: "#b45309",
    note: "Not real Memberstack. Set PUBLIC_DEV_BYPASS_GATING=false to test real plans.",
  },
  "memberstack-plan": {
    label: "MEMBERSTACK PLAN",
    bg: "#15803d",
    note: "Access granted by a Memberstack plan connection.",
  },
  "member-json-unlock": {
    label: "MEMBER JSON UNLOCK",
    bg: "#0e7490",
    note: "Access granted by the sleevelessPatternSystemUnlocked member-JSON flag.",
  },
  free: {
    label: "FREE USER",
    bg: "#475569",
    note: "Logged in, no granting plan/unlock — free one-time allowance applies.",
  },
  "logged-out": {
    label: "LOGGED OUT",
    bg: "#b91c1c",
    note: "No Memberstack member detected.",
  },
};

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function row(label: string, value: string): string {
  return `<div style="display:flex;gap:8px;justify-content:space-between;">
    <span style="opacity:.7;">${escapeHtml(label)}</span>
    <span style="font-weight:600;text-align:right;word-break:break-all;">${escapeHtml(value)}</span>
  </div>`;
}

function ensureBadgeEl(): HTMLElement {
  let el = document.getElementById(BADGE_ID);
  if (el) return el;
  el = document.createElement("div");
  el.id = BADGE_ID;
  el.style.cssText = [
    "position:fixed",
    "z-index:2147483646",
    "bottom:12px",
    "left:12px",
    "max-width:320px",
    "font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
    "color:#f8fafc",
    "background:#0f172a",
    "border:1px solid rgba(248,250,252,.18)",
    "border-radius:10px",
    "box-shadow:0 6px 20px rgba(0,0,0,.35)",
    "overflow:hidden",
  ].join(";");
  document.body.appendChild(el);
  return el;
}

function isCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_LS_KEY) === "1";
  } catch {
    return false;
  }
}

function setCollapsed(next: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_LS_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function render(): void {
  const debug = getSleevelessAccessDebug();
  const source: SleevelessAccessSource = debug?.source ?? "logged-out";
  const style = SOURCE_STYLES[source];
  const el = ensureBadgeEl();
  const collapsed = isCollapsed();

  const envBypass = String(import.meta.env.PUBLIC_DEV_BYPASS_GATING ?? "(unset)");

  // Authoritative real-login readout (matches the site header), independent of dev bypass.
  const realLoggedIn = realMember.resolved ? realMember.loggedIn : null;
  const realLoggedInLabel = realLoggedIn === null ? "checking…" : String(realLoggedIn);

  // Header label clarifies dev-bypass-while-logged-out, the case that was misleading before.
  let headerLabel = style.label;
  if (source === "dev-bypass" && realLoggedIn === false) {
    headerLabel = "DEV BYPASS · NOT LOGGED IN";
  } else if (source === "dev-bypass" && realLoggedIn === true) {
    headerLabel = "DEV BYPASS · LOGGED IN";
  }

  const mismatchNote =
    source === "dev-bypass" && realLoggedIn === false
      ? `<div style="margin-top:4px;padding:6px 8px;border-radius:6px;background:rgba(248,250,252,.12);">
          No real Memberstack member. <b>hasSystemAccess</b> here comes from dev bypass, not a login.
        </div>`
      : "";

  const header = `<div data-kbm-access-debug-header
      style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 10px;background:${style.bg};">
      <span style="width:8px;height:8px;border-radius:50%;background:#f8fafc;flex:0 0 auto;"></span>
      <span style="font-weight:700;letter-spacing:.04em;flex:1 1 auto;">${escapeHtml(headerLabel)}</span>
      <span style="opacity:.85;">${collapsed ? "▸" : "▾"}</span>
    </div>`;

  const body = collapsed
    ? ""
    : `<div style="padding:10px;display:flex;flex-direction:column;gap:5px;">
        <div style="opacity:.85;margin-bottom:2px;">${escapeHtml(style.note)}</div>
        ${row("Memberstack member", realLoggedInLabel)}
        ${realMember.memberId ? row("real memberId", realMember.memberId) : ""}
        <hr style="border:none;border-top:1px solid rgba(248,250,252,.15);margin:4px 0;" />
        ${row("source", source)}
        ${row("hasSystemAccess", String(debug?.hasSystemAccess ?? false))}
        ${row("freeClaimed", String(debug?.freeClaimed ?? false))}
        ${debug?.freeClaimedPatternId ? row("claimedPatternId", debug.freeClaimedPatternId) : ""}
        ${row("planIds", debug?.planIds?.length ? debug.planIds.join(", ") : "(none)")}
        ${row("jsonUnlock", String(debug?.unlockedViaJson ?? false))}
        ${row("snapshot.loggedIn", String(debug?.loggedIn ?? false))}
        ${debug?.reason ? row("reason", debug.reason) : ""}
        ${mismatchNote}
        <hr style="border:none;border-top:1px solid rgba(248,250,252,.15);margin:4px 0;" />
        ${row("PUBLIC_DEV_BYPASS_GATING", envBypass)}
        ${row("devBypass active", String(devBypass))}
        <div style="opacity:.7;margin-top:2px;">
          To test real plans: set PUBLIC_DEV_BYPASS_GATING=false in .env and restart dev, then log in.
        </div>
      </div>`;

  el.innerHTML = header + body;

  const headerEl = el.querySelector<HTMLElement>("[data-kbm-access-debug-header]");
  headerEl?.addEventListener("click", () => {
    setCollapsed(!isCollapsed());
    render();
  });
}

async function init(): Promise<void> {
  if (!import.meta.env.DEV) return;
  if (!isLocalhost()) return;
  if (typeof document === "undefined") return;

  // Render immediately with whatever is cached, then refresh after both reads complete.
  render();
  try {
    await Promise.all([
      resolveSleevelessUserAccess(),
      probeRealMemberstackMember().then((probe) => {
        realMember = probe;
      }),
    ]);
  } catch {
    /* ignore — render still shows whatever resolved */
  }
  render();

  const ms = window.$memberstackDom;
  if (ms && typeof ms.on === "function") {
    const refresh = (): void => {
      void Promise.all([
        resolveSleevelessUserAccess(),
        probeRealMemberstackMember().then((probe) => {
          realMember = probe;
        }),
      ]).then(() => render());
    };
    ms.on("member.login", refresh);
    ms.on("member.logout", refresh);
  }
}

if (import.meta.env.DEV && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
}
