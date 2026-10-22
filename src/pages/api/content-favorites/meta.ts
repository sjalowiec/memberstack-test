/**
 * Public titles and links for Tip of the Week and Knit-able favorites.
 * No member id. Draft and future tips are omitted. Unpublished Knit-ables
 * keep a title and an empty href so a saved row can say it is unavailable.
 */
import type { APIRoute } from "astro";
import { knitAbleFavoriteEntries, tipSavedMeta } from "../../../lib/favorites/savedContentCatalog";
import { knitAbleSlugFromPath } from "../../../lib/knit-ables/schedule";
import { listPublicKnitAbleCards } from "../../../lib/knit-ables/scheduleStore";
import { listAllTipOfTheWeek } from "../../../lib/tipOfTheWeek/store";

export const prerender = false;

export const GET: APIRoute = async () => {
  let tips: Awaited<ReturnType<typeof listAllTipOfTheWeek>> = [];
  try {
    tips = await listAllTipOfTheWeek();
  } catch (error) {
    console.error(
      "[content-favorites] tip lookup failed:",
      error instanceof Error ? error.message : "unknown error",
    );
  }

  const publishedSlugs = new Set<string>();
  try {
    const cards = await listPublicKnitAbleCards();
    for (const card of cards) {
      const slug = knitAbleSlugFromPath(card.href);
      if (slug) publishedSlugs.add(slug);
    }
  } catch (error) {
    console.error(
      "[content-favorites] knit-able lookup failed:",
      error instanceof Error ? error.message : "unknown error",
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      "tip-of-the-week": tipSavedMeta(tips),
      "knit-able": knitAbleFavoriteEntries(publishedSlugs),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
};
