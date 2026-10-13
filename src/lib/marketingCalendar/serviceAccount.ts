import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

import { KIN_MARKETING_CALENDAR_ID } from "./constants";
import { MarketingCalendarError } from "./errors";
import { requestJson, type Sleep } from "./http";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_SCOPE = [
  "https://www.googleapis.com/auth/calendar.calendarlist",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export interface ServiceAccount {
  clientEmail: string;
  privateKey: string;
}

export function resolveCalendarId(env: NodeJS.ProcessEnv): string {
  const configured = (env.GOOGLE_CALENDAR_ID || "").trim();
  if (!configured) return KIN_MARKETING_CALENDAR_ID;
  if (configured !== KIN_MARKETING_CALENDAR_ID) {
    throw new MarketingCalendarError(
      "GOOGLE_CALENDAR_ID does not match the KIN marketing calendar. Refusing to use a different calendar.",
      { code: "calendar-id" },
    );
  }
  return configured;
}

export function parseServiceAccount(raw: string | null | undefined): ServiceAccount {
  const text = decodeServiceAccount(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new MarketingCalendarError(
      "GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON is not valid JSON.",
      { code: "service-account" },
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new MarketingCalendarError("Service account JSON is missing required fields.", {
      code: "service-account",
    });
  }
  const record = parsed as Record<string, unknown>;
  const clientEmail = typeof record.client_email === "string" ? record.client_email.trim() : "";
  const privateKey = typeof record.private_key === "string" ? record.private_key : "";
  if (record.type !== "service_account" || !clientEmail || !privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new MarketingCalendarError(
      "Service account JSON must be a Google service account key with client_email and private_key.",
      { code: "service-account" },
    );
  }
  return { clientEmail, privateKey };
}

function decodeServiceAccount(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    throw new MarketingCalendarError("Missing GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON.", {
      code: "config",
    });
  }
  if (trimmed.startsWith("{")) return trimmed;
  const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
  if (decoded.startsWith("{")) return decoded;
  throw new MarketingCalendarError(
    "GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON is not valid JSON.",
    { code: "service-account" },
  );
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

export function signServiceAccountJwt(account: ServiceAccount, issuedAtSeconds: number): string {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: account.clientEmail,
      scope: CALENDAR_SCOPE,
      aud: TOKEN_URL,
      iat: issuedAtSeconds,
      exp: issuedAtSeconds + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  try {
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    const signature = signer.sign(account.privateKey).toString("base64url");
    return `${unsigned}.${signature}`;
  } catch {
    throw new MarketingCalendarError(
      `Service account ${account.clientEmail} could not sign a Google access token.`,
      { code: "service-account" },
    );
  }
}

export async function mintAccessToken(
  account: ServiceAccount,
  deps: { fetchImpl?: typeof fetch; sleep?: Sleep; now?: Date } = {},
): Promise<string> {
  const assertion = signServiceAccountJwt(
    account,
    Math.floor((deps.now ?? new Date()).getTime() / 1000),
  );
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const payload = await requestJson({
    url: TOKEN_URL,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    fetchImpl: deps.fetchImpl,
    sleep: deps.sleep,
    label: "Google token",
  });
  const token =
    payload && typeof payload === "object"
      ? (payload as { access_token?: unknown }).access_token
      : null;
  if (typeof token !== "string" || !token) {
    throw new MarketingCalendarError("Google token response did not include an access token.", {
      code: "google-auth",
    });
  }
  return token;
}

export function readServiceAccountJsonFile(filePath: string): string {
  let text = "";
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    throw new MarketingCalendarError("The service account JSON file could not be read.", {
      code: "service-account",
    });
  }
  parseServiceAccount(text);
  return text;
}
