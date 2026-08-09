/**
 * Browser client for legacy ebook My Downloads.
 * Sends a verified Memberstack session JWT; never sends an email for ownership lookup.
 */

import { memberIdFromMemberstackPayload } from "../patterns/memberstackMember";

const API_PATH = "/.netlify/functions/my-ebook-downloads";

export type MyEbookDownloadItem = {
  itemId: string;
  title: string;
  downloadUrl: string;
};

export class MyEbookDownloadsAuthError extends Error {
  readonly status = 401;
  constructor(message = "Sign in required.") {
    super(message);
    this.name = "MyEbookDownloadsAuthError";
  }
}

export class MyEbookDownloadsApiError extends Error {
  readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "MyEbookDownloadsApiError";
    this.status = status;
  }
}

async function waitForMemberstackDom(maxAttempts = 35, intervalMs = 200) {
  for (let i = 0; i < maxAttempts; i++) {
    const ms = window.$memberstackDom;
    if (ms?.getCurrentMember) {
      if (ms.onReady) await ms.onReady;
      return ms;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return window.$memberstackDom;
}

/** Authorization header from Memberstack session cookie, or {} when logged out. */
export async function getMyEbookDownloadsAuthHeaders(): Promise<
  Record<string, string>
> {
  if (typeof window === "undefined") return {};
  try {
    const ms = await waitForMemberstackDom();
    const token = await ms?.getMemberCookie?.();
    if (typeof token === "string" && token.trim()) {
      return { Authorization: `Bearer ${token.trim()}` };
    }
  } catch {
    /* unauthenticated */
  }
  return {};
}

export async function isMyEbookDownloadsMemberLoggedIn(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const ms = await waitForMemberstackDom();
    const res = await ms?.getCurrentMember?.();
    return Boolean(memberIdFromMemberstackPayload(res));
  } catch {
    return false;
  }
}

type ListResponse = {
  ok?: boolean;
  ebooks?: MyEbookDownloadItem[];
  error?: string;
};

function isSafePublicDownloadUrl(value: string): boolean {
  return value.startsWith("/downloads/shop/") && !value.includes("..");
}

/**
 * Load approved legacy ebook entitlements for the current Memberstack session.
 * Ownership is resolved server-side from the verified token email only.
 */
export async function listMyEbookDownloads(): Promise<MyEbookDownloadItem[]> {
  const headers = await getMyEbookDownloadsAuthHeaders();
  if (!headers.Authorization) {
    throw new MyEbookDownloadsAuthError("Sign in required.");
  }

  const res = await fetch(API_PATH, {
    method: "GET",
    headers,
    credentials: "same-origin",
  });

  let body: ListResponse | null = null;
  try {
    body = (await res.json()) as ListResponse;
  } catch {
    body = null;
  }

  if (res.status === 401) {
    throw new MyEbookDownloadsAuthError(body?.error || "Sign in required.");
  }
  if (!res.ok || !body?.ok) {
    throw new MyEbookDownloadsApiError(
      body?.error || "Failed to load ebook downloads.",
      res.status,
    );
  }

  if (!Array.isArray(body.ebooks)) return [];

  return body.ebooks
    .filter(
      (row) =>
        row &&
        typeof row === "object" &&
        typeof row.itemId === "string" &&
        row.itemId.trim() &&
        typeof row.title === "string" &&
        row.title.trim() &&
        typeof row.downloadUrl === "string" &&
        isSafePublicDownloadUrl(row.downloadUrl.trim()),
    )
    .map((row) => ({
      itemId: row.itemId.trim(),
      title: row.title.trim(),
      downloadUrl: row.downloadUrl.trim(),
    }));
}
