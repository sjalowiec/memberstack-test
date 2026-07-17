/**
 * Password-safe verification of memberstack-monthly-import.csv (counts only).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(
  __dirname,
  "../../tmp/memberstack-import/output/memberstack-monthly-import.csv",
);

function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        fields.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

function splitCsvRows(text) {
  const rows = [];
  let row = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      row += c;
    } else if ((c === "\n" || (c === "\r" && text[i + 1] !== "\n")) && !inQuotes) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (row.length) rows.push(row);
      row = "";
    } else row += c;
  }
  if (row.length) rows.push(row);
  return rows;
}

const text = fs.readFileSync(file, "utf8");
const rows = splitCsvRows(text);
const headers = parseCsvLine(rows[0]);
const data = rows.slice(1);

let blankEmail = 0;
let blankCust = 0;
let blankSub = 0;
let blankPw = 0;
let blankLegacy = 0;
const emailIdx = headers.indexOf("Email");
const pwIdx = headers.indexOf("Password");
const custIdx = headers.indexOf("Member Stripe Customer ID");
const subIdx = headers.indexOf("Member Stripe Subscription ID");
const legacyIdx = headers.indexOf("legacyMemberID");
const freeIdx = headers.indexOf("Free Plans");
const memIdx = headers.indexOf("Member ID");

for (const r of data) {
  const f = parseCsvLine(r);
  if (!String(f[emailIdx] || "").trim()) blankEmail++;
  if (!String(f[pwIdx] || "").trim()) blankPw++;
  if (!String(f[custIdx] || "").trim()) blankCust++;
  if (!String(f[subIdx] || "").trim()) blankSub++;
  if (!String(f[legacyIdx] || "").trim()) blankLegacy++;
}

console.log(
  JSON.stringify(
    {
      headers,
      dataRows: data.length,
      blankEmail,
      blankPassword: blankPw,
      blankStripeCustomerId: blankCust,
      blankStripeSubscriptionId: blankSub,
      blankLegacyMemberID: blankLegacy,
      memberIdAlwaysBlank: data.every((r) => !String(parseCsvLine(r)[memIdx] || "").trim()),
      freePlansAlwaysBlank: data.every((r) => !String(parseCsvLine(r)[freeIdx] || "").trim()),
    },
    null,
    2,
  ),
);
