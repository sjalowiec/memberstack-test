import { MarketingCalendarError, scrubSensitive } from "./errors";

export type Sleep = (ms: number) => Promise<void>;

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

export async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response: Response | null, attempt: number): number {
  const header = response?.headers.get("retry-after");
  const seconds = header ? Number(header) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 5000);
  }
  return Math.min(500 * 2 ** (attempt - 1), 5000);
}

export async function requestJson(options: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
  label: string;
}): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const method = options.method ?? "GET";
  let lastError: MarketingCalendarError | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(options.url, {
        method,
        headers: options.headers,
        body: options.body,
        redirect: "manual",
      });
    } catch (error) {
      lastError = new MarketingCalendarError(
        `${options.label} request failed: ${error instanceof Error ? error.message : "network error"}`,
        { code: "network", retryable: true },
      );
      if (attempt === 3) break;
      await sleep(retryDelayMs(null, attempt));
      continue;
    }

    if (response.status >= 300 && response.status < 400) {
      throw new MarketingCalendarError(`${options.label} returned an unexpected redirect.`, {
        code: "redirect",
        status: response.status,
      });
    }

    if (RETRY_STATUSES.has(response.status)) {
      lastError = new MarketingCalendarError(`${options.label} returned HTTP ${response.status}.`, {
        code: "http",
        retryable: true,
        status: response.status,
      });
      if (attempt === 3) break;
      await sleep(retryDelayMs(response, attempt));
      continue;
    }

    const text = await response.text();
    if (!response.ok) {
      const detail = scrubSensitive(text).slice(0, 300);
      throw new MarketingCalendarError(
        detail
          ? `${options.label} returned HTTP ${response.status}: ${detail}`
          : `${options.label} returned HTTP ${response.status}.`,
        { code: "http", status: response.status },
      );
    }

    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new MarketingCalendarError(`${options.label} returned a response that was not JSON.`, {
        code: "invalid-json",
        status: response.status,
      });
    }
  }

  throw lastError ?? new MarketingCalendarError(`${options.label} request failed.`, { code: "network" });
}
