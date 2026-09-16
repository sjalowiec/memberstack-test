import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const editSource = readFileSync(join(here, "help-hub-edit.astro"), "utf8");
const listSource = readFileSync(join(here, "help-hub.astro"), "utf8");
const editorClientSource = readFileSync(
  join(here, "..", "..", "lib", "helpHub", "adminEditorClient.ts"),
  "utf8",
);
const formClientSource = readFileSync(
  join(here, "..", "..", "lib", "helpHub", "adminEditorFormClient.ts"),
  "utf8",
);
const formHelperSource = readFileSync(
  join(here, "..", "..", "lib", "helpHub", "adminForm.ts"),
  "utf8",
);
const baseLayoutSource = readFileSync(join(here, "..", "..", "layouts", "BaseLayout.astro"), "utf8");

describe("Help Hub admin CMS", () => {
  it("loads and saves through the admin API with a Memberstack bearer token", () => {
    expect(editSource).toContain("loadHelpHubTipBySlug");
    expect(editSource).toContain("bootHelpHubAdminEditor");
    expect(formClientSource).toContain("admin.request");
    expect(formClientSource).toContain("admin.saveSucceeded");
    expect(formClientSource).toContain("admin.openPreview");
    expect(formClientSource).toContain("admin.promptSignIn");
    expect(editSource).toContain('id="helpHubAdminSignIn"');
    expect(editSource).not.toContain("src/data/help-hub.json");
    expect(editSource).not.toContain("Copy Cursor Save Prompt");
  });

  it("exposes Preview through the authenticated admin client, not a public query string", () => {
    expect(editSource).toContain('id="previewHelpHub"');
    expect(formClientSource).toContain("admin.openPreview");
    expect(formClientSource).toContain("payloadFromForm()");
    expect(listSource).toContain("data-help-hub-preview-slug");
    expect(listSource).toContain("bindHelpHubPreviewButtons");
    expect(listSource).not.toContain("/help-hub/preview?slug=");
    expect(listSource).toContain("loadHelpHubTipsForAdmin");
    expect(formClientSource).toContain('window.open("", "_blank")');
    expect(editorClientSource).toContain("document.write");
    expect(editorClientSource).toContain("htmlWithHelpHubPreviewBase");
    expect(editorClientSource).not.toContain("createObjectURL");
    expect(editorClientSource).not.toMatch(/new Blob\b/);
    expect(baseLayoutSource).toContain("<base href={documentBaseHref}");
  });

  it("lets Sue search Learning Library and member lessons without typing a Vimeo ID", () => {
    expect(editSource).toContain("Find an existing lesson");
    expect(editSource).toContain("member-resources-search");
    expect(editSource).toContain("libraryVideosForPicker");
    expect(editSource).not.toContain("Enter lesson IDs separated by commas");
    expect(editSource).not.toContain("Media Type");
    expect(editSource).not.toContain("JSON Preview");
    expect(editSource).not.toContain("Bridge not used");
    expect(editSource).not.toContain("name=\"mediaType\"");
    expect(editSource).not.toContain("name=\"bridge\"");
    expect(formHelperSource).toContain("helpHubAdminEditorCanInit");
  });

  it("protects the admin HTML so unauthorized visitors do not receive draft JSON", () => {
    expect(editSource).toContain("requireAdminForRequest");
    expect(listSource).toContain("requireAdminForRequest");
    expect(editSource).toContain("helpHubAdminClientPayload");
    expect(editSource).toContain("authorized &&");
    expect(editSource).toContain('id="help-hub-current-entry"');
  });
});
