import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  consumeHelpHubCardOpen,
  HELP_HUB_GA_LOCATION_PARAM,
  HELP_HUB_GA_SLUG_PARAM,
  helpHubGaLocationFromControl,
  reportHelpHubAction,
  reportHelpHubFavoriteCommitted,
  reportHelpHubTipPageOpen,
  resetHelpHubGaForTests,
  shouldReportHelpHubToProductionGa,
  type HelpHubGaStorage,
} from "./helpHubGa";

function memoryStorage(): HelpHubGaStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function productionContext(storage = memoryStorage()) {
  const calls: unknown[][] = [];
  return {
    storage,
    calls,
    context: {
      now: 1_000,
      hostname: "www.knititnow.com",
      isViteDev: false,
      publicSiteEnv: "production",
      measurementIdConfigured: true,
      storage,
      gtag: (...args: unknown[]) => {
        calls.push(args);
      },
    },
  };
}

function control(matches: Record<string, boolean>) {
  return {
    closest(selector: string) {
      return matches[selector] ? this : null;
    },
  };
}

describe("Help Hub GA environment", () => {
  it("keeps localhost, the dev server, and kin-dev out of production reporting", () => {
    expect(
      shouldReportHelpHubToProductionGa({
        hostname: "localhost",
        isViteDev: true,
        publicSiteEnv: "production",
      }),
    ).toBe(false);
    expect(
      shouldReportHelpHubToProductionGa({
        hostname: "kin-dev.netlify.app",
        isViteDev: false,
        publicSiteEnv: "production",
      }),
    ).toBe(false);
    expect(
      shouldReportHelpHubToProductionGa({
        hostname: "www.knititnow.com",
        isViteDev: false,
        publicSiteEnv: "dev",
      }),
    ).toBe(true);
  });
});

describe("Help Hub GA events", () => {
  it("sends the slug and control location and nothing personal", () => {
    resetHelpHubGaForTests();
    const { calls, context } = productionContext();
    expect(reportHelpHubAction("surprise_me", "Newer-Tip", "discovery_card", context)).toBe(true);
    expect(calls).toEqual([
      [
        "event",
        "surprise_me",
        {
          [HELP_HUB_GA_SLUG_PARAM]: "newer-tip",
          [HELP_HUB_GA_LOCATION_PARAM]: "discovery_card",
          transport_type: "beacon",
        },
      ],
    ]);
    const sent = JSON.stringify(calls);
    expect(sent).not.toContain("@");
    expect(sent).not.toContain("mem_");
    expect(sent).not.toContain("question");
  });

  it("does not call gtag from local or dev, or when the measurement id is missing", () => {
    resetHelpHubGaForTests();
    const { calls, context } = productionContext();
    expect(
      reportHelpHubAction("discovery_open", "sponge-bar", "accordion", {
        ...context,
        hostname: "127.0.0.1",
        isViteDev: true,
      }),
    ).toBe(false);
    expect(
      reportHelpHubAction("discovery_open", "sponge-bar", "accordion", {
        ...context,
        hostname: "kin-dev.netlify.app",
      }),
    ).toBe(false);
    expect(
      reportHelpHubAction("discovery_open", "sponge-bar", "tip_page", {
        ...context,
        measurementIdConfigured: false,
      }),
    ).toBe(false);
    expect(calls).toEqual([]);
  });

  it("drops a second delivery of the same action and still records a different control", () => {
    resetHelpHubGaForTests();
    const { calls, context } = productionContext();
    expect(reportHelpHubAction("discovery_open", "sponge-bar", "accordion", context)).toBe(true);
    expect(
      reportHelpHubAction("discovery_open", "sponge-bar", "accordion", { ...context, now: 1_200 }),
    ).toBe(false);
    expect(
      reportHelpHubAction("discovery_open", "sponge-bar", "tip_page", { ...context, now: 1_200 }),
    ).toBe(true);
    expect(calls.map((call) => call[1])).toEqual(["discovery_open", "discovery_open"]);
    expect(calls[1]?.[2]).toMatchObject({ help_hub_location: "tip_page" });
  });

  it("rejects a personal-looking slug", () => {
    resetHelpHubGaForTests();
    const { calls, context } = productionContext();
    expect(reportHelpHubAction("surprise_me", "sue@example.com", "discovery_card", context)).toBe(false);
    expect(reportHelpHubAction("favorite_save", "mem_sb_123", "accordion", context)).toBe(false);
    expect(calls).toEqual([]);
  });

  it("counts Read more once, on the discovery card", () => {
    resetHelpHubGaForTests();
    const { calls, context, storage } = productionContext();
    expect(reportHelpHubAction("discovery_open", "sponge-bar", "discovery_card", context)).toBe(true);
    expect(reportHelpHubTipPageOpen("sponge-bar", { ...context, now: 2_000 })).toBe(false);
    expect(storage.data.size).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[2]).toMatchObject({ help_hub_location: "discovery_card" });
  });

  it("counts a direct tip page visit", () => {
    resetHelpHubGaForTests();
    const { calls, context } = productionContext();
    expect(reportHelpHubTipPageOpen("sponge-bar", context)).toBe(true);
    expect(calls[0]?.[2]).toMatchObject({
      help_hub_slug: "sponge-bar",
      help_hub_location: "tip_page",
    });
  });

  it("ignores a stale card handoff", () => {
    resetHelpHubGaForTests();
    const storage = memoryStorage();
    storage.setItem(
      "kin_help_hub_ga_card_open",
      JSON.stringify({ slug: "sponge-bar", at: 1_000 }),
    );
    expect(consumeHelpHubCardOpen("sponge-bar", storage, 40_000)).toBe(false);
    expect(storage.data.size).toBe(0);
  });
});

