import type { Pool, QueryResultRow } from "pg";

import {
  getWatsonDatabaseUrl,
  loadEnvFile,
  WATSON_DB_CONNECTION_TIMEOUT_MS,
} from "./env";

let pool: Pool | null = null;

async function loadPool(): Promise<Pool> {
  const pg = await import("pg");
  loadEnvFile();
  return new pg.Pool({
    connectionString: getWatsonDatabaseUrl(),
    connectionTimeoutMillis: WATSON_DB_CONNECTION_TIMEOUT_MS,
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
