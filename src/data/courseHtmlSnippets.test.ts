import { describe, expect, it } from "vitest";
import { COURSE_HTML_SNIPPETS } from "./courseHtmlSnippets";

describe("COURSE_HTML_SNIPPETS", () => {
  it("has unique ids and required fields", () => {
    const ids = new Set<string>();
    for (const snippet of COURSE_HTML_SNIPPETS) {
      expect(snippet.id.trim()).not.toBe("");
      expect(snippet.name.trim()).not.toBe("");
      expect(snippet.html.trim()).not.toBe("");
      expect(ids.has(snippet.id)).toBe(false);
      ids.add(snippet.id);
    }
  });
});
