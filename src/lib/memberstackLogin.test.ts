import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openMemberstackLoginModal, openMemberstackSignupModal } from "./memberstackLogin";

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

describe("Memberstack modal helpers", () => {
  it("openMemberstackSignupModal opens the SIGNUP/register modal (primary CTA)", () => {
    openMemberstackSignupModal();
    expect(openModal).toHaveBeenCalledTimes(1);
    expect(openModal).toHaveBeenCalledWith("SIGNUP");
  });

  it("openMemberstackLoginModal opens the LOGIN modal (secondary CTA)", () => {
    openMemberstackLoginModal();
    expect(openModal).toHaveBeenCalledTimes(1);
    expect(openModal).toHaveBeenCalledWith("LOGIN");
  });
});
