import pg from "pg";
import type { QueryResultRow } from "pg";
import { loadEnvFile } from "../watson/env";
import { queryWatson } from "../watson/db";
import { isolatedLocalTestimonialDatabase } from "./testimonialDatabase";

loadEnvFile();

type TestimonialConnection =
  | { mode: "shared" }
  | { mode: "local"; url: string }
  | { mode: "refused"; reason: string };

let localPool: pg.Pool | null = null;
let localPoolUrl: string | null = null;

/**
 * Testimonials use an isolated local database when TESTIMONIALS_DATABASE_URL is
 * set. A remote override is refused. With no override, runtime reads stay on
 * the configured Watson database and imports still refuse to write there.
 */
export function resolveTestimonialConnection(
  env: NodeJS.ProcessEnv = process.env,
): TestimonialConnection {
  const override = env.TESTIMONIALS_DATABASE_URL?.trim() || "";
  if (!override) return { mode: "shared" };
  const safety = isolatedLocalTestimonialDatabase(override);
  if (!safety.ok) return { mode: "refused", reason: safety.reason };
  return { mode: "local", url: override };
}

async function localPoolFor(url: string): Promise<pg.Pool> {
  if (localPool && localPoolUrl === url) return localPool;
  if (localPool) await localPool.end();
  localPool = new pg.Pool({
    connectionString: url,
    max: 1,
    idleTimeoutMillis: 1_000,
    connectionTimeoutMillis: 15_000,
    application_name: "testimonials-local",
  });
  localPoolUrl = url;
  return localPool;
}

export async function queryTestimonials<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  loadEnvFile();
  const connection = resolveTestimonialConnection();
  if (connection.mode === "refused") throw new Error(connection.reason);
  if (connection.mode === "shared") return queryWatson<T>(sql, params);
  const pool = await localPoolFor(connection.url);
  const result = await pool.query<T>(sql, params);
  return result.rows;
}
