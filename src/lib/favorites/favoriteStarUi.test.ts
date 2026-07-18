import { describe, expect, it } from "vitest";
import {
  favoriteAriaLabel,
  favoriteStarButtonHtml,
  filterVideosByFavoriteIds,
  applyFavoriteStarState,
} from "./favoriteStarUi";

describe("favoriteStarUi", () => {
  it("builds aria labels for save and remove states", () => {
    expect(favoriteAriaLabel("10 Ways to Manage Floats", false)).toBe(
      "Save 10 Ways to Manage Floats to favorites",
    );
    expect(favoriteAriaLabel("10 Ways to Manage Floats", true)).toBe(
      "Remove 10 Ways to Manage Floats from favorites",
    );
  });

  it("renders a real button with aria-pressed and escaped attributes", () => {
    const html = favoriteStarButtonHtml({
      contentType: "video",
      contentId: 42,
      title: 'Floats & "Ribber"',
      isFavorite: false,
    });

    expect(html).toContain('type="button"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Save Floats &amp; &quot;Ribber&quot; to favorites");
    expect(html).toContain('data-content-id="42"');
    expect(html).toContain("fa-regular fa-star");
    expect(html).toContain('aria-hidden="true"');
  });

  it("marks saved state on the button markup", () => {
    const html = favoriteStarButtonHtml({
      contentType: "video",
      contentId: "9",
      title: "Demo",
      isFavorite: true,
    });
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("is-favorite");
    expect(html).toContain("fa-solid fa-star");
  });

  it("applies pressed state to a button-like element", () => {
    const attrs = new Map<string, string>([
      ["data-favorite-title", "Demo"],
      ["aria-pressed", "false"],
    ]);
    const iconClasses = new Set(["favorite-star__icon", "fa-regular", "fa-star"]);
    const button = {
      classList: {
        values: new Set<string>(),
        toggle(name: string, force?: boolean) {
          if (force) this.values.add(name);
          else this.values.delete(name);
        },
        contains(name: string) {
          return this.values.has(name);
        },
      },
      getAttribute(name: string) {
        return attrs.get(name) ?? null;
      },
      setAttribute(name: string, value: string) {
        attrs.set(name, value);
      },
      querySelector() {
        return {
          classList: {
            remove(...names: string[]) {
              for (const n of names) iconClasses.delete(n);
            },
            add(...names: string[]) {
              for (const n of names) iconClasses.add(n);
            },
            contains(name: string) {
              return iconClasses.has(name);
            },
          },
          setAttribute() {},
        };
      },
    };

    applyFavoriteStarState(button as unknown as HTMLButtonElement, true);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("Remove Demo from favorites");
    expect(button.classList.contains("is-favorite")).toBe(true);
    expect(iconClasses.has("fa-solid")).toBe(true);
  });

  it("filters catalog videos by hydrated favorite ids", () => {
    const videos = [
      { content_id: 1, title: "A" },
      { content_id: "2", title: "B" },
      { content_id: 3, title: "C" },
    ];
    const filtered = filterVideosByFavoriteIds(videos, ["2", "3"]);
    expect(filtered.map((v) => String(v.content_id))).toEqual(["2", "3"]);
  });
});
