import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openMemberstackLoginModal } from "./memberstackLogin";

let openModal: ReturnType<typeof vi.fn>;

beforeEach(() => {
  openModal = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("window", {
    location: { pathname: "/patterns/hat", search: "", hash: "" },
    $memberstackDom: {
      openModal,
      hideModal: vi.fn(),
    },
    dispatchEvent: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("openMemberstackLoginModal", () => {
  it("opens the LOGIN modal (secondary CTA)", () => {
    openMemberstackLoginModal();
    expect(openModal).toHaveBeenCalledTimes(1);
    expect(openModal).toHaveBeenCalledWith("LOGIN");
  });

  it("never opens the prebuilt SIGNUP modal", () => {
    openMemberstackLoginModal();
    expect(openModal).not.toHaveBeenCalledWith("SIGNUP");
  });
});
