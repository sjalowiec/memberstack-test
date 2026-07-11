import { describe, expect, it } from "vitest";

import { formatDatabaseTarget } from "./env";

describe("formatDatabaseTarget", () => {
  it("shows host, port, database, and user without password", () => {
    const target = formatDatabaseTarget(
      "postgresql://watson_user:super_secret@db.example.com:5432/watson_legacy",
    );
    expect(target).toBe("watson_user@db.example.com:5432/watson_legacy");
    expect(target).not.toContain("super_secret");
  });

  it("returns a safe fallback for invalid URLs", () => {
    expect(formatDatabaseTarget("not-a-url")).toBe("(invalid WATSON_DATABASE_URL)");
  });
});
