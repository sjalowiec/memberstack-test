import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("Lesson admin auth uses the same Memberstack TEST/LIVE handling as Help Hub", () => {
  it("protects create, update, delete, and preview with requireAdminForRequest", () => {
    const indexSource = readFileSync(join(here, "lessons.ts"), "utf8");
    const itemSource = readFileSync(join(here, "lessons", "[id].ts"), "utf8");
    const previewSource = readFileSync(
      join(here, "..", "..", "lessons", "preview.astro"),
      "utf8",
    );
    const helpHubIndex = readFileSync(join(here, "help-hub", "index.ts"), "utf8");
    expect(indexSource).toContain("requireAdminForRequest");
    expect(itemSource).toContain("requireAdminForRequest");
    expect(previewSource).toContain("requireAdminForRequest");
    expect(indexSource).toContain('from "../../../lib/admin/requireAdminRequest"');
    expect(helpHubIndex).toContain("requireAdminForRequest");
  });

  it("uses the bundled admin client that reads a fresh JWT on every request", () => {
    const editorClient = readFileSync(
      join(here, "..", "..", "..", "lib", "lessons", "adminEditorClient.ts"),
      "utf8",
    );
    const authClient = readFileSync(
      join(here, "..", "..", "..", "lib", "admin", "adminAuthClient.ts"),
      "utf8",
    );
    expect(editorClient).toContain("fetchAdminJson");
    expect(editorClient).toContain("getAdminAuthHeaders");
    expect(authClient).toContain("readMemberstackBearerToken");
    expect(authClient).toContain("Tokens are never cached across");
  });
});
