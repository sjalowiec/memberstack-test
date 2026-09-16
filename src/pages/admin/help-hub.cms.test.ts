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
    expect(editSource).not.toContain('id="helpHubAdminSignIn"');
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

  it("loads both Help Hub admin pages with the site admin gate, not a Memberstack email login", () => {
    expect(listSource).toContain("loadHelpHubTipsForAdmin");
    expect(listSource).toContain("Create New Help Hub Entry");
    expect(listSource).not.toContain("requireAdminForRequest");
    expect(editSource).toContain("loadHelpHubTipBySlug");
    expect(editSource).toContain("help-hub-edit__form");
    expect(editSource).toContain("bootHelpHubAdminEditor");
    expect(editSource).not.toContain("requireAdminForRequest");
    expect(editSource).not.toContain("Sign in with your Knit it Now account to continue.");
    expect(listSource).not.toContain("Sign in with your Knit it Now account to continue.");
    expect(editSource).not.toContain('id="helpHubAdminSignIn"');
  });

  it("uses a lesson search box instead of dumping the catalog, and labels Try This steps", () => {
    expect(editSource).toContain("member-resources-search");
    expect(editSource).toContain("member-resources-options");
    expect(editSource).toContain("hidden");
    expect(formClientSource).toContain("memberResourcePickerResults");
    expect(formClientSource).toContain("memberResourceOptionLabel");
    expect(editSource).toContain("helpHubCategoryChoices");
    expect(editSource).toContain("TRY THIS STEPS");
    expect(editSource).toContain("One step per line.");
  });

  it("offers optional top image and related-tool fields without video embed controls", () => {
    expect(editSource).toContain("Top image URL");
    expect(editSource).toContain("Top image alt text");
    expect(editSource).toContain("Optional top image caption");
    expect(editSource).toContain('name="mediaUrl"');
    expect(editSource).toContain('name="mediaAlt"');
    expect(editSource).toContain('name="mediaCaption"');
    expect(editSource).toContain("Related tool button label");
    expect(editSource).toContain("Related tool internal URL");
    expect(editSource).toContain('name="relatedToolLabel"');
    expect(editSource).toContain('name="relatedToolUrl"');
    expect(editSource).not.toContain("name=\"mediaType\"");
    expect(editSource).not.toContain("YouTube");
    expect(formClientSource).toContain("relatedToolLabel");
    expect(formClientSource).toContain("relatedToolUrl");
  });

  it("includes Gauge & Swatching and LK150 in the admin category choices", () => {
    const categoriesSource = readFileSync(
      join(here, "..", "..", "data", "help-hub-categories.json"),
      "utf8",
    );
    const categories = JSON.parse(categoriesSource) as {
      id?: number;
      key: string;
      label: string;
      retired?: boolean;
    }[];
    const active = categories.filter((row) => row.retired !== true);
    const keys = active.map((row) => row.key);
    expect(keys).toContain("getting-started");
    expect(keys).toContain("machines");
    expect(keys.indexOf("gauge-swatching")).toBe(keys.indexOf("getting-started") + 1);
    expect(keys.indexOf("machines")).toBe(keys.indexOf("gauge-swatching") + 1);
    expect(keys.indexOf("lk150")).toBe(keys.indexOf("machines") + 1);
    expect(categories.find((row) => row.key === "gauge-swatching")?.label).toBe(
      "Gauge & Swatching",
    );
    expect(categories.find((row) => row.key === "lk150")).toEqual(
      expect.objectContaining({ id: 9, key: "lk150", label: "LK150" }),
    );
    expect(keys).not.toContain("knitting-doesnt-look-right");
    expect(categories.find((row) => row.key === "knitting-doesnt-look-right")?.retired).toBe(true);
    expect(editSource).toContain("loadManagedHelpHubCategories");
    expect(editSource).toContain("helpHubCategoryChoices");
    expect(listSource).toContain("Manage Categories");
    expect(listSource).toContain("bootHelpHubCategoryAdmin");
  });

  it("keeps Help Hub admin pages behind the same /admin Basic Auth used by the dashboard", () => {
    const netlifyToml = readFileSync(join(here, "..", "..", "..", "netlify.toml"), "utf8");
    const adminIndex = readFileSync(join(here, "index.astro"), "utf8");
    const lessonsAdmin = readFileSync(join(here, "lessons.astro"), "utf8");
    expect(netlifyToml).toMatch(/for = "\/admin\/\*"/);
    expect(netlifyToml).toContain("Basic-Auth");
    expect(adminIndex).not.toContain("requireAdminForRequest");
    expect(lessonsAdmin).not.toContain("requireAdminForRequest");
    expect(listSource).not.toContain("requireAdminForRequest");
    expect(editSource).not.toContain("requireAdminForRequest");
  });

  it("does not leak draft Help Hub data on public pages or unauthenticated APIs", () => {
    const slugSource = readFileSync(join(here, "..", "help-hub", "[slug].astro"), "utf8");
    const previewSource = readFileSync(join(here, "..", "help-hub", "preview.astro"), "utf8");
    const apiIndex = readFileSync(join(here, "..", "api", "admin", "help-hub", "index.ts"), "utf8");
    const apiItem = readFileSync(join(here, "..", "api", "admin", "help-hub", "[id].ts"), "utf8");
    expect(slugSource).toContain("publicOnly: true");
    expect(previewSource).toContain("requireAdminForRequest");
    expect(apiIndex).toContain("requireAdminForRequest");
    expect(apiItem).toContain("requireAdminForRequest");
    expect(formClientSource).toContain("admin.request");
    expect(formClientSource).toContain("admin.openPreview");
    expect(formClientSource).toContain("admin.promptSignIn");
    expect(formClientSource).not.toContain('getElementById("helpHubAdminSignIn")');
  });
});
