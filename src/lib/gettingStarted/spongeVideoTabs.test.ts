import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getAllMachines } from "../machines/referenceCatalog";
import { buildMachineIdentityCatalog, modelOptions } from "./machineIdentity";
import {
  LK150_MODEL_SLUG,
  PAUSE_VIMEO_PLAYER_ORIGIN,
  applySpongeTabChange,
  pauseVimeoPlayerMessage,
  spongeTabFromKey,
  spongeVideoTabForModel,
} from "./spongeVideoTabs";

describe("Getting Started sponge video tabs", () => {
  const catalog = buildMachineIdentityCatalog(getAllMachines());
  const silverReed = modelOptions(catalog, "Silver Reed");
  const lk150 = silverReed.find((option) => option.label === "LK150");
  const otherSilver = silverReed.find(
    (option) => option.id !== "unlisted" && option.label !== "LK150",
  );

  it("selects LK150 only when that model is identified", () => {
    expect(lk150).toEqual({ id: LK150_MODEL_SLUG, label: "LK150" });
    expect(otherSilver).toBeTruthy();
    expect(spongeVideoTabForModel(lk150!.id, lk150!.label)).toBe("lk150");
    expect(spongeVideoTabForModel(LK150_MODEL_SLUG, "")).toBe("lk150");
    expect(spongeVideoTabForModel(otherSilver!.id, otherSilver!.label)).toBe("metal");
    expect(spongeVideoTabForModel("", "")).toBe("metal");
    expect(spongeVideoTabForModel("", "LK150")).toBe("metal");
    expect(spongeVideoTabForModel("", "Silver Reed")).toBe("metal");
    expect(spongeVideoTabForModel("Silver Reed", "Silver Reed")).toBe("metal");
    expect(spongeVideoTabForModel("unlisted", "My model isn’t listed / I’m not sure")).toBe(
      "metal",
    );
    expect(spongeVideoTabForModel("unsure", "I’m not sure")).toBe("metal");
  });

  it("moves between the two tabs from the keyboard and wraps", () => {
    expect(spongeTabFromKey("metal", "ArrowRight")).toBe("lk150");
    expect(spongeTabFromKey("lk150", "ArrowRight")).toBe("metal");
    expect(spongeTabFromKey("lk150", "ArrowLeft")).toBe("metal");
    expect(spongeTabFromKey("metal", "ArrowLeft")).toBe("lk150");
    expect(spongeTabFromKey("lk150", "ArrowUp")).toBe("metal");
    expect(spongeTabFromKey("metal", "ArrowDown")).toBe("lk150");
    expect(spongeTabFromKey("lk150", "Home")).toBe("metal");
    expect(spongeTabFromKey("metal", "End")).toBe("lk150");
    expect(spongeTabFromKey("metal", "Tab")).toBeNull();
    expect(spongeTabFromKey("metal", "Enter")).toBeNull();
  });

  it("pauses the video being left and leaves the current video playing", () => {
    expect(applySpongeTabChange("metal", "lk150")).toEqual({
      tab: "lk150",
      pauseTab: "metal",
    });
    expect(applySpongeTabChange("lk150", "metal")).toEqual({
      tab: "metal",
      pauseTab: "lk150",
    });
    expect(applySpongeTabChange("metal", "metal")).toEqual({
      tab: "metal",
      pauseTab: null,
    });
    expect(pauseVimeoPlayerMessage()).toBe('{"method":"pause"}');
    expect(PAUSE_VIMEO_PLAYER_ORIGIN).toBe("https://player.vimeo.com");
  });

  it("keeps one tabbed player, both public embeds, and the sponge check copy", () => {
    const source = readFileSync(
      new URL("../../pages/getting-started-guide.astro", import.meta.url),
      "utf8",
    );
    const template = source.slice(
      source.indexOf('<template id="gsg-guide-template">'),
      source.indexOf("</template>"),
    );
    const sponge = template.slice(
      template.indexOf('aria-labelledby="gsg-sponge"'),
      template.indexOf('aria-labelledby="gsg-yarn"'),
    );

    expect(sponge).toContain('role="tablist"');
    expect(sponge).toContain('aria-orientation="horizontal"');
    expect(sponge).toContain(">Metal-bed machines</button>");
    expect(sponge).toContain(">LK150</button>");
    expect(sponge).toContain('id="gsg-sponge-tab-metal"');
    expect(sponge).toContain('aria-controls="gsg-sponge-panel-metal"');
    expect(sponge).toContain('id="gsg-sponge-tab-lk150"');
    expect(sponge).toContain('aria-controls="gsg-sponge-panel-lk150"');
    expect(sponge).toContain('id="gsg-sponge-panel-metal"');
    expect(sponge).toContain('aria-labelledby="gsg-sponge-tab-metal"');
    expect(sponge).toContain('id="gsg-sponge-panel-lk150"');
    expect(sponge).toContain('aria-labelledby="gsg-sponge-tab-lk150"');
    expect(sponge).toContain('data-gsg-sponge-tab="metal"');
    expect(sponge).toContain('aria-selected="true"');
    expect(sponge).toContain('data-gsg-sponge-panel="lk150"');
    expect(sponge).toContain("hidden");
    expect(sponge.match(/<GatedVimeoEmbed/g)).toHaveLength(2);
    expect(sponge).toContain("lk150SpongeVideo");
    expect(sponge).toContain("metalSpongeVideo");
    expect(sponge).not.toContain("enableVimeoPlayerApi");
    expect(sponge).toContain("The sponge holds the needles so your stitches can form.");
    expect(sponge).toContain(
      "On a metal-bed machine, also check that the needles lie firmly in their slots.",
    );
    expect(sponge).toContain(
      "The LK150 uses a different arrangement, and a worn sponge is harder to see on that machine.",
    );
    expect(sponge).toContain(
      '<figcaption>This photo shows a worn sponge bar on a metal-bed machine.</figcaption>',
    );
    expect(sponge).toContain('src="/images/reference/sponge-bar.png"');
    expect(sponge).toContain('width="1829"');
    expect(sponge).toContain('height="968"');
    expect(sponge).toContain('href="/reference/repairs"');
    expect(sponge).not.toContain("Metal bed machines");
    expect(template).not.toContain("reference card");
    const access = readFileSync(
      new URL("../../scripts/gettingStartedGuideAccess.ts", import.meta.url),
      "utf8",
    );
    expect(access).toContain("initGettingStartedSpongeVideoTabs(mount)");
  });
});
