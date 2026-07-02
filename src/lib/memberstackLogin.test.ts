import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PUBLIC_SIGNUP_PATH,
  goToPublicSignup,
  openMemberstackLoginModal,
} from "./memberstackLogin";

let openModal: ReturnType<typeof vi.fn>;
let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  openModal = vi.fn().mockResolvedValue(undefined);
  assign = vi.fn();
  vi.stubGlobal("window", {
    location: { pathname: "/patterns/hat", search: "", hash: "", assign },
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

describe("Memberstack modal + signup helpers", () => {
  it("openMemberstackLoginModal opens the LOGIN modal (secondary CTA)", () => {
    openMemberstackLoginModal();
    expect(openModal).toHaveBeenCalledTimes(1);
    expect(openModal).toHaveBeenCalledWith("LOGIN");
  });

  it("goToPublicSignup navigates to the public signup form (never the prebuilt SIGNUP modal)", () => {
    goToPublicSignup();
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith(PUBLIC_SIGNUP_PATH);
    // Must NOT open the prebuilt Memberstack signup modal (which exposes internal member fields).
    expect(openModal).not.toHaveBeenCalledWith("SIGNUP");
  });

  it("goToPublicSignup honors an explicit signup path override", () => {
    goToPublicSignup("/custom-signup");
    expect(assign).toHaveBeenCalledWith("/custom-signup");
  });
});
