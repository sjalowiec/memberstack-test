import fs from "fs";
import path from "path";

/** Load key/value pairs from a .env file without overwriting existing process.env values. */
export function loadEnvFile(envPath = ".env"): void {
  const resolved = path.resolve(envPath);
  if (!fs.existsSync(resolved)) {
    return;
  }

  const content = fs.readFileSync(resolved, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function getWatsonDatabaseUrl(): string {
  const url = process.env.WATSON_DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "WATSON_DATABASE_URL is not set. Copy .env.example to .env and configure Postgres.",
    );
  }
  return url;
}

/** Host and database name only ù safe to print in CLI logs. */
export function formatDatabaseTarget(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    const host = parsed.hostname || "(unknown host)";
    const port = parsed.port ? `:${parsed.port}` : "";
    const database = parsed.pathname.replace(/^\//, "") || "(unknown database)";
    const user = parsed.username ? `${decodeURIComponent(parsed.username)}@` : "";
    return `${user}${host}${port}/${database}`;
  } catch {
    return "(invalid WATSON_DATABASE_URL)";
  }
}

export const WATSON_DB_CONNECTION_TIMEOUT_MS = 15_000;

/** Session statement timeout in ms; 0 disables Supabase's default 120s limit for DDL/index builds. */
export const WATSON_DB_STATEMENT_TIMEOUT_MS = 0;
