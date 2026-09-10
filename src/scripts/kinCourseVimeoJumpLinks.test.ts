import { describe, expect, it } from "vitest";
import { KIN_VIMEO_PLAYER_ATTR, kinVimeoPlayerDomId } from "../lib/kinCourse/vimeoJumpLinks";
import {
  bindKinCourseVimeoJumpLinks,
  findKinVimeoPlayerIframe,
  seekKinVimeoJump,
} from "./kinCourseVimeoJumpLinks";

type AttrMap = Map<string, string>;

function makeIframe(playerKey: string) {
  const attrs: AttrMap = new Map([
    ["id", kinVimeoPlayerDomId(playerKey)],
    [KIN_VIMEO_PLAYER_ATTR, playerKey],
  ]);
  return {
    tagName: "IFRAME",
    id: kinVimeoPlayerDomId(playerKey),
    getAttribute(name: string) {
      return attrs.get(name) ?? null;
    },
  };
}

function makeRoot(iframe: ReturnType<typeof makeIframe>, playerKey: string) {
  const listeners: Array<(event: { target: unknown }) => void | Promise<void>> = [];
  const navAttrs: AttrMap = new Map([[KIN_VIMEO_PLAYER_ATTR, playerKey]]);
  const dataset: Record<string, string> = {};
  const buttonAttrs: AttrMap = new Map([["data-jump-seconds", "12"]]);
  const button = {
    className: "legacy-jumplink",
    getAttribute(name: string) {
      return buttonAttrs.get(name) ?? null;
    },
    closest(selector: string) {
      return selector === ".legacy-jumplink" ? button : null;
    },
  };
  const nav = {
    className: "legacy-jumplinks",
    dataset,
    getAttribute(name: string) {
      return navAttrs.get(name) ?? null;
    },
    addEventListener(_type: string, handler: (event: { target: unknown }) => void) {
      listeners.push(handler);
    },
    click() {
      return Promise.all(listeners.map((handler) => handler({ target: button })));
    },
  };

  const root = {
    querySelector(selector: string) {
      if (selector === `#${kinVimeoPlayerDomId(playerKey)}`) return iframe;
      if (selector === `iframe[${KIN_VIMEO_PLAYER_ATTR}="${playerKey}"]`) return iframe;
      return null;
    },
    querySelectorAll(selector: string) {
      return selector === ".legacy-jumplinks" ? [nav] : [];
    },
  };

  return { root, nav, button, listeners };
}

describe("kinCourseVimeoJumpLinks player binding", () => {
  it("finds the iframe by the stable player key", () => {
    const iframe = makeIframe("6400");
    const { root } = makeRoot(iframe, "6400");
    expect(findKinVimeoPlayerIframe(root as unknown as ParentNode, "6400")).toBe(iframe);
    expect(findKinVimeoPlayerIframe(root as unknown as ParentNode, "9999")).toBeNull();
  });

  it("clicking a chapter seeks the matching player, not a different one", async () => {
    const iframe = makeIframe("6400");
    const other = makeIframe("9999");
    const { root, nav } = makeRoot(iframe, "6400");
    const sought: Array<{ iframe: unknown; seconds: number }> = [];

    class Player {
      constructor(public el: HTMLIFrameElement) {}
      async setCurrentTime(seconds: number) {
        sought.push({ iframe: this.el, seconds });
      }
      async play() {}
    }

    bindKinCourseVimeoJumpLinks(root as unknown as ParentNode, async () => Player);
    await nav.click();

    expect(sought).toEqual([{ iframe, seconds: 12 }]);
    expect(sought[0]?.iframe).not.toBe(other);
  });

  it("seekKinVimeoJump calls setCurrentTime on the player constructed from the keyed iframe", async () => {
    const iframe = makeIframe("6400");
    const { root } = makeRoot(iframe, "6400");
    const calls: number[] = [];

    class Player {
      constructor(public el: HTMLIFrameElement) {}
      async setCurrentTime(seconds: number) {
        expect(this.el).toBe(iframe);
        calls.push(seconds);
      }
      async play() {}
    }

    const ok = await seekKinVimeoJump(
      root as unknown as ParentNode,
      "6400",
      35,
      async () => Player,
    );
    expect(ok).toBe(true);
    expect(calls).toEqual([35]);
  });
});
