import { describe, expect, it, vi } from "vitest";
import {
  helpHubToolFocusable,
  lockHelpHubToolPageScroll,
  trapHelpHubToolFocus,
  unlockHelpHubToolPageScroll,
} from "./helpHubToolModal";

describe("trapHelpHubToolFocus", () => {
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
      contains: (node: unknown) => node === close || node === last || node === dialog,
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
    trapHelpHubToolFocus(event, dialog);
    expect(focused).toEqual(["prevent", "close"]);
    vi.unstubAllGlobals();
  });

  it("wraps Shift+Tab from the first control to the last", () => {
    const { dialog, close, focused } = harness();
    const event = {
      key: "Tab",
      shiftKey: true,
      preventDefault: () => focused.push("prevent"),
    } as KeyboardEvent;
    vi.stubGlobal("document", { activeElement: close });
    trapHelpHubToolFocus(event, dialog);
    expect(focused).toEqual(["prevent", "last"]);
    vi.unstubAllGlobals();
  });

  it("skips controls inside an inert membership preview", () => {
    const focused: string[] = [];
    const close = control("close", focused);
    const locked = {
      ...control("locked", focused),
      closest: (selector: string) => (selector === "[hidden], [inert]" ? locked : null),
    };
    const dialog = {
      contains: () => true,
      querySelectorAll: () => [close, locked],
    };
    expect(helpHubToolFocusable(dialog as unknown as HTMLElement).map((el) => el.id)).toEqual([
      "close",
    ]);
  });
});

describe("help hub tool scroll lock", () => {
  it("restores the page scroll offset captured when the modal opened", () => {
    const scrolled: number[] = [];
    const body = {
      style: { position: "", top: "", left: "", right: "", width: "" },
    };
    vi.stubGlobal("document", {
      body,
      documentElement: { scrollTop: 0, style: { scrollBehavior: "" } },
    });
    vi.stubGlobal("window", {
      scrollY: 480,
      scrollTo: (_x: number, y: number) => scrolled.push(y),
    });

    const scrollY = lockHelpHubToolPageScroll();
    expect(scrollY).toBe(480);
    expect(body.style.position).toBe("fixed");
    expect(body.style.top).toBe("-480px");

    unlockHelpHubToolPageScroll(scrollY);
    expect(body.style.position).toBe("");
    expect(body.style.top).toBe("");
    expect(scrolled).toEqual([480]);
    vi.unstubAllGlobals();
  });
});
