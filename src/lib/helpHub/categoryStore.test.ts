import { describe, expect, it } from "vitest";
import { helpHubJsonSeedCategories } from "./categories";
import { HELP_HUB_RETIRED_LOOK_RIGHT_KEY } from "./categoryTypes";
import {
  HELP_HUB_CATEGORY_INSERT_SQL,
  HELP_HUB_CATEGORY_LIST_ALL_SQL,
  HELP_HUB_CATEGORY_LIST_SQL,
  HELP_HUB_CATEGORY_SYNC_ID_SEQUENCE_SQL,
  ensureHelpHubCategoriesSeeded,
  type HelpHubCategoryRow,
} from "./categoryStore";
import type { WatsonQueryFn } from "../watson/memberSearch";

function rowFromManaged(
  category: {
    id: number;
    key: string;
    label: string;
    sortOrder: number;
    retiredAt: string | null;
  },
  deletedAt: Date | string | null = null,
): HelpHubCategoryRow {
  return {
    id: category.id,
    key: category.key,
    label: category.label,
    sort_order: category.sortOrder,
    retired_at: category.retiredAt,
    created_at: "2026-09-16T00:00:00.000Z",
    updated_at: "2026-09-16T00:00:00.000Z",
    updated_by: "seed",
    deleted_at: deletedAt,
  };
}

describe("Help Hub category seed occupancy", () => {
  it("does not insert a retired or soft-deleted seeded key again", async () => {
    const seed = helpHubJsonSeedCategories();
    const lookRight = seed.find((row) => row.key === HELP_HUB_RETIRED_LOOK_RIGHT_KEY)!;
    const occupancy = seed.map((row) =>
      rowFromManaged(row, row.key === HELP_HUB_RETIRED_LOOK_RIGHT_KEY ? "2026-09-16T14:32:36.428Z" : null),
    );
    const inserts: unknown[][] = [];
    const queryFn: WatsonQueryFn = async (sql, params = []) => {
      if (sql === HELP_HUB_CATEGORY_LIST_ALL_SQL) return occupancy;
      if (sql === HELP_HUB_CATEGORY_LIST_SQL) {
        return occupancy.filter((row) => row.deleted_at == null);
      }
      if (sql === HELP_HUB_CATEGORY_INSERT_SQL) {
        inserts.push(params);
        return [rowFromManaged(lookRight)];
      }
      if (sql === HELP_HUB_CATEGORY_SYNC_ID_SEQUENCE_SQL) return [{ last_value: 9 }];
      throw new Error(`unexpected sql: ${sql}`);
    };

    const visible = await ensureHelpHubCategoriesSeeded({ email: "test" }, queryFn);
    expect(inserts).toEqual([]);
    expect(visible.some((row) => row.key === HELP_HUB_RETIRED_LOOK_RIGHT_KEY)).toBe(false);
    expect(visible.map((row) => row.id).sort((a, b) => a - b)).toEqual(
      seed.filter((row) => row.key !== HELP_HUB_RETIRED_LOOK_RIGHT_KEY).map((row) => row.id).sort((a, b) => a - b),
    );
  });

  it("advances the id sequence after a fresh seed", async () => {
    const seed = helpHubJsonSeedCategories();
    const inserted: number[] = [];
    let sequenced = false;
    const stored: HelpHubCategoryRow[] = [];
    const queryFn: WatsonQueryFn = async (sql, params = []) => {
      if (sql === HELP_HUB_CATEGORY_LIST_ALL_SQL) return stored;
      if (sql === HELP_HUB_CATEGORY_LIST_SQL) return stored.filter((row) => row.deleted_at == null);
      if (sql === HELP_HUB_CATEGORY_INSERT_SQL) {
        inserted.push(Number(params[0]));
        const row = rowFromManaged({
          id: Number(params[0]),
          key: String(params[1]),
          label: String(params[2]),
          sortOrder: Number(params[3]),
          retiredAt: (params[4] as string | null) ?? null,
        });
        stored.push(row);
        return [row];
      }
      if (sql === HELP_HUB_CATEGORY_SYNC_ID_SEQUENCE_SQL) {
        sequenced = true;
        return [{ last_value: 9 }];
      }
      throw new Error(`unexpected sql: ${sql}`);
    };

    const visible = await ensureHelpHubCategoriesSeeded({ email: "test" }, queryFn);
    expect(inserted).toEqual(seed.map((row) => row.id));
    expect(sequenced).toBe(true);
    expect(visible.map((row) => row.id).sort((a, b) => a - b)).toEqual(
      seed.map((row) => row.id).sort((a, b) => a - b),
    );
  });
});
