import { describe, expect, it, vi } from "vitest";
import {
  activateVideoBackToSearch,
  computeVideoBackToSearchRightPx,
  focusVideoSearchInput,
  getVideoBackToSearchScrollBehavior,
  prefersReducedMotion,
  scrollVideoToolbarIntoView,
  setVideoBackToSearchVisible,
  syncVideoBackToSearchDesktopPosition,
  syncVideoBackToSearchFromIntersection,
  VIDEO_BACK_TO_SEARCH_RIGHT_VAR,
} from "./videoBackToSearch";

function makeButton(hidden = true) {
  const attrs = new Map<string, string>();
  if (hidden) attrs.set("hidden", "");
  return {
    removeAttribute(name: string) {
      attrs.delete(name);
    },
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    hasAttribute(name: string) {
      return attrs.has(name);
    },
  };
}

describe("videoBackToSearch", () => {
  it("is hidden initially and stays hidden while the toolbar intersects", () => {
    const btn = makeButton(true);
    expect(btn.hasAttribute("hidden")).toBe(true);
    syncVideoBackToSearchFromIntersection(btn, true);
    expect(btn.hasAttribute("hidden")).toBe(true);
  });

  it("becomes visible after the toolbar leaves view", () => {
    const btn = makeButton(true);
    syncVideoBackToSearchFromIntersection(btn, false);
    expect(btn.hasAttribute("hidden")).toBe(false);
  });

  it("hides again when the toolbar returns to view", () => {
    const btn = makeButton(false);
    setVideoBackToSearchVisible(btn, true);
    syncVideoBackToSearchFromIntersection(btn, true);
    expect(btn.hasAttribute("hidden")).toBe(true);
  });

  it("scrolls to the toolbar with smooth behavior by default", () => {
    const scrollTo = vi.fn();
    const toolbar = {
      getBoundingClientRect: () => ({ top: 400 }),
    };
    scrollVideoToolbarIntoView(toolbar, {
      reduceMotion: false,
      headerOffsetPx: 100,
      windowLike: { scrollTo, scrollY: 800 },
    });
    expect(scrollTo).toHaveBeenCalledWith({
      top: 800 + 400 - 100,
      behavior: "smooth",
    });
    expect(getVideoBackToSearchScrollBehavior(false)).toBe("smooth");
  });

  it("uses immediate scrolling when prefers-reduced-motion is set", () => {
    expect(prefersReducedMotion(() => ({ matches: true }))).toBe(true);
    expect(getVideoBackToSearchScrollBehavior(true)).toBe("auto");

    const scrollTo = vi.fn();
    const focus = vi.fn();
    activateVideoBackToSearch({
      toolbar: { getBoundingClientRect: () => ({ top: 200 }) },
      searchInput: { focus },
      reduceMotion: true,
      headerOffsetPx: 80,
      windowLike: { scrollTo, scrollY: 500 },
    });
    expect(scrollTo).toHaveBeenCalledWith({
      top: 500 + 200 - 80,
      behavior: "auto",
    });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("activation scrolls to the toolbar then focuses search (smooth path)", () => {
    const scrollTo = vi.fn();
    const focus = vi.fn();
    const listeners = new Map<string, () => void>();
    activateVideoBackToSearch({
      toolbar: { getBoundingClientRect: () => ({ top: 50 }) },
      searchInput: { focus },
      reduceMotion: false,
      headerOffsetPx: 50,
      windowLike: {
        scrollTo,
        scrollY: 1000,
        addEventListener(type, listener) {
          listeners.set(type, listener);
        },
        removeEventListener(type) {
          listeners.delete(type);
        },
        setTimeout() {
          return 0;
        },
      },
    });
    expect(scrollTo).toHaveBeenCalledWith({
      top: 1000 + 50 - 50,
      behavior: "smooth",
    });
    expect(focus).not.toHaveBeenCalled();
    listeners.get("scrollend")?.();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("focuses the search input with preventScroll only when requested", () => {
    const focus = vi.fn();
    focusVideoSearchInput({ focus });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("computes desktop right offset from the live video-grid edge, not page-wrap", () => {
    // 1920 viewport, grid right at 1490 → 430px from viewport right + 8px inset
    expect(
      computeVideoBackToSearchRightPx({
        viewportWidth: 1920,
        gridRight: 1490,
        insetPx: 8,
      }),
    ).toBe(438);

    // 1450 viewport, grid right at 1255
    expect(
      computeVideoBackToSearchRightPx({
        viewportWidth: 1450,
        gridRight: 1255,
        insetPx: 8,
      }),
    ).toBe(203);

    // Must not use a fixed 1100px wrapper guess: a narrower measured grid
    // (e.g. nested main padding) yields a larger inset from the right.
    const wrapGuess = (1920 - 1100) / 2 + 20; // 430
    const measured = computeVideoBackToSearchRightPx({
      viewportWidth: 1920,
      gridRight: 1400,
      insetPx: 0,
    });
    expect(measured).toBe(520);
    expect(measured).not.toBe(wrapGuess);
  });

  it("writes a CSS custom property from the measured grid on desktop and clears it on mobile", () => {
    const props = new Map<string, string>();
    const styleTarget = {
      style: {
        setProperty(name: string, value: string) {
          props.set(name, value);
        },
        removeProperty(name: string) {
          props.delete(name);
        },
      },
    };
    const grid = {
      getBoundingClientRect: () => ({ right: 1255, width: 1060 }),
    };

    const desktop = syncVideoBackToSearchDesktopPosition({
      grid,
      styleTarget,
      viewportWidth: 1450,
      isMobile: false,
      insetPx: 8,
    });
    expect(desktop).toBe(203);
    expect(props.get(VIDEO_BACK_TO_SEARCH_RIGHT_VAR)).toBe("203px");

    const mobile = syncVideoBackToSearchDesktopPosition({
      grid,
      styleTarget,
      viewportWidth: 390,
      isMobile: true,
    });
    expect(mobile).toBeNull();
    expect(props.has(VIDEO_BACK_TO_SEARCH_RIGHT_VAR)).toBe(false);
  });
});
