import type { ActiveCampaignConfig } from "../activecampaign/client";
import { isValidTimeZone } from "./dates";
import { MarketingCalendarError } from "./errors";
import { requestJson, type Sleep } from "./http";
import { normalizeCampaign, type CampaignSnapshot } from "./campaignPlan";

const PAGE_LIMIT = 100;

function headers(config: ActiveCampaignConfig): Record<string, string> {
  return {
    "Api-Token": config.apiKey,
    Accept: "application/json",
  };
}

export async function loadAccountTimeZone(
  config: ActiveCampaignConfig,
  deps: { fetchImpl?: typeof fetch; sleep?: Sleep },
): Promise<{ timeZone: string | null; warning: string | null }> {
  try {
    const payload = await requestJson({
      url: `${config.baseUrl}/api/3/users/me`,
      headers: headers(config),
      fetchImpl: deps.fetchImpl,
      sleep: deps.sleep,
      label: "ActiveCampaign",
    });
    const timeZone = readTimeZone(payload);
    if (timeZone && isValidTimeZone(timeZone)) return { timeZone, warning: null };
    return {
      timeZone: null,
      warning: "ActiveCampaign did not return an account time zone. Dates without an offset will be skipped.",
    };
  } catch (error) {
    if (error instanceof MarketingCalendarError && error.status === 403) {
      return {
        timeZone: null,
        warning: "ActiveCampaign did not allow the account time zone to be read. Dates without an offset will be skipped.",
      };
    }
    if (error instanceof MarketingCalendarError && error.status === 402) {
      const detail = await expiredAccountDetail(config, deps);
      throw new MarketingCalendarError(
        detail
          ? `ActiveCampaign returned HTTP 402: ${detail}`
          : "ActiveCampaign returned HTTP 402.",
        { code: "activecampaign-auth", status: 402 },
      );
    }
    throw error;
  }
}

async function expiredAccountDetail(
  config: ActiveCampaignConfig,
  deps: { fetchImpl?: typeof fetch; sleep?: Sleep },
): Promise<string> {
  try {
    await requestJson({
      url: config.baseUrl,
      headers: { Accept: "application/json" },
      fetchImpl: deps.fetchImpl,
      sleep: deps.sleep,
      label: "ActiveCampaign",
    });
  } catch (error) {
    if (!(error instanceof MarketingCalendarError)) return "";
    const match = error.message.match(/"detail"\s*:\s*"([^"]+)"/);
    return match?.[1]?.slice(0, 180) ?? "";
  }
  return "";
}

function readTimeZone(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const user =
    record.user && typeof record.user === "object"
      ? (record.user as Record<string, unknown>)
      : record;
  for (const key of ["timezone", "tzone", "timeZone", "time_zone"]) {
    const value = user[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function listCampaigns(
  config: ActiveCampaignConfig,
  deps: { fetchImpl?: typeof fetch; sleep?: Sleep },
): Promise<CampaignSnapshot[]> {
  const campaigns: CampaignSnapshot[] = [];
  const seenPageIds = new Set<string>();
  let offset = 0;

  for (let page = 0; page < 200; page += 1) {
    const payload = await requestJson({
      url: `${config.baseUrl}/api/3/campaigns?limit=${PAGE_LIMIT}&offset=${offset}`,
      headers: headers(config),
      fetchImpl: deps.fetchImpl,
      sleep: deps.sleep,
      label: "ActiveCampaign",
    });
    const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const batch = Array.isArray(record.campaigns) ? record.campaigns : null;
    if (!batch) {
      throw new MarketingCalendarError("ActiveCampaign campaign list was incomplete.", {
        code: "incomplete",
      });
    }
    const total = readTotal(record.meta);
    if (batch.length === 0) {
      if (page === 0 || (total != null && offset >= total)) return campaigns;
      throw new MarketingCalendarError("ActiveCampaign campaign list was incomplete.", {
        code: "incomplete",
      });
    }
    const firstId = normalizeCampaign(batch[0])?.id ?? "";
    if (firstId) {
      if (seenPageIds.has(firstId) && offset > 0) {
        throw new MarketingCalendarError("ActiveCampaign campaign list repeated a page.", {
          code: "incomplete",
        });
      }
      seenPageIds.add(firstId);
    }
    for (const item of batch) {
      const campaign = normalizeCampaign(item);
      if (campaign) campaigns.push(campaign);
    }
    offset += batch.length;
    if (total != null && offset >= total) return campaigns;
    if (batch.length < PAGE_LIMIT) {
      if (total != null && offset < total) {
        throw new MarketingCalendarError("ActiveCampaign campaign list was incomplete.", {
          code: "incomplete",
        });
      }
      return campaigns;
    }
  }

  throw new MarketingCalendarError("ActiveCampaign campaign list was incomplete.", {
    code: "incomplete",
  });
}

function readTotal(meta: unknown): number | null {
  if (!meta || typeof meta !== "object") return null;
  const total = (meta as { total?: unknown }).total;
  const parsed = typeof total === "number" ? total : typeof total === "string" ? Number(total) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export async function loadMessageSubjects(
  config: ActiveCampaignConfig,
  messageIds: string[],
  deps: { fetchImpl?: typeof fetch; sleep?: Sleep },
): Promise<{ subjects: Map<string, string | null>; warnings: string[] }> {
  const subjects = new Map<string, string | null>();
  const warnings: string[] = [];
  for (const messageId of [...new Set(messageIds)]) {
    if (!messageId) continue;
    try {
      const payload = await requestJson({
        url: `${config.baseUrl}/api/3/messages/${encodeURIComponent(messageId)}`,
        headers: headers(config),
        fetchImpl: deps.fetchImpl,
        sleep: deps.sleep,
        label: "ActiveCampaign",
      });
      subjects.set(messageId, readSubject(payload));
    } catch (error) {
      if (error instanceof MarketingCalendarError && error.status === 404) {
        subjects.set(messageId, null);
        warnings.push(`ActiveCampaign message ${messageId} was not found. The campaign name will be used.`);
        continue;
      }
      throw error;
    }
  }
  return { subjects, warnings };
}

function readSubject(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const message = (payload as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  const subject = (message as { subject?: unknown }).subject;
  return typeof subject === "string" && subject.trim() ? subject.trim() : null;
}
