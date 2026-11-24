import { describe, expect, it } from "vitest";
import { customerHelpVideos } from "../../data/customerHelpVideos";
import {
  addCustomerHelpVideo,
  catalogWithVideo,
  customerHelpAdminRows,
  customerHelpPath,
  findListedCustomerHelpVideo,
  listCustomerHelpVideos,
  parseCustomerHelpCatalog,
  type CustomerHelpVideoCatalog,
} from "./customerHelpVideoCatalog";
import {
  createCustomerHelpVideo,
  findPublishedCustomerHelpVideo,
  memoryCustomerHelpBlob,
} from "./customerHelpVideoStore";

const now = "2026-11-24T12:00:00.000Z";

function catalog(videos: CustomerHelpVideoCatalog["videos"] = []): CustomerHelpVideoCatalog {
  return { videos };
}

describe("customer help video catalog", () => {
  it("keeps the shipped DesignaKnit page when the saved catalog is empty or hostile", () => {
    expect(listCustomerHelpVideos(catalog())).toEqual([...customerHelpVideos]);
    expect(parseCustomerHelpCatalog(null)).toEqual({ videos: [] });
    expect(parseCustomerHelpCatalog({ videos: "nope" })).toBeNull();
    expect(
      findListedCustomerHelpVideo("save-designaknit-file", catalog()),
    ).toMatchObject({ slug: "save-designaknit-file", vimeoId: "1249450856" });
    expect(findListedCustomerHelpVideo("1249450856", catalog())).toBeUndefined();
  });

  it("makes a page address from the title and keeps an Unlisted privacy code", () => {
    const added = addCustomerHelpVideo(catalog(), {
      title: "How to load a DesignaKnit file",
      vimeoUrl: "https://vimeo.com/1249798150/Ab12cd34",
      now,
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.created).toBe(true);
    expect(added.video).toMatchObject({
      slug: "how-to-load-a-designaknit-file",
      title: "How to load a DesignaKnit file",
      vimeoId: "1249798150",
      privacyHash: "Ab12cd34",
    });
    expect(customerHelpPath(added.video.slug)).toBe("/video-help/how-to-load-a-designaknit-file/");

    const fromPlayer = addCustomerHelpVideo(catalog(), {
      title: "Player link",
      vimeoUrl: "https://player.vimeo.com/video/1249798150?h=Ab12cd34",
      now,
    });
    expect(fromPlayer.ok && fromPlayer.video.privacyHash).toBe("Ab12cd34");
  });

  it("rejects a link that is not a Vimeo video and a title with no page address", () => {
    expect(addCustomerHelpVideo(catalog(), { title: "Help", vimeoUrl: "https://example.com/1", now }).ok).toBe(
      false,
    );
    expect(addCustomerHelpVideo(catalog(), { title: "???", vimeoUrl: "https://vimeo.com/1249798150", now }).ok).toBe(
      false,
    );
  });

  it("does not let a save replace the shipped DesignaKnit page", () => {
    const added = addCustomerHelpVideo(catalog(), {
      title: "Different title",
      vimeoUrl: "https://vimeo.com/1249450856/shouldnotapply",
      now,
    });
    expect(added.ok && added.created).toBe(false);
    expect(added.ok && added.changed).toBe(false);
    expect(added.ok && added.video.slug).toBe("save-designaknit-file");
    expect(added.ok && added.video.title).toBe("How to save a file in DesignaKnit");
    const next = catalogWithVideo(catalog(), added.ok ? added.video : ({} as never));
    expect(listCustomerHelpVideos(next).map((video) => video.slug)).toEqual(["save-designaknit-file"]);
  });

  it("stores an optional customer message and can clear it on a later save", () => {
    const added = addCustomerHelpVideo(catalog(), {
      title: "Needle selection error",
      vimeoUrl: "https://vimeo.com/1249798150/ea9f53ac2e",
      message: "  Watch the first step before you change the needle.  ",
      now,
    });
    expect(added.ok && added.video.message).toBe("Watch the first step before you change the needle.");
    if (!added.ok) return;
    const stored = catalogWithVideo(catalog(), added.video);
    expect(findListedCustomerHelpVideo(added.video.slug, stored)?.message).toBe(added.video.message);

    const blank = addCustomerHelpVideo(catalog(), {
      title: "No extra note",
      vimeoUrl: "https://vimeo.com/1249798151",
      message: "   ",
      now,
    });
    expect(blank.ok && blank.video.message).toBeUndefined();

    const cleared = addCustomerHelpVideo(stored, {
      title: "Needle selection error",
      vimeoUrl: "https://vimeo.com/1249798150/ea9f53ac2e",
      message: "",
      now: "2026-11-24T13:00:00.000Z",
    });
    expect(cleared.ok && cleared.changed).toBe(true);
    expect(cleared.ok && cleared.video.message).toBeUndefined();
    expect(cleared.ok && cleared.video.slug).toBe("needle-selection-error");

    const tooLong = addCustomerHelpVideo(catalog(), {
      title: "Too long",
      vimeoUrl: "https://vimeo.com/1249798152",
      message: "a".repeat(1001),
      now,
    });
    expect(tooLong.ok).toBe(false);
  });

  it("keeps the same customer link when the same video is saved again", () => {
    const first = addCustomerHelpVideo(catalog(), {
      title: "Cast on review",
      vimeoUrl: "https://vimeo.com/1249798150/Ab12cd34",
      now,
    });
    if (!first.ok) throw new Error("expected save");
    const stored = catalogWithVideo(catalog(), first.video);
    const again = addCustomerHelpVideo(stored, {
      title: "Cast on review, revised",
      vimeoUrl: "https://vimeo.com/1249798150",
      now: "2026-11-24T13:00:00.000Z",
    });
    expect(again.ok && again.created).toBe(false);
    expect(again.ok && again.changed).toBe(true);
    expect(again.ok && again.video.slug).toBe("cast-on-review");
    expect(again.ok && again.video.privacyHash).toBe("Ab12cd34");
    expect(again.ok && again.video.title).toBe("Cast on review, revised");
  });

  it("hides the privacy code from the admin list while marking an Unlisted video", () => {
    const added = addCustomerHelpVideo(catalog(), {
      title: "Cast on review",
      vimeoUrl: "https://vimeo.com/1249798150/Ab12cd34",
      now,
    });
    if (!added.ok) throw new Error("expected save");
    const rows = customerHelpAdminRows(catalogWithVideo(catalog(), added.video));
    expect(rows[0]).toMatchObject({ slug: "save-designaknit-file", builtIn: true, unlisted: false });
    expect(rows[1]).toMatchObject({
      slug: "cast-on-review",
      path: "/video-help/cast-on-review/",
      builtIn: false,
      unlisted: true,
    });
    expect(JSON.stringify(rows)).not.toContain("Ab12cd34");
  });
});

describe("customer help video store", () => {
  it("serves a saved video without a deploy and still serves the shipped page when storage fails", async () => {
    const blob = memoryCustomerHelpBlob(new Map());
    const saved = await createCustomerHelpVideo(blob, {
      title: "How to load a DesignaKnit file",
      vimeoUrl: "https://vimeo.com/1249798150/Ab12cd34",
      now,
    });
    expect(saved.ok && saved.path).toBe("/video-help/how-to-load-a-designaknit-file/");
    await expect(findPublishedCustomerHelpVideo("how-to-load-a-designaknit-file", blob)).resolves.toMatchObject({
      vimeoId: "1249798150",
      privacyHash: "Ab12cd34",
    });
    await expect(findPublishedCustomerHelpVideo("save-designaknit-file", blob)).resolves.toMatchObject({
      slug: "save-designaknit-file",
      vimeoId: "1249450856",
    });

    const broken: Parameters<typeof findPublishedCustomerHelpVideo>[1] = {
      async get() {
        throw new Error("blob down");
      },
      async setJSON() {
        throw new Error("blob down");
      },
    };
    await expect(findPublishedCustomerHelpVideo("save-designaknit-file", broken)).resolves.toMatchObject({
      slug: "save-designaknit-file",
    });
    await expect(findPublishedCustomerHelpVideo("how-to-load-a-designaknit-file", broken)).resolves.toBeUndefined();
    const refused = await createCustomerHelpVideo(broken, {
      title: "Another video",
      vimeoUrl: "https://vimeo.com/1249798151",
      now,
    });
    expect(refused.ok).toBe(false);
  });
});
