import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { trapRepairsMaintenanceFocus } from "./repairsMaintenanceModal";

const repairsSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../pages/reference/repairs.astro"),
  "utf8",
);

describe("repairs maintenance modal markup", () => {
  it("places the button under the page title and above the introductory paragraph", () => {
    const buttonAt = repairsSource.indexOf("data-repairs-maintenance-open");
    const introAt = repairsSource.indexOf("Unfortunately, there aren't many people");
    const databaseAt = repairsSource.indexOf("Browse the Machine Database");
    expect(buttonAt).toBeGreaterThan(-1);
    expect(introAt).toBeGreaterThan(buttonAt);
    expect(databaseAt).toBeGreaterThan(introAt);
    expect(repairsSource.slice(databaseAt, repairsSource.indexOf("countries.map"))).not.toContain(
      "data-repairs-maintenance-open",
    );
  });

  it("lists the four existing video pages as same-tab links", () => {
    const dialogStart = repairsSource.indexOf("data-repairs-maintenance-modal");
    const dialog = repairsSource.slice(dialogStart);
    expect(dialog).toContain("Basic Machine Maintenance");
    expect(dialog).toContain(
      "Learn two common maintenance tasks you can do at home. Check that the instructions apply to your machine's brand and model.",
    );
    expect(dialog).toContain(
      "These maintenance videos are included with Knit it Now membership.",
    );
    expect(dialog).toContain(">Close<");
    expect(dialog).toContain('href="/videos/242/"');
    expect(dialog).toContain('href="/videos/2061/"');
    expect(dialog).toContain('href="/videos/2141/"');
    expect(dialog).toContain('href="/videos/246/"');
    expect(dialog).toContain("Replacing a Sponge Bar");
    expect(dialog).toContain("Replacing the Sponge Bar");
    expect(dialog).not.toContain("target=");
    expect(dialog).not.toContain("<iframe");
    expect(dialog).not.toContain("player.vimeo");
  });
});

describe("trapRepairsMaintenanceFocus", () => {
  function control(id: string, focused: string[]) {
    return {
      id,
      focus: () => focused.push(id),
      hasAttribute: () => false,
      getAttribute: () => null,
      closest: () => null,
    };
  }

  function harness() {
    const focused: string[] = [];
    const close = control("close", focused);
    const last = control("last", focused);
    const dialog = {
      contains: (node: unknown) => node === close || node === last,
      querySelectorAll: () => [close, last],
    };
    return { dialog: dialog as unknown as HTMLElement, close, last, focused };
  }

  it("wraps Tab from the last control to the first", () => {
    const { dialog, last, focused } = harness();
    const event = {
      key: "Tab",
      shiftKey: false,
      preventDefault: () => focused.push("prevent"),
    } as KeyboardEvent;
    vi.stubGlobal("document", { activeElement: last });
    trapRepairsMaintenanceFocus(event, dialog);
    expect(focused).toEqual(["prevent", "close"]);
  });

  it("wraps Shift+Tab from the first control to the last", () => {
    const { dialog, close, focused } = harness();
    const event = {
      key: "Tab",
      shiftKey: true,
      preventDefault: () => focused.push("prevent"),
    } as KeyboardEvent;
    vi.stubGlobal("document", { activeElement: close });
    trapRepairsMaintenanceFocus(event, dialog);
    expect(focused).toEqual(["prevent", "last"]);
  });
});
