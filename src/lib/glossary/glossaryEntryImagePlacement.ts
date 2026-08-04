/**
 * Glossary entry image placement relative to helpinfo body copy.
 * Default (false/absent): image appears above helpinfo.
 * `imageAfterHelpinfo: true`: image appears directly after helpinfo
 * (shared by full glossary pages and the glossary modal, which both use GlossaryEntry).
 */
export function shouldPlaceGlossaryImageAfterHelpinfo(
  entry: { imageAfterHelpinfo?: unknown } | null | undefined,
): boolean {
  return entry?.imageAfterHelpinfo === true;
}
