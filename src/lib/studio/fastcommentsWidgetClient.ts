/**
 * Browser mount for the Studio comment proof.
 * Identity comes from /api/studio/fastcomments-sso. This file never sees the API secret.
 */
import { readMemberstackBearerToken } from "../admin/adminAuthClient";
import { openMemberstackLoginModal } from "../memberstackLogin";
import {
  STUDIO_COMMENTS_POC_API,
  STUDIO_FASTCOMMENTS_TENANT_ID,
  STUDIO_FASTCOMMENTS_URL_ID,
  studioDiscussionId,
} from "./fastcommentsPocAccess";

type SecureSsoWidgetUser = {
  userDataJSONBase64: string;
  verificationHash: string;
  timestamp: number;
};

const EMBED_SRC = "https://cdn.fastcomments.com/js/embed-v2.min.js";

export type StudioCommentSession = {
  ok: boolean;
  tenantId: string;
  urlId: string;
  authenticated: boolean;
  displayName: string | null;
  sso: SecureSsoWidgetUser | null;
  code: string | null;
};

type FastCommentsConfig = {
  tenantId: string;
  urlId: string;
  sso: {
    userDataJSONBase64?: string;
    verificationHash?: string;
    timestamp?: number;
    loginCallback: () => void;
    logoutCallback: () => void;
  };
};

declare global {
  interface Window {
    FastCommentsUI?: (element: HTMLElement, config: FastCommentsConfig) => void;
  }
}

function commenterLabel(displayName: string): string {
  return displayName.endsWith(".") ? displayName : `${displayName}.`;
}

export function studioCommentLoginVisible(session: StudioCommentSession): boolean {
  return !session.authenticated;
}

export function studioCommentStatusMessage(session: StudioCommentSession): string {
  switch (session.code) {
    case "fastcomments-secret-missing":
      return session.displayName
        ? `Signed in as ${commenterLabel(session.displayName)} Comment signing is not configured on this server yet, so posting stays locked.`
        : "Comment signing is not configured on this server yet, so posting stays locked.";
    case "memberstack-sandbox-secret-missing":
      return "This server cannot verify the kin-dev Memberstack test session yet, so posting stays locked.";
    case "member-name-missing":
      return "This account has no first name on file, so posting stays locked.";
    case "member-email-missing":
      return "This account has no email on file, so posting stays locked.";
    case "member-lookup-failed":
      return "The member record could not be read, so posting stays locked.";
    case "session-invalid":
      return "The Memberstack session could not be verified. Log in again to comment.";
    default:
      if (session.authenticated && session.displayName && session.sso) {
        return `Commenting as ${commenterLabel(session.displayName)}`;
      }
      return "Log in with your Knit it Now account to comment.";
  }
}

/**
 * Comment thread for one Studio session.
 * A missing or numeric id stays on the local test thread.
 */
export function studioWidgetDiscussionId(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  const prefix = "studio-post:";
  if (!raw.startsWith(prefix)) return STUDIO_FASTCOMMENTS_URL_ID;
  try {
    return studioDiscussionId(raw.slice(prefix.length));
  } catch {
    return STUDIO_FASTCOMMENTS_URL_ID;
  }
}

/** Widget config without callbacks. Never includes simpleSSO or a signing secret. */
export function studioFastcommentsBaseConfig(session: StudioCommentSession): {
  tenantId: string;
  urlId: string;
  sso: {
    userDataJSONBase64?: string;
    verificationHash?: string;
    timestamp?: number;
  };
} {
  const sso: {
    userDataJSONBase64?: string;
    verificationHash?: string;
    timestamp?: number;
  } = {};
  if (session.sso?.userDataJSONBase64 && session.sso.verificationHash && session.sso.timestamp) {
    sso.userDataJSONBase64 = session.sso.userDataJSONBase64;
    sso.verificationHash = session.sso.verificationHash;
    sso.timestamp = session.sso.timestamp;
  }
  return {
    tenantId: session.tenantId || STUDIO_FASTCOMMENTS_TENANT_ID,
    urlId: STUDIO_FASTCOMMENTS_URL_ID,
    sso,
  };
}

