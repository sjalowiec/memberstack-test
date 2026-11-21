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
      ["short row", "short-row", "shortrow"],
      ["short rows", "short-rows", "shortrows"],
      ["cast on", "cast-on", "caston"],
    ]);
  });

  it("treats short-row and cast-on hyphen and space as the same phrase", () => {
    const shortRow = "Use a short-row shoulder, or a short row on the other side.";
    const shortRows = "Practice short rows before the short-rows lesson.";
    const castOn = "The e-wrap cast-on is one cast on method.";
    for (const query of ["short-row", "short row"]) {
      expect(rankSearchText(shortRow, query)).toBe(2);
      expect(rankSearchText("Bind off the neck.", query)).toBe(0);
    }
    for (const query of ["short-rows", "short rows"]) {
      expect(rankSearchText(shortRows, query)).toBe(2);
    }
    for (const query of ["cast-on", "cast on"]) {
      expect(rankSearchText(castOn, query)).toBe(2);
      expect(rankSearchText("Bind off only.", query)).toBe(0);
    }
    expect(rankSearchText("fair isle punchcard", "fair-isle")).toBe(0);
    expect(buildSearchQueryPlan("short-row").exact).toEqual(["short-row", "short row"]);
    expect(buildSearchQueryPlan("short-row").synonym).toContain("shortrow");
    expect(buildSearchQueryPlan("cast on").exact).toEqual(["cast on"]);
    expect(buildSearchQueryPlan("cast on").synonym).toEqual(["caston"]);
    expect(buildSearchQueryPlan("tension")).toEqual({ exact: ["tension"], synonym: [] });
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

  it("treats LK150, LK-150, and LK 150 as the same model", () => {
    const pages = [
      "LK150 Quick Start",
      "LK-150 Fun",
      "The LK 150 sponge bar",
      "En dash LK\u2013150",
      "Spaced hyphen LK - 150",
    ];
    const queries = ["LK150", "LK-150", "LK 150", "lk-150"];
    for (const query of queries) {
      expect(pages.map((page) => rankSearchText(page, query))).toEqual([2, 2, 2, 2, 2]);
    }
    expect(rankSearchText("The SK150 is a different machine.", "LK150")).toBe(0);
    expect(rankSearchText("The SK-150 is a different machine.", "LK 150")).toBe(0);
    expect(rankSearchText("SK150 patterning", "SK-150")).toBe(2);
    expect(rankSearchText("KH930 and KH-940", "KH 930")).toBe(2);
    expect(rankSearchText("KH930 and KH-940", "KH940")).toBe(2);
    expect(rankSearchText("The LK manual shows 150 needles.", "LK150")).toBe(0);
    expect(rankSearchText("The LK manual shows 150 needles.", "LK 150")).toBe(0);
    expect(rankSearchText("LK1500", "LK150")).toBe(0);
    expect(rankSearchText("The LK150 sponge bar", "LK1500")).toBe(0);
    expect(rankSearchText("Brother KH950i", "KH950")).toBe(0);
    expect(rankSearchText("Brother KH950", "KH950i")).toBe(0);
    expect(rankSearchText("Brother KH 950i", "KH-950i")).toBe(2);
    expect(rankSearchText("Passap E 6000", "E-6000")).toBe(2);
    expect(rankSearchText("The E6000 Reference Book", "E 6000")).toBe(2);
    expect(rankSearchText("Studio F370", "F 370")).toBe(2);
    expect(rankSearchText("S 9 needles", "S9")).toBe(0);
    expect(rankSearchText("Cast off on the LK150.", "cast off on the LK-150")).toBe(2);
    expect(rankSearchText("Cast off on the LK1500.", "cast off on the LK-150")).toBe(0);
    expect(rankSearchText("Bind off on the LK 150.", "cast off on the LK-150")).toBe(1);
    expect(buildSearchQueryPlan("LK-150").exact).toEqual(["LK150"]);
    expect(buildSearchQueryPlan("LK 150").exact).toEqual(["LK150"]);
    expect(buildSearchQueryPlan("lk 150").exact).toEqual(["lk150"]);
    expect(buildSearchQueryPlan("LK150 quick start").exact).toEqual(["LK150 quick start"]);
    const withSynonym = buildSearchQueryPlan("cast off on the LK 150");
    expect(withSynonym.exact[0]).toBe("cast off on the LK150");
    expect(withSynonym.synonym).toContain("bind off on the LK150");
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
