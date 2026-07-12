import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson notes API routes", () => {
  it("defines admin-gated member notes endpoints", () => {
    const memberNotesApi = fs.readFileSync(
      path.resolve("src/pages/api/watson/members/[memberid]/notes.ts"),
      "utf8",
    );
    const noteItemApi = fs.readFileSync(
      path.resolve("src/pages/api/watson/notes/[id].ts"),
      "utf8",
    );

    expect(memberNotesApi).toContain("requireWatsonAdminJson");
    expect(memberNotesApi).toContain("export const GET");
    expect(memberNotesApi).toContain("export const POST");
    expect(memberNotesApi).toContain("createWatsonNote");
    expect(memberNotesApi).toContain('export const prerender = false');

    expect(noteItemApi).toContain("requireWatsonAdminJson");
    expect(noteItemApi).toContain("export const PATCH");
    expect(noteItemApi).toContain("export const DELETE");
    expect(noteItemApi).toContain("updateWatsonNote");
    expect(noteItemApi).toContain("deleteWatsonNote");
  });

  it("keeps Watson notes under admin API routes only", () => {
    const memberNotesApiPath = path.resolve("src/pages/api/watson/members/[memberid]/notes.ts");
    const noteItemApiPath = path.resolve("src/pages/api/watson/notes/[id].ts");
    expect(memberNotesApiPath).toContain(`${path.sep}api${path.sep}watson${path.sep}`);
    expect(noteItemApiPath).toContain(`${path.sep}api${path.sep}watson${path.sep}`);

    const memberNotesApi = fs.readFileSync(memberNotesApiPath, "utf8");
    expect(memberNotesApi).toContain("requireWatsonAdminJson");
    expect(memberNotesApi).not.toContain("/membership");
    expect(memberNotesApi).not.toContain("/account");
  });
});
