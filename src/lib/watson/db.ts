import type { Pool, PoolConfig, QueryResultRow } from "pg";

import {
  getWatsonApplicationName,
  getWatsonDatabaseUrl,
  loadEnvFile,
  WATSON_DB_CONNECTION_TIMEOUT_MS,
} from "./env";

/** One client per Netlify/serverless isolate; session-mode pool_size is 15. */
export const WATSON_RUNTIME_POOL_MAX = 1;
export const WATSON_RUNTIME_IDLE_TIMEOUT_MS = 1_000;

let pool: Pool | null = null;

/** Runtime (SSR/functions) pool options. CLI importers create their own session-mode pools. */
export function getWatsonRuntimePoolConfig(
  env: NodeJS.ProcessEnv = process.env,
): Pick<
  PoolConfig,
  | "max"
  | "min"
  | "idleTimeoutMillis"
  | "allowExitOnIdle"
  | "connectionTimeoutMillis"
  | "application_name"
> {
  return {
    max: WATSON_RUNTIME_POOL_MAX,
    min: 0,
    idleTimeoutMillis: WATSON_RUNTIME_IDLE_TIMEOUT_MS,
    allowExitOnIdle: true,
    connectionTimeoutMillis: WATSON_DB_CONNECTION_TIMEOUT_MS,
    application_name: getWatsonApplicationName(env),
  };
}

async function loadPool(): Promise<Pool> {
  const pg = await import("pg");
  loadEnvFile();
  return new pg.Pool({
    connectionString: getWatsonDatabaseUrl(),
    ...getWatsonRuntimePoolConfig(),
  });
}

export async function getWatsonPool(): Promise<Pool> {
  if (!pool) {
    pool = await loadPool();
  }
  return pool;
}

export async function queryWatson<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = await getWatsonPool();
  const result = await client.query<T>(sql, params);
  return result.rows;
}

export async function closeWatsonPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
