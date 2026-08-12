/**
 * Temporary helpers for the legacy HTML compatibility experiment.
 * Scoped to one Course 111 lesson fixture — not a general migration pipeline.
 */

export type LegacyCompatSanitizeResult = {
  html: string;
  removals: Array<{ kind: string; detail: string }>;
  repairs: Array<{ kind: string; detail: string }>;
};

const COURSE_111_CHALLENGE_PREFIX = "/challenge/images/v2/111/";
const COURSE_111_PUBLIC_PREFIX = "/images/course-content/111/";

/** Known broken legacy paths → local public assets for this experiment only. */
const PATH_REWRITES: Array<[RegExp, string]> = [
  [
    /\/challenge\/images\/v2\/111\//gi,
    COURSE_111_PUBLIC_PREFIX,
  ],
  [
    /\/challenge\/images\/(arrow[123]\.png)/gi,
    `${COURSE_111_PUBLIC_PREFIX}$1`,
  ],
  [
    /\/path\/images\/1558\/woman_silhouette1\.gif/gi,
    `${COURSE_111_PUBLIC_PREFIX}woman_silhouette1.gif`,
  ],
  [
    /\/challenge\/images\/v2\/86\/lightbulb_icon_40x40\.png/gi,
    `${COURSE_111_PUBLIC_PREFIX}c86_lightbulb_icon_40x40.png`,
  ],
];

/**
 * Rewrite asset URLs used by the Course 111 raw export so local preview works.
 * Does not rewrite the stored CSV or cleaned POC JSON.
 */
export function rewriteExperimentAssetUrls(html: string): string {
  let result = html;
  for (const [pattern, replacement] of PATH_REWRITES) {
    result = result.replace(pattern, replacement);
  }
  // Common export typo: trailing double quote inside href="...pdf""
  result = result.replace(/(\.pdf)""/gi, '$1"');
  return result;
}

/**
 * Strip unsafe / non-renderable bits while keeping the lesson HTML recognizable.
 * Removals are returned so the page can document them (no silent rewrite of lesson meaning).
 */
export function sanitizeLegacyCourseHtml(html: string): LegacyCompatSanitizeResult {
  const removals: LegacyCompatSanitizeResult["removals"] = [];
  const repairs: LegacyCompatSanitizeResult["repairs"] = [];
  let result = html;

  result = result.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, () => {
    removals.push({
      kind: "script",
      detail: "Removed <script> block (unsafe to execute from legacy HTML).",
    });
    return "";
  });

  result = result.replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, (match) => {
    removals.push({
      kind: "inline-handler",
      detail: `Removed inline event handler: ${match.trim().slice(0, 80)}`,
    });
    return "";
  });

  result = result.replace(
    /<(object|embed|applet)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (match, tag) => {
      removals.push({
        kind: "plugin-tag",
        detail: `Removed <${tag}> plugin markup (obsolete / unsafe).`,
      });
      return `<aside class="legacy-compat-gap" role="note"><strong>Removed obsolete &lt;${tag}&gt; embed.</strong></aside>`;
    },
  );

  // Keep iframes only for Vimeo player (experiment video embeds).
  result = result.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, (match) => {
    if (/player\.vimeo\.com\/video\//i.test(match)) return match;
    removals.push({
      kind: "iframe",
      detail: "Removed non-Vimeo iframe from legacy HTML.",
    });
    return `<aside class="legacy-compat-gap" role="note"><strong>Non-Vimeo iframe removed.</strong></aside>`;
  });

  result = rewriteExperimentAssetUrls(result);

  // Documented structural repair: unclosed <img ...src="..."> before the next tag.
  // Example from Needles block: <img ... src="..."<br>
  result = result.replace(/<img\b([^>]*?)\s*(<)/gi, (full, attrs, next) => {
    repairs.push({
      kind: "unclosed-img",
      detail:
        "Inserted missing '>' on an <img> tag so the browser can parse the following markup. Content/paths unchanged.",
    });
    return `<img${attrs}>${next}`;
  });

  // Scope inline <style> rules under the wrapper so they cannot leak site-wide.
  result = result.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css: string) => {
    const scoped = scopeInlineCss(css, ".legacy-course-content");
    return `<style data-legacy-inline="scoped">${scoped}</style>`;
  });

  return { html: result, removals, repairs };
}

/**
 * Prefix bare selectors in legacy inline CSS with the experiment wrapper.
 * Intentionally simple — enough for this lesson's inline styles.
 */
export function scopeInlineCss(css: string, wrapper: string): string {
  // Drop HTML comments inside style blocks if any
  let cleaned = css.replace(/<!--[\s\S]*?-->/g, "");
  // Very small CSS splitter on top-level rules
  return cleaned.replace(/(^|})\s*([^@}{][^{]*)\{/g, (full, brace, selectors) => {
    const scopedSelectors = String(selectors)
      .split(",")
      .map((sel) => {
        const trimmed = sel.trim();
        if (!trimmed) return trimmed;
        if (trimmed.startsWith(wrapper)) return trimmed;
        // Keep keyframes / font-face alone if they appear (unlikely here)
        if (trimmed.startsWith("@")) return trimmed;
        return `${wrapper} ${trimmed}`;
      })
      .join(", ");
    return `${brace}\n${scopedSelectors} {`;
  });
}

export function collectUsedBootstrapishClasses(html: string): string[] {
  const found = new Set<string>();
  const re = /class=["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    for (const cl of m[1].split(/\s+/)) {
      if (cl) found.add(cl);
    }
  }
  return [...found].sort();
}

export { COURSE_111_CHALLENGE_PREFIX, COURSE_111_PUBLIC_PREFIX };
