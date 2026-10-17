import { describe, expect, it } from "vitest";
import { bootHelpHubAdminEditor } from "./adminEditorFormClient";
import { editorTargetForPreviewSection, htmlForHelpHubEditorFrame } from "./adminLivePreview";
import { helpHubPreviewAudienceFromBody, helpHubPreviewAudienceState } from "./previewAudience";

describe("Help Hub editor live preview", () => {
  it("maps a public section click to the matching editor field", () => {
    expect(editorTargetForPreviewSection("question")).toEqual({
      group: "question",
      fieldId: "help-hub-question",
    });
    expect(editorTargetForPreviewSection("image-support")).toEqual({
      group: "support",
      fieldId: "help-hub-try-image",
    });
    expect(editorTargetForPreviewSection("cta")?.fieldId).toBe("help-hub-related-tool-eyebrow");
    expect(editorTargetForPreviewSection("missing")).toBeNull();
  });

  it("resolves preview assets with a base href and adds highlight only in the editor frame", () => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><img src="/images/help-hub/try.jpg"></body></html>`;
    const framed = htmlForHelpHubEditorFrame(html, "https://kin-dev.knititnow.com");
    expect(framed).toContain('<base href="https://kin-dev.knititnow.com/">');
    expect(framed).toContain("help-hub-editor-preview-style");
    expect(framed).toContain('src="/images/help-hub/try.jpg"');
    expect(framed).not.toContain("blob:");
  });

  it("loads the editor form client", () => {
    expect(typeof bootHelpHubAdminEditor).toBe("function");
  });

  it("reads a preview audience without treating it as saved access", () => {
    expect(helpHubPreviewAudienceFromBody({ audience: "member" })).toBe("member");
    expect(helpHubPreviewAudienceFromBody({ audience: "visitor" })).toBe("visitor");
    expect(helpHubPreviewAudienceFromBody({ slug: "yarn" })).toBeUndefined();
    expect(
      helpHubPreviewAudienceState({
        querySelector: () => ({ getAttribute: () => "visitor" }),
      }),
    ).toBe("loggedOut");
    expect(
      helpHubPreviewAudienceState({
        querySelector: () => null,
      }),
    ).toBeNull();
  });
});
