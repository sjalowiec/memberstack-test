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
    expect(editSource).toContain("loadHelpHubTipsForAdmin");
    expect(editSource).toContain('id="helpHubOpenEntry"');
    expect(editSource).toContain("Published");
    expect(editSource).toContain("Drafts");
    expect(editSource).toContain("helpHubSplitEntryChooserEnabled");
    expect(editSource).toContain('data-help-hub-chooser="split"');
    expect(editSource).toContain("Draft Help Hubs");
    expect(editSource).toContain("Published Help Hubs");
    expect(editSource).toContain("Create new Help Hub");
    expect(editSource).toContain("help-hub-edit__chooser-grid");
    expect(formClientSource).toContain("syncOpenHelpHubChooser");
    expect(formClientSource).toContain("You have unsaved changes. Leave this page without saving?");
    expect(editSource).toContain("help-hub-edit__form");
    expect(editSource).toContain("help-hub-edit__workspace");
    expect(editSource).toContain('id="helpHubLivePreview"');
    expect(editSource).toContain('id="publishHelpHubBtn"');
    expect(editSource).toContain("Publishing settings");
    expect(editSource).toContain("bootHelpHubAdminEditor");
    expect(editSource).not.toContain("requireAdminForRequest");
    expect(editSource).not.toContain("Sign in with your Knit it Now account to continue.");
    expect(listSource).not.toContain("Sign in with your Knit it Now account to continue.");
    expect(editSource).not.toContain('id="helpHubAdminSignIn"');
  });

  it("shows a Related Lessons list that can hold more than one lesson", () => {
    expect(editSource).toContain("Related Lessons");
    expect(editSource).toContain(
      "Search for a lesson, then select it to add it. You can add more than one.",
    );
    expect(formClientSource).toContain("addMemberResource");
    expect(formClientSource).toContain("moveMemberResource");
    expect(formClientSource).toContain("removeMemberResourceAt");
    expect(formClientSource).toContain("selectedLessonNumberLabel");
    expect(formClientSource).toContain('search.value = ""');
  });

  it("uses a lesson search box instead of dumping the catalog, and labels Try This steps", () => {
    expect(editSource).toContain("member-resources-search");
    expect(editSource).toContain("member-resources-options");
    expect(editSource).toContain("hidden");
    expect(formClientSource).toContain("memberResourcePickerResults");
    expect(formClientSource).toContain("memberResourceOptionLabel");
    expect(editSource).toContain("helpHubCategoryChoices");
    expect(editSource).toContain("Steps");
    expect(editSource).toContain("Add step");
    expect(editSource).toContain("Each step is one item in the Try This list.");
  });

  it("adds optional public video fields after Explanation in the free answer", () => {
    const explanation = editSource.indexOf('name="solutionText"');
    const videoUrl = editSource.indexOf('name="publicVideoUrl"');
    const videoTitle = editSource.indexOf('name="publicVideoTitle"');
    const tryThis = editSource.indexOf('name="tryThis"');
    const members = editSource.indexOf('id="complete-lesson-heading"');
    expect(explanation).toBeGreaterThan(-1);
    expect(videoUrl).toBeGreaterThan(explanation);
    expect(videoTitle).toBeGreaterThan(videoUrl);
    expect(tryThis).toBeGreaterThan(videoTitle);
    expect(members).toBeGreaterThan(videoTitle);
    expect(editSource).toContain("Public video URL or Vimeo ID");
    expect(editSource).toContain("Public video title");
    expect(formClientSource).toContain('fieldValue(form, "publicVideoUrl")');
    expect(formClientSource).toContain('fieldValue(form, "publicVideoTitle")');
    expect(editSource).toContain("You do not need to create another lesson or enter a Vimeo ID.");
  });

  it("offers optional top image and related-tool fields without video embed controls", () => {
    expect(editSource).toContain("Image address");
    expect(editSource).toContain("Alt text");
    expect(editSource).toContain("Main image and caption");
    expect(editSource).toContain('name="mediaUrl"');
    expect(editSource).toContain('name="mediaAlt"');
    expect(editSource).toContain('name="mediaCaption"');
    expect(editSource).toContain("Choose image");
    expect(editSource).toContain("data-image-choose");
    expect(editSource).toContain("data-image-file");
    expect(formClientSource).toContain('"/api/admin/help-hub/images"');
    expect(formClientSource).toContain("Image address filled in.");
    expect(editSource).toContain("Button label");
    expect(editSource).toContain("Call to action");
    expect(editSource).toContain('name="relatedToolEyebrow"');
    expect(editSource).toContain('name="relatedToolTitle"');
    expect(editSource).toContain('name="relatedToolNote"');
    expect(editSource).toContain('name="relatedToolLabel"');
    expect(editSource).toContain('name="relatedToolUrl"');
    expect(editSource).not.toContain("name=\"mediaType\"");
    expect(editSource).not.toContain("YouTube");
    expect(formClientSource).toContain("relatedToolEyebrow");
    expect(formClientSource).toContain("relatedToolTitle");
    expect(formClientSource).toContain("relatedToolNote");
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
    expect(listSource).toContain("you can restore");
    const categoryClient = readFileSync(
      join(here, "..", "..", "lib", "helpHub", "categoryAdminClient.ts"),
      "utf8",
    );
    expect(categoryClient).toContain("data-cat-restore");
    expect(categoryClient).toContain("helpHubCategoryAdminErrorMessage");
    expect(categoryClient).not.toContain("This cannot be undone.");
  });

  it("keeps Help Hub admin pages behind the server admin gate used by the dashboard", () => {
    const netlifyToml = readFileSync(join(here, "..", "..", "..", "netlify.toml"), "utf8");
    const middleware = readFileSync(join(here, "..", "..", "middleware.ts"), "utf8");
    const adminIndex = readFileSync(join(here, "index.astro"), "utf8");
    const lessonsAdmin = readFileSync(join(here, "lessons.astro"), "utf8");
    expect(netlifyToml).not.toContain("Basic-Auth");
    expect(netlifyToml).not.toMatch(/for = "\/admin\/\*"/);
    expect(middleware).toContain("isAdminProtectedPath");
    expect(middleware).toContain("requireAdminForRequest");
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