describe("Help Hub favorite analytics", () => {
  it("names the control that was used", () => {
    expect(helpHubGaLocationFromControl(control({ "[data-help-hub-discovery]": true }))).toBe(
      "discovery_card",
    );
    expect(helpHubGaLocationFromControl(control({ "[data-help-hub-entry]": true }))).toBe("accordion");
    expect(
      helpHubGaLocationFromControl(control({ "[data-help-hub-article-slug]": true })),
    ).toBe("tip_page");
    expect(
      helpHubGaLocationFromControl(
        control({
          "[data-help-hub-preview-audience]": true,
          "[data-help-hub-article-slug]": true,
        }),
      ),
    ).toBeNull();
    expect(helpHubGaLocationFromControl(control({}))).toBeNull();
  });

  it("records a favorite only for a Help Hub control after the committed result", () => {
    resetHelpHubGaForTests();
    const { calls, context } = productionContext();
    expect(
      reportHelpHubFavoriteCommitted(
        {
          contentType: "reference",
          contentId: "/help-hub/Sponge-Bar",
          isFavorite: true,
          source: control({ "[data-help-hub-entry]": true }),
        },
        context,
      ),
    ).toBe(true);
    expect(
      reportHelpHubFavoriteCommitted(
        {
          contentType: "reference",
          contentId: "/help-hub/sponge-bar",
          isFavorite: false,
          source: control({ "[data-help-hub-article-slug]": true }),
        },
        { ...context, now: 2_000 },
      ),
    ).toBe(true);
    expect(
      reportHelpHubFavoriteCommitted(
        {
          contentType: "video",
          contentId: "/help-hub/sponge-bar",
          isFavorite: true,
          source: control({ "[data-help-hub-entry]": true }),
        },
        context,
      ),
    ).toBe(false);
    expect(
      reportHelpHubFavoriteCommitted(
        {
          contentType: "reference",
          contentId: "/reference/abbreviations",
          isFavorite: true,
          source: control({ "[data-help-hub-entry]": true }),
        },
        context,
      ),
    ).toBe(false);
    expect(calls.map((call) => [call[1], (call[2] as { help_hub_location: string }).help_hub_location])).toEqual([
      ["favorite_save", "accordion"],
      ["favorite_remove", "tip_page"],
    ]);
    expect(JSON.stringify(calls)).not.toContain("abbreviations");
  });
});

describe("Help Hub analytics wiring", () => {
  const here = dirname(fileURLToPath(import.meta.url));

  it("sends discovery-card opens through GA and waits for a successful favorite", () => {
    const discovery = readFileSync(join(here, "..", "..", "scripts", "helpHubDiscoveryClient.ts"), "utf8");
    const trackStart = discovery.indexOf("function track(");
    const trackEnd = discovery.indexOf("export function initHelpHubDiscovery");
    const track = discovery.slice(trackStart, trackEnd);
    expect(track).toContain('eventType === "surprise_me" || eventType === "discovery_open"');
    expect(track).toContain('reportHelpHubAction(eventType, slug, "discovery_card")');

    const controller = readFileSync(
      join(here, "..", "favorites", "favoriteStarController.ts"),
      "utf8",
    );
    const call = controller.indexOf("emitFavoriteCommitted(");
    expect(call).toBeGreaterThan(controller.indexOf("onSuccess:"));
    expect(controller.indexOf("emitFavoriteCommitted(", call + 1)).toBe(-1);
    expect(controller.slice(controller.indexOf("onOptimistic:"), controller.indexOf("onSuccess:"))).not.toContain(
      "emitFavoriteCommitted(",
    );
  });

  it("records a tip page open and favorite commits on the article page", () => {
    const article = readFileSync(join(here, "..", "..", "scripts", "helpHubLandingReturnClient.ts"), "utf8");
    const start = article.indexOf("export function initHelpHubArticleReturn");
    const body = article.slice(start);
    expect(body).toContain("reportHelpHubTipPageOpen(articleSlug)");
    expect(body).toContain("installHelpHubFavoriteAnalytics()");
    const index = readFileSync(join(here, "..", "..", "pages", "help-hub", "index.astro"), "utf8");
    expect(index).toContain("installHelpHubFavoriteAnalytics()");
  });
});
