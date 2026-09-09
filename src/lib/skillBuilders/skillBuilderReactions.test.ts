import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "../patterns/test/stubLocalStorage";
import {
  SKILL_BUILDER_FEEDBACK_SAVE_ERROR,
  SKILL_BUILDER_FEEDBACK_THANKS,
} from "./skillBuilderFeedback";
import {
  applySkillBuilderReactionSelection,
  hydrateSkillBuilderReactions,
  persistSkillBuilderReaction,
  readStoredSkillBuilderReaction,
  selectSkillBuilderReaction,
  skillBuilderReactionStorageKey,
  writeStoredSkillBuilderReaction,
  SKILL_BUILDER_REACTION_ENDPOINT,
  type SkillBuilderReactionButtonEl,
  type SkillBuilderReactionDomRoot,
} from "./skillBuilderReactions";
import { SKILL_BUILDER_REACTION_CONTENT_TYPE } from "./skillBuilderFeedback";

function makeButton(id: string): SkillBuilderReactionButtonEl & { selected: boolean; pressed: string } {
  const state = { selected: false, pressed: "false" };
  return {
    get selected() {
      return state.selected;
    },
    get pressed() {
      return state.pressed;
    },
    getAttribute(name: string) {
      if (name === "data-sb-feedback-reaction") return id;
      if (name === "aria-pressed") return state.pressed;
      return null;
    },
    setAttribute(name: string, value: string) {
      if (name === "aria-pressed") state.pressed = value;
    },
    classList: {
      add(c: string) {
        if (c === "is-selected") state.selected = true;
      },
      remove(c: string) {
        if (c === "is-selected") state.selected = false;
      },
    },
  };
}

function makeRoot(ids = ["did_it", "will_try", "need_help"]) {
  const buttons = ids.map((id) => makeButton(id));
  const status = {
    hidden: true,
    textContent: "" as string | null,
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
  };
  const help = { hidden: true };
  const root: SkillBuilderReactionDomRoot = {
    querySelectorAll(sel: string) {
      if (sel.includes("data-sb-feedback-reaction")) return buttons;
      return [];
    },
    querySelector(sel: string) {
      if (sel.includes("status")) return status;
      if (sel.includes("help")) return help;
      return null;
    },
  };
  return { root, buttons, status, help };
}

describe("skillBuilderReactions", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("highlights only one selected reaction and reveals help only for need_help", () => {
    const { root, buttons, help } = makeRoot();
    applySkillBuilderReactionSelection(root, "will_try");

    expect(buttons[0].selected).toBe(false);
    expect(buttons[1].selected).toBe(true);
    expect(buttons[2].selected).toBe(false);
    expect(buttons[1].pressed).toBe("true");
    expect(help.hidden).toBe(true);

    applySkillBuilderReactionSelection(root, "need_help");
    expect(buttons.filter((b) => b.selected)).toHaveLength(1);
    expect(buttons[2].selected).toBe(true);
    expect(help.hidden).toBe(false);
  });

  it("stores one reaction per Skill Builder id and overwrites on change", () => {
    const skillBuilderId = "skill-builder-short-rows";
    writeStoredSkillBuilderReaction(skillBuilderId, "did_it");
    expect(readStoredSkillBuilderReaction(skillBuilderId)).toBe("did_it");
    expect(localStorage.getItem(skillBuilderReactionStorageKey(skillBuilderId))).toBe("did_it");

    writeStoredSkillBuilderReaction(skillBuilderId, "will_try");
    expect(readStoredSkillBuilderReaction(skillBuilderId)).toBe("will_try");
  });

  it("hydrates a prior selection without posting again", async () => {
    const skillBuilderId = "skill-builder-e-wrap-cast-on";
    writeStoredSkillBuilderReaction(skillBuilderId, "need_help");
    const { root, buttons, status, help } = makeRoot();
    const fetchImpl = vi.fn();

    const restored = hydrateSkillBuilderReactions(root, skillBuilderId);
    expect(restored).toBe("need_help");
    expect(buttons[2].selected).toBe(true);
    expect(help.hidden).toBe(false);
    expect(status.hidden).toBe(false);
    expect(status.textContent).toBe(SKILL_BUILDER_FEEDBACK_THANKS);

    await selectSkillBuilderReaction(root, skillBuilderId, "did_it", { skipPersist: true, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(readStoredSkillBuilderReaction(skillBuilderId)).toBe("did_it");
  });

  it("persists each response with content type, visitor id, and member id when available", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("window", {
      location: { pathname: "/learn/skill-builders/short-rows" },
      __KBM_AUTH: { memberId: "mem_123" },
    });

    const saved = await persistSkillBuilderReaction({
      skillBuilderId: "skill-builder-short-rows",
      reaction: "did_it",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(saved).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(SKILL_BUILDER_REACTION_ENDPOINT);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.skillBuilderId).toBe("skill-builder-short-rows");
    expect(body.reaction).toBe("did_it");
    expect(body.contentType).toBe(SKILL_BUILDER_REACTION_CONTENT_TYPE);
    expect(body.visitorId).toBeTruthy();
    expect(body.memberId).toBe("mem_123");
    expect(body.sourcePage).toBe("/learn/skill-builders/short-rows");
    vi.unstubAllGlobals();
  });

  it("saves each of the three Skill Builder responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    for (const reaction of ["did_it", "will_try", "need_help"] as const) {
      fetchImpl.mockClear();
      const saved = await persistSkillBuilderReaction({
        skillBuilderId: "skill-builder-round-neckline-straight-shoulders",
        reaction,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(saved).toBe(true);
      expect(JSON.parse(fetchImpl.mock.calls[0][1].body).reaction).toBe(reaction);
    }
  });

  it("announces save failure accessibly without throwing", async () => {
    const { root, status } = makeRoot();
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    await selectSkillBuilderReaction(root, "skill-builder-shoulder-seams", "will_try", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(status.hidden).toBe(false);
    expect(status.textContent).toBe(SKILL_BUILDER_FEEDBACK_SAVE_ERROR);
    expect(status.setAttribute).toHaveBeenCalledWith("role", "alert");
    expect(readStoredSkillBuilderReaction("skill-builder-shoulder-seams")).toBe("will_try");
  });
});
