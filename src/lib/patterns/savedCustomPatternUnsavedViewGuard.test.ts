import { describe, expect, it, vi } from "vitest";
import { runSavedPatternUnsavedViewWorkflow } from "./savedCustomPatternUnsavedViewGuard";

describe("saved custom pattern unsaved view guard", () => {
  it("navigates immediately when not dirty", async () => {
    const navigate = vi.fn();
    const saveActiveProject = vi.fn();
    const promptUnsaved = vi.fn();

    const res = await runSavedPatternUnsavedViewWorkflow({
      hasUnsaved: () => false,
      promptUnsaved,
      saveActiveProject,
      navigate,
    });

    expect(res).toBe("navigated");
    expect(promptUnsaved).not.toHaveBeenCalled();
    expect(saveActiveProject).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("opens dialog and cancels navigation on Cancel", async () => {
    const navigate = vi.fn();
    const saveActiveProject = vi.fn();

    const res = await runSavedPatternUnsavedViewWorkflow({
      hasUnsaved: () => true,
      promptUnsaved: async () => "cancel",
      saveActiveProject,
      navigate,
    });

    expect(res).toBe("cancelled");
    expect(saveActiveProject).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("views without saving when chosen", async () => {
    const navigate = vi.fn();
    const saveActiveProject = vi.fn();

    const res = await runSavedPatternUnsavedViewWorkflow({
      hasUnsaved: () => true,
      promptUnsaved: async () => "view-without-saving",
      saveActiveProject,
      navigate,
    });

    expect(res).toBe("navigated");
    expect(saveActiveProject).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("save & view saves first, then navigates", async () => {
    const calls: string[] = [];
    const navigate = vi.fn(() => calls.push("navigate"));
    const saveActiveProject = vi.fn(async () => {
      calls.push("save");
      return { ok: true } as const;
    });

    const res = await runSavedPatternUnsavedViewWorkflow({
      hasUnsaved: () => true,
      promptUnsaved: async () => "save-and-view",
      saveActiveProject,
      navigate,
    });

    expect(res).toBe("navigated");
    expect(calls).toEqual(["save", "navigate"]);
  });

  it("does not navigate if save fails", async () => {
    const navigate = vi.fn();
    const saveActiveProject = vi.fn(async () => ({ ok: false } as const));

    const res = await runSavedPatternUnsavedViewWorkflow({
      hasUnsaved: () => true,
      promptUnsaved: async () => "save-and-view",
      saveActiveProject,
      navigate,
    });

    expect(res).toBe("cancelled");
    expect(navigate).not.toHaveBeenCalled();
  });
});

