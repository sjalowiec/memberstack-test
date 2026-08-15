/**
 * TEMPORARY Hat finished-pattern access diagnostic.
 * Dev/localhost/Netlify-dev only. Do not ship as permanent production UI.
 */
import { detectSiteEnvironment } from "../../env/siteEnvironment";
import {
  getViewerAccessState,
  isMemberLoggedIn,
  type ViewerAccessState,
} from "../../memberAccess";
import { memberEmailFromMemberstackPayload, memberIdFromMemberstackPayload } from "../memberstackMember";
import { isEditingSavedHatProject, readHatActiveProjectId } from "./hatSavedProject";
import {
  hatPatternHasMemberSavedProjectPrivileges,
  readHatPatternAccessSnapshot,
  readLastHatPatternMemberstackPayload,
  resolveHatPatternWorkspaceAccess,
  type HatMemberAccessSnapshot,
} from "./hatPatternWorkspaceAccess";

const BADGE_ID = "kbm-hat-access-debug";
const LOG_PREFIX = "[hat-pattern.access-debug]";

export type HatPatternAccessDebugReport = {
  memberstackMemberFound: boolean;
  memberIdPresent: boolean;
  memberIdRedacted: string | null;
  emailPresent: boolean;
  kinMemberAccess: HatMemberAccessSnapshot | null;
  getViewerAccessState: ViewerAccessState | "n/a";
  kinMemberAccessReceived: ViewerAccessState | "none";
  hatWorkspace: "guest" | "member";
  viewerAccessState: ViewerAccessState;
  activeHatProjectId: string | null;
  saveAllowed: boolean;
  renameAllowed: boolean;
};

let lastKinEventState: ViewerAccessState | "none" = "none";
let lastPayload: unknown = null;

function redactId(id: string | null | undefined): string | null {
  const value = id?.trim() ?? "";
  if (!value) return null;
  if (value.length <= 4) return `${value[0]}…`;
  return `${value.slice(0, 4)}…${value.slice(-2)}`;
}

export function hatPatternAccessDiagnosticsEnabled(input?: {
  hostname?: string;
  isViteDev?: boolean;
  publicSiteEnv?: string | null;
}): boolean {
  const hostname =
    input?.hostname ??
    (typeof window !== "undefined" ? window.location?.hostname ?? "" : "");
  const env = detectSiteEnvironment(hostname, {
    isViteDev: input?.isViteDev ?? Boolean(import.meta.env?.DEV),
    publicSiteEnv:
      input?.publicSiteEnv !== undefined
        ? input.publicSiteEnv
        : typeof import.meta.env?.PUBLIC_SITE_ENV === "string"
          ? import.meta.env.PUBLIC_SITE_ENV
          : null,
  });
  return env !== "production";
}

export function noteHatPatternKinMemberAccessEvent(
  state: ViewerAccessState | null | undefined,
): void {
  if (state) lastKinEventState = state;
}

export function noteHatPatternMemberstackPayload(payload: unknown): void {
  lastPayload = payload;
}

export function resetHatPatternAccessDebugState(): void {
  lastKinEventState = "none";
  lastPayload = null;
}

export function buildHatPatternAccessDebugReport(
  viewerAccessState: ViewerAccessState,
): HatPatternAccessDebugReport {
  const payload = lastPayload ?? readLastHatPatternMemberstackPayload();
  const snapshot = readHatPatternAccessSnapshot();
  const fromPayload =
    payload !== null && payload !== undefined ? getViewerAccessState(payload) : "n/a";
  const memberId = memberIdFromMemberstackPayload(payload);
  const workspace = resolveHatPatternWorkspaceAccess(viewerAccessState);
  const saved = isEditingSavedHatProject();
  const projectId = readHatActiveProjectId().trim() || null;
  return {
    memberstackMemberFound: isMemberLoggedIn(payload),
    memberIdPresent: Boolean(memberId),
    memberIdRedacted: redactId(memberId),
    emailPresent: Boolean(memberEmailFromMemberstackPayload(payload)),
    kinMemberAccess: snapshot,
    getViewerAccessState: fromPayload,
    kinMemberAccessReceived: lastKinEventState,
    hatWorkspace: workspace.hasMemberSavedProjectPrivileges ? "member" : "guest",
    viewerAccessState,
    activeHatProjectId: redactId(projectId),
    saveAllowed: hatPatternHasMemberSavedProjectPrivileges(viewerAccessState),
    renameAllowed: hatPatternHasMemberSavedProjectPrivileges(viewerAccessState) && saved,
  };
}

function renderBadge(report: HatPatternAccessDebugReport): void {
  if (typeof document === "undefined") return;
  let el = document.getElementById(BADGE_ID);
  if (!el) {
    el = document.createElement("aside");
    el.id = BADGE_ID;
    el.setAttribute("data-hat-access-debug", "");
    el.setAttribute("data-testid", "hat-access-debug");
    el.style.cssText = [
      "position:fixed",
      "left:8px",
      "bottom:8px",
      "z-index:99999",
      "max-width:min(420px,calc(100vw - 16px))",
      "padding:8px 10px",
      "background:#111827",
      "color:#f9fafb",
      "font:12px/1.4 ui-monospace,Consolas,monospace",
      "border-radius:6px",
      "box-shadow:0 4px 16px rgba(0,0,0,.35)",
      "white-space:pre-wrap",
    ].join(";");
    const print = document.createElement("style");
    print.textContent = `@media print { #${BADGE_ID} { display: none !important; } }`;
    document.head.appendChild(print);
    document.body.appendChild(el);
  }
  el.textContent = [
    "HAT ACCESS DEBUG (temporary)",
    `memberstack member found: ${report.memberstackMemberFound ? "yes" : "no"}`,
    `member id present: ${report.memberIdPresent ? "yes" : "no"} ${report.memberIdRedacted ?? ""}`.trim(),
    `email present: ${report.emailPresent ? "yes" : "no"}`,
    `__KIN_MEMBER_ACCESS__: ${JSON.stringify(report.kinMemberAccess)}`,
    `getViewerAccessState(): ${report.getViewerAccessState}`,
    `kin:member-access received: ${report.kinMemberAccessReceived}`,
    `Hat workspace: ${report.hatWorkspace}`,
    `active Hat project id: ${report.activeHatProjectId ?? "null"}`,
    `save allowed: ${report.saveAllowed}`,
    `rename allowed: ${report.renameAllowed}`,
  ].join("\n");
}

export function logHatPatternAccessDiagnostics(viewerAccessState: ViewerAccessState): void {
  if (!hatPatternAccessDiagnosticsEnabled()) return;
  const report = buildHatPatternAccessDebugReport(viewerAccessState);
  console.info(LOG_PREFIX, report);
  renderBadge(report);
}
