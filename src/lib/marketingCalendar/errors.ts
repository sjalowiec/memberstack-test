/** Remove credential material from messages that may be logged or returned. */
export function scrubSensitive(text: string): string {
  return text
    .replace(
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
      "[redacted-private-key]",
    )
    .replace(/"private_key"\s*:\s*"[^"]*"/g, '"private_key":"[redacted]"')
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/ya29\.[A-Za-z0-9._-]+/g, "[redacted-access-token]")
    .replace(/Api-Token["']?\s*[:=]\s*["']?\S+/gi, "Api-Token [redacted]");
}

export class MarketingCalendarError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number | null;

  constructor(
    message: string,
    options: { code?: string; retryable?: boolean; status?: number | null } = {},
  ) {
    super(scrubSensitive(message));
    this.name = "MarketingCalendarError";
    this.code = options.code ?? "marketing-calendar";
    this.retryable = options.retryable ?? false;
    this.status = options.status ?? null;
  }
}
