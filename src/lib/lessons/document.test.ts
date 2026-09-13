import { describe, expect, it } from "vitest";
import { fieldsFromLessonDocument, lessonFromRow } from "./document";
import type { MemberLessonRow } from "./types";

describe("Lesson document helpers", () => {
  it("does not invent a category on import of a lesson that never had one", () => {
    const fields = fieldsFromLessonDocument(
      {
        id: 5002,
        slug: "tuck-on-the-lk150",
        status: "published",
        title: "Tuck on the LK150",
        intro: "this is the intro",
      },
      {
        id: 5002,
        slug: "tuck-on-the-lk150",
        status: "published",
        title: "Tuck on the LK150",
        category: "",
      },
    );
    expect(fields.category).toBeNull();
    expect("category" in fields.document).toBe(false);
  });

  it("does not invent status on a legacy document that omitted it", () => {
    const fields = fieldsFromLessonDocument(
      {
        id: 101,
        slug: "finish-clean-neckband",
        title: "Finish a Clean Neckband",
        access: "free",
      },
      {
        id: 101,
        slug: "finish-clean-neckband",
        status: "published",
        title: "Finish a Clean Neckband",
        category: "",
      },
    );
    expect(fields.status).toBe("published");
    expect("status" in fields.document).toBe(false);
  });

  it("reads the saved jsonb document without dropping nested blocks", () => {
    const row: MemberLessonRow = {
      id: 5002,
      slug: "tuck-on-the-lk150",
      status: "published",
      title: "Tuck on the LK150",
      category: null,
      document: {
        id: 5002,
        slug: "tuck-on-the-lk150",
        status: "published",
        title: "Tuck on the LK150",
        blocks: [{ type: "text", content: "Hello" }],
      },
      created_at: new Date("2026-09-08T00:00:00Z"),
      updated_at: new Date("2026-09-08T00:00:00Z"),
      updated_by: "sue@knititnow.com",
      deleted_at: null,
    };
    expect(lessonFromRow(row).blocks).toEqual([{ type: "text", content: "Hello" }]);
  });
});