function loggedOutSession(): StudioCommentSession {
  return {
    ok: true,
    tenantId: STUDIO_FASTCOMMENTS_TENANT_ID,
    urlId: STUDIO_FASTCOMMENTS_URL_ID,
    authenticated: false,
    displayName: null,
    sso: null,
    code: null,
  };
}

export async function fetchStudioCommentSession(
  fetchImpl: typeof fetch = fetch,
  readToken: () => Promise<string | null> = () => readMemberstackBearerToken(),
): Promise<StudioCommentSession> {
  const token = await readToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchImpl(STUDIO_COMMENTS_POC_API, {
    method: "GET",
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok && response.status !== 503 && response.status !== 401) {
    return { ...loggedOutSession(), ok: false, code: "session-invalid" };
  }
  try {
    const body = (await response.json()) as Partial<StudioCommentSession>;
    return {
      ok: body.ok === true,
      tenantId: typeof body.tenantId === "string" ? body.tenantId : STUDIO_FASTCOMMENTS_TENANT_ID,
      urlId: STUDIO_FASTCOMMENTS_URL_ID,
      authenticated: body.authenticated === true,
      displayName: typeof body.displayName === "string" ? body.displayName : null,
      sso: body.sso?.userDataJSONBase64 ? (body.sso as SecureSsoWidgetUser) : null,
      code: typeof body.code === "string" ? body.code : null,
    };
  } catch {
    return { ...loggedOutSession(), ok: false, code: "session-invalid" };
  }
}

function loadEmbed(): Promise<void> {
  if (typeof window.FastCommentsUI === "function") return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${EMBED_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("FastComments did not load")), {
        once: true,
      });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = EMBED_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("FastComments did not load"));
    document.head.appendChild(script);
  });
}

async function logoutOfMemberstack(): Promise<void> {
  const logout = window.$memberstackDom?.logout;
  if (!logout) {
    window.location.reload();
    return;
  }
  try {
    await logout();
  } catch {
    /* reload still clears the widget session */
  }
  window.location.reload();
}

export async function mountStudioFastcomments(root: ParentNode = document): Promise<void> {
  const status = root.querySelector<HTMLElement>("[data-studio-comments-status]");
  const mount = root.querySelector<HTMLElement>("[data-studio-comments-mount]");
  if (!status || !mount) return;

  let session = loggedOutSession();
  try {
    session = await fetchStudioCommentSession();
  } catch {
    session = { ...loggedOutSession(), ok: false, code: "session-invalid" };
  }
  status.textContent = studioCommentStatusMessage(session);
  const loginButton = root.querySelector<HTMLButtonElement>("[data-studio-comments-login]");
  if (loginButton) {
    loginButton.hidden = !studioCommentLoginVisible(session);
    loginButton.onclick = () => {
      openMemberstackLoginModal(window.location.pathname);
    };
  }

  const loginCallback = () => {
    if (session.authenticated) {
      status.textContent = studioCommentStatusMessage(session);
      return;
    }
    openMemberstackLoginModal(window.location.pathname);
  };
  const logoutCallback = () => {
    void logoutOfMemberstack();
  };

  try {
    await loadEmbed();
  } catch {
    status.textContent = "The comment widget did not load. Check the FastComments domain allowlist for kin-dev.netlify.app.";
    return;
  }
  if (typeof window.FastCommentsUI !== "function") {
    status.textContent = "The comment widget did not load. Check the FastComments domain allowlist for kin-dev.netlify.app.";
    return;
  }

  mount.replaceChildren();
  const widget = document.createElement("div");
  widget.id = "fastcomments-widget";
  mount.appendChild(widget);
  const base = studioFastcommentsBaseConfig(session);
  window.FastCommentsUI(widget, {
    ...base,
    urlId: studioWidgetDiscussionId(mount.getAttribute("data-studio-discussion-id")),
    sso: {
      ...base.sso,
      loginCallback,
      logoutCallback,
    },
  });

  const flagged = window as Window & { __kbmStudioCommentsLoginBound?: boolean };
  if (!flagged.__kbmStudioCommentsLoginBound) {
    flagged.__kbmStudioCommentsLoginBound = true;
    window.$memberstackDom?.on?.("member.login", () => {
      void mountStudioFastcomments(root);
    });
  }
}
