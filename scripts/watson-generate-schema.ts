import fs from "fs";
import path from "path";

import { buildLegacySchemaSql } from "../src/lib/watson/schema";
import { LEGACY_TABLE_DEFINITIONS } from "../src/lib/watson/tableDefinitions";

const target = path.resolve("src/lib/watson/schema.sql");
fs.writeFileSync(target, `${buildLegacySchemaSql(LEGACY_TABLE_DEFINITIONS)}\n`, "utf8");
console.log(`Wrote ${target}`);
