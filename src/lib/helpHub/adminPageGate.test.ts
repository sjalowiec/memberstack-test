import { describe, expect, it } from "vitest";
import {
  HELP_HUB_ADMIN_PAGE_AUTH,
  helpHubAdminClientPayload,
  helpHubAdminEditorPayload,
} from "./adminPageGate";

describe("helpHubAdminEditorPayload", () => {
  it("includes editor data for an existing site admin who already passed /admin Basic Auth", () => {
    const payload = helpHubAdminEditorPayload({
      entry: { question: "Visible to admin", slug: "cut-and-sew-shaping", status: "draft" },
      lessons: [{ id: 5002, title: "Tuck on the LK150" }],
      library: [{ id: 1027, title: "Every other Needle Knitting" }],
    });
    expect(HELP_HUB_ADMIN_PAGE_AUTH).toBe("site-admin-basic");
    expect(payload.entry?.question).toBe("Visible to admin");
    expect(payload.entry?.status).toBe("draft");
    expect(payload.picker.library).toHaveLength(1);
  });
});

describe("helpHubAdminClientPayload", () => {
  it("does not give unauthorized visitors draft entry or picker data", () => {
    const payload = helpHubAdminClientPayload({
      auth: { ok: false, status: 401, error: "Sign in required." },
      entry: {
        question: "Draft secret question",
        relatedLessons: [5002],
        mediaUrl: "1175910961",
      },
      lessons: [{ id: 5002, title: "Tuck on the LK150" }],
      library: [{ id: 1027, title: "Every other Needle Knitting" }],
      allLessons: [{ id: 5002, title: "Tuck on the LK150" }],
    });
    expect(payload.authorized).toBe(false);
    expect(payload.needsSignIn).toBe(true);
    expect(payload.entry).toBeNull();
    expect(payload.picker).toEqual({ lessons: [], library: [], allLessons: [] });
    expect(JSON.stringify(payload)).not.toContain("Draft secret question");
  });
});
