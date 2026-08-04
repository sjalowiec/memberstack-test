import { describe, expect, it, vi } from "vitest";
import {
  MOBILE_DRAWER_MAX_HEIGHT_VAR,
  attachMobileDrawerViewportListeners,
  computeMobileDrawerMaxHeightPx,
  resolveMobileDrawerMaxHeightPx,
  resolveVisibleViewportHeight,
} from "./mobileNavDrawerViewport";

describe("resolveVisibleViewportHeight", () => {
  it("prefers a positive visualViewport height", () => {
    expect(resolveVisibleViewportHeight(560, 844)).toBe(560);
  });

  it("falls back when visualViewport height is missing or invalid", () => {
    expect(resolveVisibleViewportHeight(undefined, 667)).toBe(667);
    expect(resolveVisibleViewportHeight(null, 667)).toBe(667);
    expect(resolveVisibleViewportHeight(0, 667)).toBe(667);
    expect(resolveVisibleViewportHeight(Number.NaN, 667)).toBe(667);
    expect(resolveVisibleViewportHeight(-10, 667)).toBe(667);
  });

  it("never returns a negative fallback", () => {
    expect(resolveVisibleViewportHeight(null, -20)).toBe(0);
  });
});

describe("resolveMobileDrawerMaxHeightPx", () => {
  it("sizes from header bottom to visible viewport bottom", () => {
    // Visible 560, header bottom 184 → 376px drawer.
    expect(resolveMobileDrawerMaxHeightPx(560, 184)).toBe(376);
  });

  it("clamps at zero when the header consumes the viewport", () => {
    expect(resolveMobileDrawerMaxHeightPx(200, 250)).toBe(0);
  });

  it("rounds to whole pixels", () => {
    // 560.7 - 184.2 = 376.5 → 377
    expect(resolveMobileDrawerMaxHeightPx(560.7, 184.2)).toBe(377);
  });
});

describe("computeMobileDrawerMaxHeightPx", () => {
  it("composes visible-viewport preference with header subtraction", () => {
    expect(
      computeMobileDrawerMaxHeightPx({
        visualViewportHeight: 560,
        fallbackViewportHeight: 844,
        headerBottomPx: 184,
      }),
    ).toBe(376);

    expect(
      computeMobileDrawerMaxHeightPx({
        visualViewportHeight: null,
        fallbackViewportHeight: 667,
        headerBottomPx: 150,
      }),
    ).toBe(517);
  });
});

describe("attachMobileDrawerViewportListeners", () => {
  it("subscribes to window resize and visualViewport resize/scroll", () => {
    const onSync = vi.fn();
    const windowTarget = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const visualViewport = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const dispose = attachMobileDrawerViewportListeners({
      onSync,
      windowTarget,
      visualViewport,
    });

    expect(windowTarget.addEventListener).toHaveBeenCalledWith(
      "resize",
      onSync,
      { passive: true },
    );
    expect(visualViewport.addEventListener).toHaveBeenCalledWith("resize", onSync);
    expect(visualViewport.addEventListener).toHaveBeenCalledWith("scroll", onSync);

    dispose();

    expect(windowTarget.removeEventListener).toHaveBeenCalledWith("resize", onSync);
    expect(visualViewport.removeEventListener).toHaveBeenCalledWith("resize", onSync);
    expect(visualViewport.removeEventListener).toHaveBeenCalledWith("scroll", onSync);
  });

  it("still attaches window resize when visualViewport is absent", () => {
    const onSync = vi.fn();
    const windowTarget = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const dispose = attachMobileDrawerViewportListeners({
      onSync,
      windowTarget,
      visualViewport: null,
    });

    expect(windowTarget.addEventListener).toHaveBeenCalledWith(
      "resize",
      onSync,
      { passive: true },
    );
    dispose();
    expect(windowTarget.removeEventListener).toHaveBeenCalledWith("resize", onSync);
  });
});

describe("mobile drawer CSS contract", () => {
  it("exports the CSS custom property name used by Header.astro", () => {
    expect(MOBILE_DRAWER_MAX_HEIGHT_VAR).toBe("--mobile-drawer-max-height");
  });
});
