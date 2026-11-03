import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FAVORITES_HELP_DEMO_SRC, trapFavoritesHelpFocus } from "./favoritesHelpModal";

const panel = readFileSync(resolve("src/components/dashboard/MyFavoritesPanel.astro"), "utf8");

describe("favorites help modal markup", () => {
  it("places the help link under the My Favorites heading and before the categories", () => {
    const heading = panel.indexOf('id="my-favorites-heading"');
    const help = panel.indexOf("data-favorites-help-open");
    const groups = panel.indexOf("data-kbm-my-favorites-groups");
    expect(heading).toBeGreaterThan(-1);
    expect(help).toBeGreaterThan(heading);
    expect(groups).toBeGreaterThan(help);
    expect(panel).toContain("How to save favorites");
    expect(panel).toContain('class="account-favorites__help-link"');
  });

  it("keeps the demonstration out of the initial markup and describes the modal", () => {
    const dialogStart = panel.indexOf("data-favorites-help-modal");
    const dialog = panel.slice(dialogStart);
    expect(dialog).toContain('id="favorites-help-title"');
    expect(dialog).toContain("How to save favorites");
    expect(dialog).toContain(
      "While logged in, click the star beside something you want to save. Find your saved items in My Favorites on your account page. Click the star again to remove an item.",
    );
    expect(dialog).toContain(
      "Starring a Tip of the Week saves its video under Videos, so you can find it even after the weekly tip changes.",
    );
    expect(dialog).toContain(
      'alt="Demonstration of saving a favorite and finding it on the account page."',
    );
    expect(dialog).toMatch(/data-favorites-help-close>\s*Close\s*</);
    expect(dialog).toContain("data-favorites-help-demo");
    expect(dialog).toContain("data-favorites-help-missing");
    expect(panel).toContain(".account-favorites-help-modal__demo[hidden]");
    expect(panel).not.toContain(`src="${FAVORITES_HELP_DEMO_SRC}"`);
    expect(panel).not.toContain("favorites-demo-placeholder");
    expect(FAVORITES_HELP_DEMO_SRC).toBe("/images/help/favorites.gif");
  });
});

describe("trapFavoritesHelpFocus", () => {
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
    trapFavoritesHelpFocus(event, dialog);
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
    trapFavoritesHelpFocus(event, dialog);
    expect(focused).toEqual(["prevent", "last"]);
  });
});
