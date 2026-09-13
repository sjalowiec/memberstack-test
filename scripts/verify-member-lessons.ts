import pg from "pg";
import {
  formatDatabaseTarget,
  getWatsonAdminDatabaseUrl,
  loadEnvFile,
} from "../src/lib/watson/env";

loadEnvFile();

const databaseUrl = getWatsonAdminDatabaseUrl();
const pool = new pg.Pool({ connectionString: databaseUrl });

try {
  const count = await pool.query(
    "SELECT COUNT(*)::int AS n FROM member_lessons WHERE deleted_at IS NULL",
  );
  const ids = await pool.query(
    "SELECT id, slug, status FROM member_lessons WHERE deleted_at IS NULL ORDER BY id",
  );
  const rls = await pool.query(
    "SELECT relrowsecurity FROM pg_class WHERE relname = 'member_lessons'",
  );
  const policies = await pool.query(
    "SELECT polname FROM pg_policy WHERE polrelid = 'public.member_lessons'::regclass",
  );
  const max = await pool.query(
    "SELECT COALESCE(MAX(id), 5000) AS max_id FROM member_lessons",
  );
  console.log(JSON.stringify({
    target: formatDatabaseTarget(databaseUrl),
    count: count.rows[0]?.n,
    rows: ids.rows,
    rls: rls.rows,
    policies: policies.rows,
    nextId: Math.max(Number(max.rows[0]?.max_id ?? 5000), 5000) + 1,
  }, null, 2));
} finally {
  await pool.end();
}
