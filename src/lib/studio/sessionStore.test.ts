import { describe, expect, it } from "vitest";

import type { WatsonQueryFn } from "../watson/memberSearch";
import { createStudioSession, updateStudioSession } from "./sessionStore";
import { studioSessionDiscussionId } from "./sessions";

const ID = "11111111-1111-4111-8111-111111111111";

type Row = {
  id: string;
  slug: string;
  title: string;
  introduction: string;
  video: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function memoryQuery(rows: Row[]): WatsonQueryFn {
  return async (sql, params = []) => {
    if (sql.includes("INSERT")) {
      const row: Row = {
        id: String(params[0]),
        slug: String(params[1]),
        title: String(params[2]),
        introduction: String(params[3]),
        video: String(params[4]),
        status: String(params[5]),
        created_at: "2026-10-16T00:00:00.000Z",
        updated_at: "2026-10-16T00:00:00.000Z",
      };
      if (rows.some((item) => item.slug === row.slug)) {
        throw new Error("duplicate key value violates unique constraint");
      }
      rows.push(row);
      return [row];
    }
    if (sql.includes("UPDATE")) {
      const row = rows.find((item) => item.id === params[0]);
      if (!row) return [];
      if (rows.some((item) => item.slug === params[1] && item.id !== row.id)) {
        throw new Error("duplicate key value violates unique constraint");
      }
      row.slug = String(params[1]);
      row.title = String(params[2]);
      row.introduction = String(params[3]);
      row.video = String(params[4]);
      row.status = String(params[5]);
      return [row];
    }
    if (sql.includes("id <>")) {
      return rows
        .filter((item) => item.slug === params[0] && (params[1] == null || item.id !== params[1]))
        .map((item) => ({ id: item.id }));
    }
    if (sql.includes("WHERE id = $1")) return rows.filter((item) => item.id === params[0]);
    if (sql.includes("WHERE slug = $1")) return rows.filter((item) => item.slug === params[0]);
    if (sql.includes("FROM watson_studio_sessions")) return rows;
    throw new Error(`Unexpected SQL: ${sql}`);
  };
}

describe("studio session store", () => {
  it("assigns one permanent id and does not replace it when the session changes", async () => {
    const rows: Row[] = [];
    const query = memoryQuery(rows);
    const created = await createStudioSession(
      {
        title: "Shoulder shaping",
        introduction: "Start here.",
        video: "1235389908",
        status: "published",
      },
      query,
      () => ID,
    );
    expect(created.ok && created.value.id).toBe(ID);

    const updated = await updateStudioSession(
      ID,
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "Neckline",
        introduction: "A new introduction.",
        video: "https://vimeo.com/999999999",
        slug: "neckline",
        status: "published",
      },
      query,
    );
    expect(updated.ok && updated.value.id).toBe(ID);
    expect(updated.ok && updated.value.slug).toBe("neckline");
    expect(updated.ok && updated.value.title).toBe("Neckline");
    expect(updated.ok && studioSessionDiscussionId(updated.value)).toBe(`studio-post:${ID}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(ID);
  });
});
