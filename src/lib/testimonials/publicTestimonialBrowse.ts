export type PublicBrowseDirection = "previous" | "next";

export type PublicBrowseState = {
  offset: number;
  nextOffset: number;
  hasMore: boolean;
  cardCount: number;
  limit: number;
  phase: "ready" | "loading" | "error";
  pendingDirection: PublicBrowseDirection | null;
  failedDirection: PublicBrowseDirection | null;
  requestedOffset: number | null;
};

export function startPublicBrowseLoad(
  state: PublicBrowseState,
  direction: PublicBrowseDirection,
  requestedOffset: number,
): PublicBrowseState {
  return {
    ...state,
    phase: "loading",
    pendingDirection: direction,
    failedDirection: null,
    requestedOffset,
  };
}

/** A failed batch leaves the cards already on the page in place. */
export function failPublicBrowseLoad(state: PublicBrowseState): PublicBrowseState {
  return {
    ...state,
    phase: "error",
    failedDirection: state.pendingDirection,
    pendingDirection: null,
  };
}

export function acceptPublicBrowseBatch(
  state: PublicBrowseState,
  batch: { testimonials: unknown[]; offset: number; nextOffset: number; hasMore: boolean },
): PublicBrowseState {
  return {
    ...state,
    offset: batch.offset,
    nextOffset: batch.nextOffset,
    hasMore: batch.hasMore,
    cardCount: batch.testimonials.length,
    phase: "ready",
    pendingDirection: null,
    failedDirection: null,
    requestedOffset: null,
  };
}

export function publicBrowseRequestOffset(
  state: PublicBrowseState,
  direction: PublicBrowseDirection,
): number | null {
  if (state.phase === "error" && state.failedDirection === direction && state.requestedOffset != null) {
    return state.requestedOffset;
  }
  if (direction === "previous") {
    if (state.offset <= 0) return null;
    return Math.max(0, state.offset - state.limit);
  }
  if (!state.hasMore) return null;
  return state.nextOffset;
}

export function publicBrowseControlLabel(
  state: PublicBrowseState,
  direction: PublicBrowseDirection,
): "Previous stories" | "Next stories" | "Loading…" | "Retry" {
  if (state.phase === "loading" && state.pendingDirection === direction) return "Loading…";
  if (state.phase === "error" && state.failedDirection === direction) return "Retry";
  return direction === "previous" ? "Previous stories" : "Next stories";
}

export function publicBrowseControlDisabled(
  state: PublicBrowseState,
  direction: PublicBrowseDirection,
): boolean {
  if (state.phase === "loading") return true;
  return publicBrowseRequestOffset(state, direction) == null;
}

export function publicBrowseStatus(state: PublicBrowseState): string {
  if (state.phase === "loading") return "Loading stories…";
  if (state.phase === "error") return "Stories could not be loaded.";
  return "";
}

/** Place the first card just below the sticky site header and action bar. */
export function publicBrowseScrollTop(input: {
  listTop: number;
  scrollY: number;
  headerBottom: number;
  barHeight: number;
  gap?: number;
}): number {
  const gap = input.gap ?? 8;
  return Math.max(0, Math.round(input.listTop + input.scrollY - input.headerBottom - input.barHeight - gap));
}
