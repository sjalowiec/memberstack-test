import { describe, expect, it } from "vitest";
import {
  VIDEO_POSTER_DELETE_SQL,
  VIDEO_POSTER_INSERT_SQL,
  listVideoPosterOverrides,
  posterMapFromRows,
  replaceVideoPosterOverrides,
} from "./videoPosterStore";

function memoryStore() {
  const rows: Array<{ content_id: string; poster_url: string }> = [];
  const query = async (sql: string, params: unknown[] = []) => {
    if (sql === VIDEO_POSTER_DELETE_SQL) {
      rows.splice(0, rows.length);
      return [];
    }
    if (sql === VIDEO_POSTER_INSERT_SQL) {
      rows.push({ content_id: String(params[0]), poster_url: String(params[1]) });
      return [];
    }
    if (sql.includes("FROM video_poster_overrides")) {
      return rows.map((row) => ({ ...row }));
    }
    throw new Error(`unexpected sql: ${sql}`);
  };
  return { rows, query };
}

describe("videoPosterStore", () => {
  it("replaces stored thumbnails and reads them back by content id", async () => {
    const store = memoryStore();
    await replaceVideoPosterOverrides(
      [{ contentId: "649", posterUrl: "https://i.vimeocdn.com/video/new-d_1280x720?r=pad" }],
      async (run) => {
        await run(store.query);
      },
    );
    await replaceVideoPosterOverrides([], async (run) => {
      await run(store.query);
    });
    const cleared = await listVideoPosterOverrides(store.query);
    expect(cleared.size).toBe(0);

    await replaceVideoPosterOverrides(
      [{ contentId: "649", posterUrl: "https://i.vimeocdn.com/video/new-d_1280x720?r=pad" }],
      async (run) => {
        await run(store.query);
      },
    );
    const loaded = await listVideoPosterOverrides(store.query);
    expect(loaded.get("649")).toBe("https://i.vimeocdn.com/video/new-d_1280x720?r=pad");
    expect(
      posterMapFromRows([{ content_id: "938", poster_url: "https://i.vimeocdn.com/video/938.jpg" }]).get("938"),
    ).toContain("938");
  });
});
