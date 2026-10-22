import { describe, expect, it } from "vitest";
import type { GlossaryEntry } from "./glossaryEntries";
import {
  entryFromGlossaryRow,
  GLOSSARY_DELETE_SQL,
  GLOSSARY_INSERT_SQL,
  listSavedGlossaryEntries,
  replaceSavedGlossaryEntries,
} from "./glossaryStore";

function memoryStore() {
  const rows: Array<{ glossary_id: number; document: GlossaryEntry }> = [];
  const query = async (sql: string, params: unknown[] = []) => {
    if (sql === GLOSSARY_DELETE_SQL) {
      rows.splice(0, rows.length);
      return [];
    }
    if (sql.includes("INSERT INTO glossary_entries")) {
      const glossaryId = Number(params[0]);
      const document = JSON.parse(String(params[1])) as GlossaryEntry;
      rows.push({ glossary_id: glossaryId, document });
      return [];
    }
    if (sql.includes("FROM glossary_entries")) {
      return rows.map((row) => ({ ...row }));
    }
    throw new Error(`unexpected sql: ${sql}`);
  };
  return { rows, query };
}

describe("glossaryStore", () => {
  it("replaces saved rows and reads the stored document", async () => {
    const store = memoryStore();
    const calls: string[] = [];
    const entry = {
      glossaryId: 172,
      english: "Alternate",
      example: "Edited",
      helpinfo: "",
      image: "",
      image_alt: "",
      image_description: "",
      metaTitle: "",
      metaDescription: "",
      active: true,
      vimeoIds: [],
    } satisfies GlossaryEntry;

    await replaceSavedGlossaryEntries([entry], async (run) => {
      calls.push("begin");
      await run(async (sql, params) => {
        calls.push(sql);
        return store.query(sql, params);
      });
      calls.push("commit");
    });

    const loaded = await listSavedGlossaryEntries(store.query);
    expect(calls[0]).toBe("begin");
    expect(calls).toContain(GLOSSARY_DELETE_SQL);
    expect(calls.some((sql) => sql === GLOSSARY_INSERT_SQL)).toBe(true);
    expect(loaded).toEqual([entry]);
    expect(entryFromGlossaryRow({ glossary_id: "900", document: { ...entry, glossaryId: 1 } })?.glossaryId).toBe(900);
  });
});
