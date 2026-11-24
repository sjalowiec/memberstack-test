import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { customerHelpVideos, findCustomerHelpVideo } from "./customerHelpVideos";

describe("customer help videos", () => {
  it("serves the DesignaKnit save video from the configuration only", () => {
    const video = findCustomerHelpVideo("save-designaknit-file");
    expect(video).toMatchObject({
      slug: "save-designaknit-file",
      title: "How to save a file in DesignaKnit",
      intro: "Click the play button below to watch. You can pause and replay any step.",
      vimeoId: "1249450856",
    });
    expect(video?.privacyHash).toBeUndefined();
  });

  it("does not treat a Vimeo id, query string, or unknown slug as a video", () => {
    expect(findCustomerHelpVideo("1249450856")).toBeUndefined();
    expect(findCustomerHelpVideo("save-designaknit-file?vimeo=999")).toBeUndefined();
    expect(findCustomerHelpVideo("not-a-help-video")).toBeUndefined();
    expect(findCustomerHelpVideo("../videos/1")).toBeUndefined();
    expect(customerHelpVideos.some((entry) => entry.slug === "1249450856")).toBe(false);
  });

  it("keeps the help pages out of the header, search catalog, and member player", () => {
    const root = process.cwd();
    const header = readFileSync(join(root, "src/components/Header.astro"), "utf8");
    const search = readFileSync(join(root, "src/lib/headerSearchCatalog.ts"), "utf8");
    const page = readFileSync(join(root, "src/pages/video-help/[slug].astro"), "utf8");
    expect(header).not.toContain("/video-help");
    expect(search).not.toContain("customerHelpVideos");
    expect(search).not.toContain("/video-help");
    expect(page).not.toContain("GatedVimeoEmbed");
    expect(page).not.toContain("searchParams");
    expect(page).toContain('autoplay={false}');
    expect(page).toContain("controls={true}");
    expect(page).toContain('name="robots" content="noindex, nofollow"');
    expect(page).toContain('import Layout from "../../layouts/Layout.astro"');
    expect(page).toContain("findPublishedCustomerHelpVideo");
    expect(page).toContain('Cache-Control", "no-store"');
    expect(page).not.toContain("requireAdmin");
    const admin = readFileSync(join(root, "src/pages/admin/support-videos.astro"), "utf8");
    expect(admin).toContain('name="title"');
    expect(admin).toContain('name="vimeoUrl"');
    expect(admin).toContain("Copy customer link");
    expect(admin).not.toContain("GatedVimeoEmbed");
  });
});
