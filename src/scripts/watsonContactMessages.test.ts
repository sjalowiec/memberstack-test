import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

import {
  bulkDeleteFollowUp,
  contactSelectionState,
  deleteContactMessagePrompt,
  deleteSelectedContactMessagesPrompt,
  planContactListMutation,
  selectedContactMessageIds,
} from "./watsonContactMessages";

describe("contact message list actions", () => {
  it("reuses the status update API and confirms before delete", () => {
    const script = fs.readFileSync(path.resolve("src/scripts/watsonContactMessages.ts"), "utf8");
    const listPage = fs.readFileSync(
      path.resolve("src/pages/watson/contact-messages/index.astro"),
      "utf8",
    );
    const shell = fs.readFileSync(
      path.resolve("src/components/watson/WatsonPageShell.astro"),
      "utf8",
    );

    expect(script).toContain('method: "PATCH"');
    expect(script).toContain('status: "responded"');
    expect(script).toContain('method: "DELETE"');
    expect(script).toContain("window.confirm");
    expect(script).toContain("/api/watson/contact-messages/bulk-delete");
    expect(script).toContain("deleteSelectedContactMessagesPrompt");
    expect(script).toContain("data-contact-new-count");
    expect(script).toContain("View responded messages");
    expect(script).toContain("contactListHrefAfterRespond");
    expect(script).not.toContain("/.netlify/functions/contact");
    expect(listPage).toContain("Open message");
    expect(listPage).toContain("Select all on this page");
    expect(listPage).toContain("Delete selected (0)");
    expect(listPage).toContain("data-contact-select");
    expect(listPage).toContain("<th>Received</th>");
    expect(listPage).toContain("<th>Status</th>");
    expect(shell).toContain("data-contact-new-count");
  });

  it("names the sender in the delete confirmation", () => {
    expect(deleteContactMessagePrompt(" Spam Sender ")).toBe(
      "Delete the contact message from Spam Sender? This cannot be undone.",
    );
    expect(deleteContactMessagePrompt("   ")).toBe(
      "Delete the contact message from this sender? This cannot be undone.",
    );
  });

  it("removes a new message from the New list and lowers the count", () => {
    expect(
      planContactListMutation({
        filter: "new",
        status: "new",
        action: "respond",
        newCount: 4,
      }),
    ).toEqual({
      removeRow: true,
      nextStatus: null,
      nextNewCount: 3,
    });
  });

  it("selects only the current page and leaves unselected messages out", () => {
    const rows = [
      { visible: true, checked: true, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      { visible: true, checked: false, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
      { visible: false, checked: true, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
    ];

    expect(selectedContactMessageIds(rows)).toEqual([
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ]);
    expect(contactSelectionState(rows, false)).toMatchObject({
      selectedCount: 1,
      allSelected: false,
      someSelected: true,
      deleteDisabled: false,
      label: "Delete selected (1)",
    });
    expect(contactSelectionState([], false).deleteDisabled).toBe(true);
    expect(deleteSelectedContactMessagesPrompt(2)).toBe(
      "Permanently delete 2 contact messages? This cannot be undone.",
    );
    expect(deleteSelectedContactMessagesPrompt(1)).toBe(
      "Permanently delete 1 contact message? This cannot be undone.",
    );
  });

  it("keeps the selection when deletion fails and clears it after success", () => {
    const selected = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"];
    expect(
      bulkDeleteFollowUp({ ok: false, deletedCount: 0, selectedIds: selected }),
    ).toEqual({
      refresh: false,
      selectedIds: selected,
    });
    expect(
      bulkDeleteFollowUp({ ok: true, deletedCount: 1, selectedIds: selected }),
    ).toEqual({
      refresh: true,
      selectedIds: [],
    });
  });

  it("keeps a responded message on All and uses the server count after delete", () => {
    expect(
      planContactListMutation({
        filter: "all",
        status: "new",
        action: "respond",
        newCount: 4,
      }),
    ).toEqual({
      removeRow: false,
      nextStatus: "responded",
      nextNewCount: 3,
    });

    expect(
      planContactListMutation({
        filter: "all",
        status: "responded",
        action: "delete",
        newCount: 4,
        responseNewCount: 4,
      }),
    ).toEqual({
      removeRow: true,
      nextStatus: null,
      nextNewCount: 4,
    });
  });
});
