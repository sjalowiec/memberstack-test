import { getWatsonPool, queryWatson } from "../watson/db";
import {
  canonicalizeGlossaryEntry,
  type GlossaryEntry,
} from "./glossaryEntries";

type GlossaryQuery = (sql: string, params?: unknown[]) => Promise<unknown[]>;

export const GLOSSARY_LIST_SQL = `
  SELECT glossary_id, document, updated_at
  FROM glossary_entries
  ORDER BY glossary_id ASC
`;

export const GLOSSARY_DELETE_SQL = `DELETE FROM glossary_entries`;

export const GLOSSARY_INSERT_SQL = `
  INSERT INTO glossary_entries (glossary_id, document, updated_at)
  VALUES ($1, $2::jsonb, NOW())
`;

type GlossaryRow = {
  glossary_id: number | string;
  document: unknown;
};

export function entryFromGlossaryRow(row: GlossaryRow): GlossaryEntry | null {
  const document = typeof row.document === "string" ? JSON.parse(row.document) : row.document;
  const entry = canonicalizeGlossaryEntry(document);
  if (!entry) return null;
  const glossaryId = Number(row.glossary_id);
  if (!Number.isInteger(glossaryId)) return null;
  entry.glossaryId = glossaryId;
  return entry;
}

export async function listSavedGlossaryEntries(
  query: GlossaryQuery = queryWatson as GlossaryQuery,
): Promise<GlossaryEntry[]> {
  const rows = (await query(GLOSSARY_LIST_SQL)) as GlossaryRow[];
  const entries: GlossaryEntry[] = [];
  for (const row of rows) {
    const entry = entryFromGlossaryRow(row);
    if (entry) entries.push(entry);
  }
  return entries;
}

export async function replaceSavedGlossaryEntries(
  entries: GlossaryEntry[],
  transaction?: (run: (query: GlossaryQuery) => Promise<void>) => Promise<void>,
): Promise<void> {
  const run = transaction ?? withGlossaryTransaction;
  await run(async (query) => {
    await query(GLOSSARY_DELETE_SQL);
    for (const entry of entries) {
      await query(GLOSSARY_INSERT_SQL, [entry.glossaryId, JSON.stringify(entry)]);
    }
  });
}

async function withGlossaryTransaction(
  run: (query: GlossaryQuery) => Promise<void>,
): Promise<void> {
  const pool = await getWatsonPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await run(async (sql, params = []) => {
      const result = await client.query(sql, params);
      return result.rows;
    });
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* The original error is the one to report. */
    }
    throw error;
  } finally {
    client.release();
  }
}
