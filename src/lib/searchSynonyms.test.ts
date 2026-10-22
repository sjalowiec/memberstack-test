import { describe, expect, it } from "vitest";
import glossary from "../data/glossary.json";
import {
  buildSearchQueryPlan,
  mergeRankedSearchHits,
  rankSearchText,
  SEARCH_SYNONYM_GROUPS,
} from "./searchSynonyms";

const bindOffArticle = "Latch tool bind off keeps the last row from unraveling.";
const castOffArticle = "Cast off the shoulder stitches.";
const unrelated = "How to measure gauge on an LK150.";

describe("search synonym groups", () => {
  it("keeps the bind-off and cast-off forms in one extendable group", () => {
    expect(SEARCH_SYNONYM_GROUPS).toEqual([
      [
        "bind off",
        "binding off",
        "bind-off",
        "bindoff",
        "cast off",
        "casting off",
        "cast-off",
        "castoff",
      ],
    ]);
  });

  it("finds the other forms for cast off, casting off, and bind-off", () => {
    expect(rankSearchText(bindOffArticle, "cast off")).toBe(1);
    expect(rankSearchText(bindOffArticle, "casting off")).toBe(1);
    expect(rankSearchText(bindOffArticle, "bind-off")).toBe(2);
    expect(rankSearchText(castOffArticle, "bindoff")).toBe(1);
    expect(rankSearchText(castOffArticle, "castoff")).toBe(1);
    expect(rankSearchText("binding off the hem", "cast off")).toBe(1);
  });

  it("keeps the other words in the query", () => {
    expect(rankSearchText(bindOffArticle, "latch tool cast off")).toBe(1);
    expect(rankSearchText(bindOffArticle, "latch tool bind-off")).toBe(2);
    expect(rankSearchText("Bind off the neckline.", "latch tool cast off")).toBe(0);
    expect(rankSearchText("Use a latch tool, then bind off.", "latch tool cast off")).toBe(1);
  });

  it("prefers the visitor's own phrase over a synonym", () => {
    expect(rankSearchText("Cast off, also called bind off.", "cast off")).toBe(2);
    expect(rankSearchText("Bind off only.", "cast off")).toBe(1);
  });

  it("leaves an unrelated search on ordinary matching", () => {
    expect(rankSearchText(unrelated, "gauge")).toBe(2);
    expect(rankSearchText(unrelated, "cast off")).toBe(0);
    expect(rankSearchText("fair isle punchcard", "fair  isle")).toBe(0);
    expect(rankSearchText(bindOffArticle, "cast")).toBe(0);
    expect(rankSearchText("Cast on with a latch tool.", "cast")).toBe(2);
  });

  it("builds pagefind queries that keep the extra words", () => {
    const plan = buildSearchQueryPlan("latch tool cast off");
    expect(plan.exact).toEqual(["latch tool cast off"]);
    expect(plan.synonym).toContain("latch tool bind off");
    expect(plan.synonym).toContain("latch tool binding off");
    expect(plan.synonym).toContain("latch tool bindoff");
    expect(plan.synonym).not.toContain("bind off");
    expect(buildSearchQueryPlan("bind-off").exact).toEqual(["bind-off", "bind off"]);
    expect(buildSearchQueryPlan("tension")).toEqual({ exact: ["tension"], synonym: [] });
  });

  it("merges exact and synonym hits once, exact first", () => {
    const merged = mergeRankedSearchHits([
      {
        tier: 2,
        hits: [{ key: "cast", item: "exact cast", score: 0.2 }],
      },
      {
        tier: 1,
        hits: [
          { key: "cast", item: "synonym cast", score: 0.9 },
          { key: "bind", item: "bind only", score: 0.8 },
          { key: "other", item: "weaker", score: 0.1 },
        ],
      },
    ]);
    expect(merged).toEqual(["exact cast", "bind only", "weaker"]);
  });

  it("matches the live glossary titles for representative queries", () => {
    const titles = (glossary as Array<{ english?: string; active?: boolean }>)
      .filter((entry) => entry.active === true)
      .map((entry) => String(entry.english ?? ""));
    const matched = (query: string) => titles.filter((title) => rankSearchText(title, query) > 0);

    expect(matched("cast off")).toEqual(
      expect.arrayContaining(["Cast off / Bind Off", "Bind off / Cast Off", "Latch Tool Bind Off"]),
    );
    expect(matched("casting off")).toEqual(
      expect.arrayContaining(["Cast off / Bind Off", "Bind off / Cast Off", "Latch Tool Bind Off"]),
    );
    expect(matched("bind-off")).toEqual(
      expect.arrayContaining(["Cast off / Bind Off", "Bind off / Cast Off", "Latch Tool Bind Off"]),
    );
    expect(matched("latch tool cast off")).toEqual(["Latch Tool Bind Off"]);
    expect(matched("swatch")).not.toContain("Cast Off");
    expect(matched("swatch")).toContain("Get Acquainted (Tension) Swatch");
  });
});
