import { describe, expect, it, vi } from "vitest";
import {
  HELP_HUB_CATEGORY_UPDATE_FAILED_MESSAGE,
  helpHubCategoryAdminErrorMessage,
  helpHubCategoryErrorResponse,
  isRawDatabaseErrorMessage,
} from "./categoryApiErrors";
import { HelpHubCategoryError } from "./categoryTypes";

describe("Help Hub category admin error messages", () => {
  it("hides raw database constraint errors from the admin", () => {
    const raw =
      'duplicate key value violates unique constraint "help_hub_categories_pkey"';
    expect(isRawDatabaseErrorMessage(raw)).toBe(true);
    expect(helpHubCategoryAdminErrorMessage(raw)).toBe(
      HELP_HUB_CATEGORY_UPDATE_FAILED_MESSAGE,
    );
    expect(helpHubCategoryAdminErrorMessage(raw)).not.toMatch(/help_hub_categories_pkey/);
    expect(helpHubCategoryAdminErrorMessage(raw)).not.toMatch(/duplicate key/i);
  });

  it("keeps intentional category-management messages", () => {
    expect(helpHubCategoryAdminErrorMessage("label is required.")).toBe("label is required.");
  });

  it("returns a plain-language 500 body for unexpected database errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = helpHubCategoryErrorResponse(
      new Error('duplicate key value violates unique constraint "help_hub_categories_pkey"'),
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe(HELP_HUB_CATEGORY_UPDATE_FAILED_MESSAGE);
    expect(JSON.stringify(body)).not.toMatch(/help_hub_categories_pkey/);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns HelpHubCategoryError messages to the admin", async () => {
    const response = helpHubCategoryErrorResponse(
      new HelpHubCategoryError("IN_USE", "This category still has entries."),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("This category still has entries.");
    expect(body.code).toBe("IN_USE");
  });
});
