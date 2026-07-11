import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { readCsvFile } from "./csvReader";

describe("csvReader", () => {
  it("parses quoted commas and rejects malformed row lengths", () => {
    const csv = ["memberid,Notes", '1,"has, comma"', "2,two,extra"].join("\n");

    const parsed = readCsvFileFromString(csv);
    expect(parsed.headers).toEqual(["memberid", "Notes"]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.Notes).toBe("has, comma");
    expect(parsed.rejectedRows).toHaveLength(1);
  });
});

function readCsvFileFromString(csv: string) {
  const filePath = path.join(os.tmpdir(), `watson-test-${Date.now()}.csv`);
  fs.writeFileSync(filePath, csv, "utf8");
  try {
    return readCsvFile(filePath);
  } finally {
    fs.unlinkSync(filePath);
  }
}
