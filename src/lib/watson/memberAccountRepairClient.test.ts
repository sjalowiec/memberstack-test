import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectMemberAccountRepairValues,
  clearMemberAccountRepairForm,
  fillMemberAccountRepairForm,
  initWatsonMemberAccountRepair,
  parseMemberAccountRepairPrefillJson,
  restoreMemberAccountRepairForm,
} from "./memberAccountRepairClient";
import { emptyMemberAccountRepairValues } from "./memberAccountRepair";

type FakeField = { name: string; value: string };

function createFakeForm(initial: Record<string, string> = {}) {
  const fields: FakeField[] = Object.entries({
    ...emptyMemberAccountRepairValues(),
    ...initial,
  }).map(([name, value]) => ({ name, value }));

  const buttons: Record<string, { click: () => void }> = {};

  const form = {
    fields,
    getAttribute: (name: string) =>
      name === "data-repair-prefill" ? JSON.stringify(initial) : null,
    querySelectorAll: (selector: string) => {
      if (selector.includes("[name]")) return fields;
      return [];
    },
    addEventListener: () => {},
    setAttribute: vi.fn(),
  };

  const output = { value: "", hidden: true, style: { display: "none" } };
  const status = { textContent: "" };
  const copyBtn = {
    addEventListener: (type: string, fn: () => void) => {
      if (type === "click") buttons.copy = { click: fn };
    },
  };
  const previewBtn = {
    addEventListener: (type: string, fn: () => void) => {
      if (type === "click") buttons.preview = { click: fn };
    },
  };
  const clearBtn = {
    addEventListener: (type: string, fn: () => void) => {
      if (type === "click") buttons.clear = { click: fn };
    },
  };
  const restoreBtn = {
    addEventListener: (type: string, fn: () => void) => {
      if (type === "click") buttons.restore = { click: fn };
    },
  };

  const root = {
    querySelector: (selector: string) => {
      if (selector === "[data-watson-member-account-repair]") return form;
      if (selector === "[data-repair-output]") return output;
      if (selector === "[data-repair-status]") return status;
      if (selector === "[data-repair-copy]") return copyBtn;
      if (selector === "[data-repair-preview]") return previewBtn;
      if (selector === "[data-repair-clear]") return clearBtn;
      if (selector === "[data-repair-restore]") return restoreBtn;
      return null;
    },
  };

  return { form, output, status, buttons, root };
}

describe("memberAccountRepairClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("clears the intake form and restores original Watson name and email", () => {
    const original = {
      ...emptyMemberAccountRepairValues(),
      Email: "texas44@gmail.com",
      Name: "Linda Dawson",
    };
    const { form } = createFakeForm(original);

    expect(collectMemberAccountRepairValues(form).Email).toBe("texas44@gmail.com");

    clearMemberAccountRepairForm(form);
    expect(collectMemberAccountRepairValues(form).Email).toBe("");
    expect(collectMemberAccountRepairValues(form).Name).toBe("");

    restoreMemberAccountRepairForm(form, original);
    expect(collectMemberAccountRepairValues(form).Email).toBe("texas44@gmail.com");
    expect(collectMemberAccountRepairValues(form).Name).toBe("Linda Dawson");
  });

  it("does not trigger mutation requests from copy, preview, clear, or restore", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    const original = {
      ...emptyMemberAccountRepairValues(),
      Email: "texas44@gmail.com",
      Name: "Linda Dawson",
    };
    const fake = createFakeForm(original);
    initWatsonMemberAccountRepair(fake.root as unknown as ParentNode);

    fake.buttons.preview.click();
    expect(fake.output.value).toContain("MEMBER ACCOUNT REPAIR");
    expect(fake.output.value).toContain("Email: texas44@gmail.com");
    expect(fake.output.value).not.toContain("Watson ID");

    await fake.buttons.copy.click();
    fake.buttons.clear.click();
    expect(collectMemberAccountRepairValues(fake.form).Email).toBe("");

    fake.buttons.restore.click();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(collectMemberAccountRepairValues(fake.form).Email).toBe("texas44@gmail.com");
    expect(fake.status.textContent).toBe("Original Watson data restored");
  });

  it("omits blank intake fields from the previewed report except Notes", () => {
    const fake = createFakeForm({
      Email: "texas44@gmail.com",
      Name: "",
      Problem: "   ",
    });
    initWatsonMemberAccountRepair(fake.root as unknown as ParentNode);
    fake.buttons.preview.click();

    expect(fake.output.value).toContain("Email: texas44@gmail.com");
    expect(fake.output.value).not.toContain("Customer:");
    expect(fake.output.value).not.toContain("Problem:");
    expect(fake.output.value).toContain("Notes:");
  });

  it("parses stored Watson prefill JSON without keeping unrelated keys", () => {
    const parsed = parseMemberAccountRepairPrefillJson(
      JSON.stringify({ Email: "a@b.com", password: "secret", "Watson ID": "mem_abc" }),
    );
    expect(parsed?.Email).toBe("a@b.com");
    expect(parsed && "Watson ID" in parsed).toBe(false);
    expect(parsed && "password" in parsed).toBe(false);
  });

  it("fill ignores unknown fields", () => {
    const { form } = createFakeForm();
    fillMemberAccountRepairForm(form, { Email: "a@b.com" });
    expect(collectMemberAccountRepairValues(form).Email).toBe("a@b.com");
  });
});
