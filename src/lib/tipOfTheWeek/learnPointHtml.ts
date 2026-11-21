/**
 * What You’ll Learn points stay a list of saved strings.
 * Plain points stay plain text. Bold, italic, links, lists, and images stay safe HTML.
 */
import {
  billboardMessagePlainText,
  sanitizeBillboardHtml,
} from "../whatsNew/sanitizeBillboardHtml";

const SIMPLE_PARAGRAPH = /^<p>([\s\S]*)<\/p>$/i;
const INNER_MARKUP = /<(?:strong|em|a|br|ul|ol|li|img)\b/i;

/** Value stored for one learning point. Empty markup becomes "". */
export function normalizeTipLearnPoint(raw: string): string {
  const clean = sanitizeBillboardHtml(raw);
  if (!clean) return "";
  const simple = SIMPLE_PARAGRAPH.exec(clean);
  if (simple && !INNER_MARKUP.test(simple[1])) {
    return billboardMessagePlainText(clean);
  }
  return clean;
}
