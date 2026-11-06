export type PublicBrowseState = {
  nextOffset: number;
  hasMore: boolean;
  cardCount: number;
  phase: "ready" | "loading" | "error";
};

export function startPublicBrowseLoad(state: PublicBrowseState): PublicBrowseState {
  return { ...state, phase: "loading" };
}

/** A failed batch leaves every card already on the page in place. */
export function failPublicBrowseLoad(state: PublicBrowseState): PublicBrowseState {
  return { ...state, phase: "error" };
}

export function acceptPublicBrowseBatch(
  state: PublicBrowseState,
  batch: { testimonials: unknown[]; nextOffset: number; hasMore: boolean },
): PublicBrowseState {
  return {
    nextOffset: batch.nextOffset,
    hasMore: batch.hasMore,
    cardCount: state.cardCount + batch.testimonials.length,
    phase: "ready",
  };
}

export function publicBrowseButtonLabel(state: PublicBrowseState): "Show more stories" | "Retry" | null {
  if (state.phase === "error" || (state.phase === "loading" && state.cardCount === 0)) return "Retry";
  if (state.phase === "loading" || state.hasMore) return "Show more stories";
  return null;
}

export function publicBrowseStatus(state: PublicBrowseState): string {
  if (state.phase === "loading") return "Loading more stories…";
  if (state.phase === "error") return "Stories could not be loaded.";
  return "";
}
