import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson Whats New API routes", () => {
  const listCreate = fs.readFileSync(
    path.resolve("src/pages/api/watson/whats-new/index.ts"),
    "utf8",
  );
  const byId = fs.readFileSync(
    path.resolve("src/pages/api/watson/whats-new/[id].ts"),
    "utf8",
  );
  const settings = fs.readFileSync(
    path.resolve("src/pages/api/watson/whats-new/settings.ts"),
    "utf8",
  );
  const publicApi = fs.readFileSync(
    path.resolve("src/pages/api/whats-new/index.ts"),
    "utf8",
  );

  it("gates Watson card and settings routes with session auth", () => {
    expect(listCreate).toContain("requireWatsonSessionJson");
    expect(byId).toContain("requireWatsonSessionJson");
    expect(settings).toContain("requireWatsonSessionJson");
    expect(listCreate).toContain("createWhatsNewCard");
    expect(byId).toContain("updateWhatsNewCard");
    expect(settings).toContain("upsertWhatsNewBillboardSettings");
  });

  it("exposes an authorized DELETE route with id validation and 404 handling", () => {
    expect(byId).toContain("export const DELETE");
    expect(byId).toContain("deleteWhatsNewCard");
    // DELETE handler is behind the same Watson session gate.
    const deleteIdx = byId.indexOf("export const DELETE");
    expect(byId.indexOf("requireWatsonSessionJson", deleteIdx)).toBeGreaterThan(deleteIdx);
    expect(byId).toContain("Card id is required.");
    expect(byId).toContain('"Delete card not found."');
    expect(byId).toMatch(/Delete card not found\.["\s]*\n?\s*\?\s*404/);
    expect(byId).toContain("WHATS_NEW_DELETE_ACTIVE_PUBLISHED_ERROR");
    expect(byId).toContain("409");
  });

  it("keeps the public API read-only and filtered helpers", () => {
    expect(publicApi).toContain("listPublicWhatsNewCards");
    expect(publicApi).toContain("getPublicBillboardSettings");
    expect(publicApi).not.toContain("createWhatsNewCard");
    expect(publicApi).not.toContain("updateWhatsNewCard");
    expect(publicApi).not.toContain("requireWatsonSessionJson");
  });
});
