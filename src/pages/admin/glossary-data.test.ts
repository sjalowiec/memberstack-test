import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/glossary/loadGlossaryEntries", () => ({
  loadGlossaryEntries: vi.fn(),
  saveGlossaryEntries: vi.fn(),
}));

import { loadGlossaryEntries, saveGlossaryEntries } from "../../lib/glossary/loadGlossaryEntries";
import { GET, POST } from "./glossary-data";
import { POST as legacyPost } from "../api/admin/glossary";

const loadMock = vi.mocked(loadGlossaryEntries);
const saveMock = vi.mocked(saveGlossaryEntries);

function post(body: unknown) {
  return new Request("https://kin-dev.netlify.app/admin/glossary-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin glossary data", () => {
  it("returns the merged catalog", async () => {
    loadMock.mockResolvedValueOnce([{ glossaryId: 172, english: "Alternate" }]);
    const response = await GET({} as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ glossaryId: 172, english: "Alternate" }]);
  });

  it("returns the storage error and does not claim success when saving fails", async () => {
    saveMock.mockRejectedValueOnce(new Error("connection refused"));
    const response = await POST({ request: post([{ glossaryId: 172 }]) } as never);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Your changes are still in the editor.");
  });

  it("does not write the source file from the old endpoint", async () => {
    saveMock.mockClear();
    const response = await legacyPost({} as never);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("Nothing was saved");
    expect(saveMock).not.toHaveBeenCalled();
  });
});
