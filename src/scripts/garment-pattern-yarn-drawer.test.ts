import { afterEach, describe, expect, it, vi } from "vitest";
import {
  initGarmentPatternYarnDrawer,
  setGarmentPatternYarnActionVisible,
} from "./garment-pattern-yarn-drawer";

type FakeEl = {
  id?: string;
  classList: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; contains: ReturnType<typeof vi.fn> };
  dataset: Record<string, string>;
  hidden: boolean;
  style: { display: string };
  addEventListener: ReturnType<typeof vi.fn>;
  setAttribute: ReturnType<typeof vi.fn>;
  removeAttribute: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  clickHandlers: Array<() => void>;
};

function fakeEl(id?: string): FakeEl {
  const clickHandlers: Array<() => void> = [];
  const classes = new Set<string>();
  return {
    id,
    classList: {
      add: vi.fn((c: string) => classes.add(c)),
      remove: vi.fn((c: string) => classes.delete(c)),
      contains: vi.fn((c: string) => classes.has(c)),
    },
    dataset: {},
    hidden: false,
    style: { display: "" },
    addEventListener: vi.fn((type: string, handler: () => void) => {
      if (type === "click") clickHandlers.push(handler);
    }),
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    focus: vi.fn(),
    clickHandlers,
  };
}

describe("garment-pattern-yarn-drawer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("initializes open/close handlers once and calls onOpen when opening", () => {
    const drawer = fakeEl("express-yarn-drawer");
    drawer.classList.contains = vi.fn(() => false);
    const openBtn = fakeEl("express-yarn-drawer-open");
    const closeBtn = fakeEl("express-yarn-drawer-close");
    const backdrop = fakeEl("express-yarn-drawer-backdrop");
    const byId: Record<string, FakeEl> = {
      "express-yarn-drawer": drawer,
      "express-yarn-drawer-open": openBtn,
      "express-yarn-drawer-close": closeBtn,
      "express-yarn-drawer-backdrop": backdrop,
    };

    // Node vitest has no DOM HTMLElement; treat our fakes as elements.
    vi.stubGlobal("HTMLElement", class FakeHTMLElement {});
    const Proto = (globalThis as { HTMLElement: new () => object }).HTMLElement.prototype;
    Object.setPrototypeOf(drawer, Proto);
    Object.setPrototypeOf(openBtn, Proto);
    Object.setPrototypeOf(closeBtn, Proto);
    Object.setPrototypeOf(backdrop, Proto);

    const onOpen = vi.fn();
    const addDocListener = vi.fn();
    vi.stubGlobal("document", {
      getElementById: (id: string) => byId[id] ?? null,
      addEventListener: addDocListener,
      body: { classList: { add: vi.fn(), remove: vi.fn() } },
      activeElement: openBtn,
    });

    initGarmentPatternYarnDrawer({ onOpen });
    initGarmentPatternYarnDrawer({ onOpen }); // second call must not double-bind

    expect(openBtn.dataset.garmentYarnDrawerBound).toBe("true");
    expect(openBtn.addEventListener).toHaveBeenCalledTimes(1);
    expect(closeBtn.addEventListener).toHaveBeenCalledTimes(1);
    expect(backdrop.addEventListener).toHaveBeenCalledTimes(1);
    expect(addDocListener).toHaveBeenCalledWith("keydown", expect.any(Function));

    openBtn.clickHandlers[0]?.();
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(drawer.classList.add).toHaveBeenCalledWith("is-open");
    expect(drawer.setAttribute).toHaveBeenCalledWith("aria-hidden", "false");
  });

  it("hides and shows the How Much Yarn action for invalid/valid dimensions", () => {
    const openBtn = fakeEl("express-yarn-drawer-open");
    vi.stubGlobal("HTMLElement", class FakeHTMLElement {});
    Object.setPrototypeOf(
      openBtn,
      (globalThis as { HTMLElement: new () => object }).HTMLElement.prototype,
    );
    vi.stubGlobal("document", {
      getElementById: (id: string) => (id === "express-yarn-drawer-open" ? openBtn : null),
    });

    setGarmentPatternYarnActionVisible(false);
    expect(openBtn.hidden).toBe(true);
    expect(openBtn.style.display).toBe("none");
    expect(openBtn.setAttribute).toHaveBeenCalledWith("aria-expanded", "false");

    setGarmentPatternYarnActionVisible(true);
    expect(openBtn.hidden).toBe(false);
    expect(openBtn.style.display).toBe("");
    expect(openBtn.removeAttribute).toHaveBeenCalledWith("aria-disabled");
  });
});
