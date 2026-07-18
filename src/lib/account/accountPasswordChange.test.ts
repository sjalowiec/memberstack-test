import { describe, expect, it, vi } from "vitest";

import {
  MEMBERSTACK_PASSWORD_MIN_LENGTH,
  PASSWORD_CHANGE_PROVIDER_NEUTRAL_ERROR,
  inspectPasswordChangeProviderError,
  mapPasswordChangeProviderError,
  passwordChangeErrorStatus,
  passwordChangeSuccessStatus,
  submitPasswordChange,
  validatePasswordChangeFields,
} from "./accountPasswordChange";

describe("validatePasswordChangeFields", () => {
  it("requires current, new, and confirm passwords", () => {
    expect(
      validatePasswordChangeFields({
        currentPassword: "",
        newPassword: "newpass12",
        confirmPassword: "newpass12",
      }).ok,
    ).toBe(false);

    expect(
      validatePasswordChangeFields({
        currentPassword: "oldpass12",
        newPassword: "",
        confirmPassword: "newpass12",
      }).ok,
    ).toBe(false);

    expect(
      validatePasswordChangeFields({
        currentPassword: "oldpass12",
        newPassword: "newpass12",
        confirmPassword: "",
      }).ok,
    ).toBe(false);
  });

  it("rejects mismatched confirmation before calling the provider", () => {
    const result = validatePasswordChangeFields({
      currentPassword: "oldpass12",
      newPassword: "newpass12",
      confirmPassword: "newpass99",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("mismatch");
      expect(result.message).toMatch(/do not match/i);
    }
  });

  it("rejects new passwords under eight characters before calling the provider", () => {
    const result = validatePasswordChangeFields({
      currentPassword: "oldpass12",
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("new-too-short");
      expect(result.message).toBe(
        `New password must be at least ${MEMBERSTACK_PASSWORD_MIN_LENGTH} characters.`,
      );
    }
  });

  it("rejects new password equal to current", () => {
    const result = validatePasswordChangeFields({
      currentPassword: "samepass1",
      newPassword: "samepass1",
      confirmPassword: "samepass1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("same-as-current");
  });

  it("accepts matching distinct passwords that meet the minimum length", () => {
    const result = validatePasswordChangeFields({
      currentPassword: "oldpass12",
      newPassword: "newpass12",
      confirmPassword: "newpass12",
    });
    expect(result).toEqual({
      ok: true,
      values: {
        currentPassword: "oldpass12",
        newPassword: "newpass12",
        confirmPassword: "newpass12",
      },
    });
  });
});

describe("inspectPasswordChangeProviderError", () => {
  it("summarizes code, message, status, and nested own keys", () => {
    expect(
      inspectPasswordChangeProviderError({
        code: "invalid-password",
        message: "The provided password is invalid.",
        name: "Error",
        statusCode: 400,
        nested: { reason: "x" },
      }),
    ).toEqual({
      code: "invalid-password",
      message: "The provided password is invalid.",
      name: "Error",
      type: null,
      status: null,
      statusCode: 400,
      nested: { reason: "x" },
    });
  });
});

describe("mapPasswordChangeProviderError", () => {
  it("uses neutral copy for invalid-password (observed for wrong current password)", () => {
    // Reproduction: wrong current + valid 8-char new ? this exact provider payload.
    expect(
      mapPasswordChangeProviderError({
        code: "invalid-password",
        message: "The provided password is invalid.",
      }),
    ).toBe(PASSWORD_CHANGE_PROVIDER_NEUTRAL_ERROR);
  });

  it("does not append the raw provider message when it only repeats invalid-password wording", () => {
    const message = mapPasswordChangeProviderError({
      code: "invalid-password",
      message: "The provided password is invalid.",
    });
    expect(message).not.toMatch(/New password is invalid/i);
    expect(message).not.toContain("The provided password is invalid.");
  });

  it("uses neutral copy for invalid-credentials during password change", () => {
    expect(
      mapPasswordChangeProviderError({
        code: "invalid-credentials",
        message: "Invalid email or password.",
      }),
    ).toBe(PASSWORD_CHANGE_PROVIDER_NEUTRAL_ERROR);
  });

  it("keeps a specific message only for the length-specific provider code", () => {
    expect(
      mapPasswordChangeProviderError({
        code: "invalid-password-too-short",
        message: "Password too short",
      }),
    ).toBe(`New password must be at least ${MEMBERSTACK_PASSWORD_MIN_LENGTH} characters.`);
  });

  it("falls back to a distinct provider message when the code is unknown", () => {
    expect(
      mapPasswordChangeProviderError({
        code: "something-else",
        message: "Custom provider message",
      }),
    ).toBe("Custom provider message");
  });

  it("uses neutral copy for unknown codes with only generic password-invalid text", () => {
    expect(
      mapPasswordChangeProviderError({
        code: "unknown",
        message: "The provided password is invalid.",
      }),
    ).toBe(PASSWORD_CHANGE_PROVIDER_NEUTRAL_ERROR);
  });
});

describe("submitPasswordChange", () => {
  it("does not call the provider when confirmation does not match", async () => {
    const updateMemberAuth = vi.fn();
    const result = await submitPasswordChange({
      values: {
        currentPassword: "oldpass12",
        newPassword: "newpass12",
        confirmPassword: "newpass99",
      },
      updateMemberAuth,
    });

    expect(updateMemberAuth).not.toHaveBeenCalled();
    expect(result.outcome).toBe("client-error");
    if (result.outcome === "client-error") {
      expect(result.status).toEqual(
        passwordChangeErrorStatus("New password and confirmation do not match."),
      );
    }
  });

  it("does not call the provider when the new password is under eight characters", async () => {
    const updateMemberAuth = vi.fn();
    const result = await submitPasswordChange({
      values: {
        currentPassword: "oldpass12",
        newPassword: "short1",
        confirmPassword: "short1",
      },
      updateMemberAuth,
    });

    expect(updateMemberAuth).not.toHaveBeenCalled();
    expect(result.outcome).toBe("client-error");
    if (result.outcome === "client-error") {
      expect(result.status.message).toBe(
        `New password must be at least ${MEMBERSTACK_PASSWORD_MIN_LENGTH} characters.`,
      );
    }
  });

  it("shows neutral provider error for the observed wrong-current-password rejection", async () => {
    const updateMemberAuth = vi.fn().mockRejectedValue({
      code: "invalid-password",
      message: "The provided password is invalid.",
    });

    const result = await submitPasswordChange({
      values: {
        currentPassword: "wrong-old",
        newPassword: "newpass12",
        confirmPassword: "newpass12",
      },
      updateMemberAuth,
    });

    expect(result.outcome).toBe("provider-error");
    if (result.outcome === "provider-error") {
      expect(result.status.kind).toBe("error");
      expect(result.status.message).toBe(PASSWORD_CHANGE_PROVIDER_NEUTRAL_ERROR);
      expect(result.providerError).toEqual({
        code: "invalid-password",
        message: "The provided password is invalid.",
      });
    }
  });

  it("returns success only after the provider resolves", async () => {
    const updateMemberAuth = vi.fn().mockResolvedValue({ data: {} });

    const result = await submitPasswordChange({
      values: {
        currentPassword: "oldpass12",
        newPassword: "newpass12",
        confirmPassword: "newpass12",
      },
      updateMemberAuth,
    });

    expect(updateMemberAuth).toHaveBeenCalledWith({
      oldPassword: "oldpass12",
      newPassword: "newpass12",
    });
    expect(result.outcome).toBe("success");
    if (result.outcome === "success") {
      expect(result.status).toEqual(passwordChangeSuccessStatus());
    }
  });

  it("ignores stale responses after a newer submit", async () => {
    let resolveFirst!: () => void;
    const first = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const updateMemberAuth = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce({ data: {} });

    let generation = 0;
    const submit = (values: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) => {
      const myGen = ++generation;
      return submitPasswordChange({
        values,
        updateMemberAuth,
        isStale: () => myGen !== generation,
      });
    };

    const firstPromise = submit({
      currentPassword: "oldpass12",
      newPassword: "firstpass1",
      confirmPassword: "firstpass1",
    });
    const secondPromise = submit({
      currentPassword: "oldpass12",
      newPassword: "secondpass",
      confirmPassword: "secondpass",
    });

    resolveFirst();
    const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);

    expect(firstResult.outcome).toBe("stale");
    expect(secondResult.outcome).toBe("success");
  });
});
