import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const clientSource = readFileSync(join(here, "helpHubFavoritesClient.ts"), "utf8");
const returnSource = readFileSync(join(here, "helpHubLandingReturnClient.ts"), "utf8");

describe("Help Hub My Favorites client", () => {
  it("uses the shared favorites list and opens login only from the button", () => {
    expect(clientSource).toContain("listFavorites");
    expect(clientSource).toContain("FAVORITES_CHANGE_EVENT");
    expect(clientSource).toContain("helpHubFavoriteTipRows");
    expect(clientSource).toContain("helpHubFavoriteRowHtml");
    expect(clientSource).toContain("[data-help-hub-favorites-login]");
    expect(clientSource).toContain('addEventListener("click"');
    expect(clientSource).toContain("openMemberstackLoginModal(getMemberstackReturnPath())");
    expect(clientSource).not.toContain('"/account"');
    expect(clientSource).not.toContain("openMemberstackLoginModal()");
    const refresh = clientSource.slice(
      clientSource.indexOf("async function refresh"),
      clientSource.indexOf("function applyChange"),
    );
    expect(refresh).not.toContain("openMemberstackLoginModal");
  });

  it("opens a listed question in place and remembers a full tip visit", () => {
    expect(clientSource).toContain("details[data-help-hub-answer]");
    expect(clientSource).toContain("rememberHelpHubLandingDestination");
    expect(clientSource).toContain('target.closest("[data-favorite-star]")');
    expect(returnSource).toContain("openFavorites");
    expect(returnSource).toContain("[data-help-hub-favorites]");
  });
});
