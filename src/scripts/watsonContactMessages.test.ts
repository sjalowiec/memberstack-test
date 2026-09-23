import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

import {
  deleteContactMessagePrompt,
  planContactListMutation,
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
    expect(script).toContain("data-contact-new-count");
    expect(script).not.toContain("/.netlify/functions/contact");
    expect(listPage).toContain("Open message");
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
