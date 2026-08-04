import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./patterns/test/stubLocalStorage";
import {
  TIP_REACTIONS,
  applyTipReactionSelection,
  hydrateTipReactions,
  isTipReactionId,
  persistTipReaction,
  readStoredTipReaction,
  selectTipReaction,
  tipReactionStorageKey,
  TIP_REACTION_ENDPOINT,
  TIP_REACTION_THANKS,
  writeStoredTipReaction,
  type TipReactionButtonEl,
  type TipReactionDomRoot,
} from "./tipOfTheWeekReactions";

function makeButton(id: string): TipReactionButtonEl & { selected: boolean; pressed: string } {
  const state = { selected: false, pressed: "false" };
  return {
    get selected() {
      return state.selected;
    },
    get pressed() {
      return state.pressed;
    },
    getAttribute(name: string) {
      if (name === "data-tip-reaction") return id;
      if (name === "aria-pressed") return state.pressed;
      return null;
    },
    setAttribute(name: string, value: string) {
      if (name === "aria-pressed") state.pressed = value;
    },
    removeAttribute() {},
    classList: {
      add(c: string) {
        if (c === "is-selected") state.selected = true;
      },
      remove(c: string) {
        if (c === "is-selected") state.selected = false;
      },
      contains(c: string) {
        return c === "is-selected" ? state.selected : false;
      },
    },
  };
}

function makeRoot(ids = ["helped", "will_try", "more_like_this"]) {
  const buttons = ids.map((id) => makeButton(id));
  const thanks = {
    hidden: true,
    textContent: "" as string | null,
    setAttribute: vi.fn(),
  };
  const root: TipReactionDomRoot = {
    querySelectorAll(sel: string) {
      if (sel.includes("data-tip-reaction")) return buttons;
      return [];
    },
    querySelector(sel: string) {
      if (sel.includes("thanks")) return thanks;
      return null;
    },
  };
  return { root, buttons, thanks };
}

describe("tipOfTheWeekReactions", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("recognizes only the three allowed reaction ids", () => {
    expect(isTipReactionId("helped")).toBe(true);
    expect(isTipReactionId("will_try")).toBe(true);
    expect(isTipReactionId("more_like_this")).toBe(true);
    expect(isTipReactionId("nope")).toBe(false);
  });

  it("keeps the will_try reaction id stable while using the smiling-face emoji", () => {
    const willTry = TIP_REACTIONS.find((r) => r.id === "will_try");
    expect(willTry?.emoji).toBe("🙂");
    expect(willTry?.id).toBe("will_try");
  });

  it("highlights only one selected reaction and shows confirmation", () => {
    const { root, buttons, thanks } = makeRoot();
    applyTipReactionSelection(root, "will_try");

    expect(buttons[0].selected).toBe(false);
    expect(buttons[1].selected).toBe(true);
    expect(buttons[2].selected).toBe(false);
    expect(buttons[1].pressed).toBe("true");
    expect(buttons[0].pressed).toBe("false");
    expect(thanks.hidden).toBe(false);
    expect(thanks.textContent).toBe(TIP_REACTION_THANKS);
  });

  it("updates selection when the visitor changes their choice", () => {
    const { root, buttons } = makeRoot();
    applyTipReactionSelection(root, "helped");
    applyTipReactionSelection(root, "more_like_this");

    expect(buttons.filter((b) => b.selected)).toHaveLength(1);
    expect(buttons[2].selected).toBe(true);
    expect(buttons[0].selected).toBe(false);
  });

  it("stores one reaction per tip id and overwrites on change", () => {
    const tipId = "taming-the-curl-2026-08";
    writeStoredTipReaction(tipId, "helped");
    expect(readStoredTipReaction(tipId)).toBe("helped");
    expect(localStorage.getItem(tipReactionStorageKey(tipId))).toBe("helped");

    writeStoredTipReaction(tipId, "will_try");
    expect(readStoredTipReaction(tipId)).toBe("will_try");
  });

  it("hydrates a prior selection without posting again", () => {
    const tipId = "tip-a";
    writeStoredTipReaction(tipId, "more_like_this");
    const { root, buttons, thanks } = makeRoot();
    const fetchImpl = vi.fn();

    const restored = hydrateTipReactions(root, tipId);
    expect(restored).toBe("more_like_this");
    expect(buttons[2].selected).toBe(true);
    expect(thanks.hidden).toBe(false);

    selectTipReaction(root, tipId, "helped", { skipPersist: true, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(readStoredTipReaction(tipId)).toBe("helped");
  });

  it("persists reactions best-effort to the tip reaction endpoint", () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    persistTipReaction({
      tipId: "tip-a",
      reaction: "helped",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(TIP_REACTION_ENDPOINT);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.tipId).toBe("tip-a");
    expect(body.reaction).toBe("helped");
    expect(body.visitorId).toBeTruthy();
  });
});
