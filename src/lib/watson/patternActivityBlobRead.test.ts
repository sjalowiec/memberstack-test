import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readPatternActivityEvents } from "./patternActivityBlobRead";

describe("pattern activity server read", () => {
  it("does not read production from kin-dev without a server token", async () => {
    const result = await readPatternActivityEvents({
      environment: "production",
      env: { SITE_NAME: "kin-dev" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(503);
  });

  it("keeps the Watson route on the session cookie and off the browser bearer", () => {
    const source = fs.readFileSync(
      path.resolve("src/pages/api/watson/pattern-activity.ts"),
      "utf8",
    );
    expect(source).toContain("requireWatsonSessionJson");
    expect(source).not.toContain("Authorization");
    expect(source).not.toContain("knititnow.com");
    expect(source).not.toMatch(/\bPOST\b/);
  });

  it("lists blobs and does not write them", () => {
    const source = fs.readFileSync(
      path.resolve("src/lib/watson/patternActivityBlobRead.ts"),
      "utf8",
    );
    expect(source).toContain("listActivityEvents");
    expect(source).not.toMatch(/store\.set\s*\(/);
    expect(source).not.toMatch(/\.setJSON\s*\(/);
    expect(source).not.toMatch(/store\.delete\s*\(/);
  });
});
