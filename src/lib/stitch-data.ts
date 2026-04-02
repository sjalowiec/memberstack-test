import patterns from "../data/stitch/patterns.json" assert { type: "json" };
import techniques from "../data/stitch/techniques.json" assert { type: "json" };
import categories from "../data/stitch/categories.json" assert { type: "json" };
import categoryAssignments from "../data/stitch/category-assignments.json" assert { type: "json" };
import images from "../data/stitch/images.json" assert { type: "json" };
import files from "../data/stitch/files.json" assert { type: "json" };

export type StitchCatalogItem = {
  id: number;
  title: string;
  techniqueId: number;
  techniqueTitle: string;
  stitchMultiple: string;
  punchcard: boolean;
  lk150: boolean;
  dateMs: number;
  swatchSrc: string;
  categoryIds: number[];
  categoryTitles: string[];
};

type StitchImageRow = {
  patternId?: number;
  filename?: string;
  order?: number;
  active?: boolean;
  mainImage?: boolean;
};

function parseDateAdded(raw: unknown): number {
  const s = raw != null ? String(raw).trim() : "";
  if (!s) return 0;
  const t = Date.parse(s.replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T"));
  return Number.isNaN(t) ? 0 : t;
}

function mainSwatchSrcForPattern(pattern: {
  id: number;
  techniqueId: number;
  swatchUrl?: string;
}): string {
  const tid = pattern.techniqueId;
  const swatchUrl = (pattern as { swatchUrl?: string }).swatchUrl?.trim();
  if (swatchUrl) {
    return `/stitch-patterns/swatches/${tid}/${swatchUrl}`;
  }
  const imgs = (images as StitchImageRow[])
    .filter(
      (img) =>
        img.patternId === pattern.id && img.filename && img.active !== false
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const main =
    imgs.find((i) => i.mainImage)?.filename?.trim() ||
    imgs[0]?.filename?.trim();
  return main ? `/stitch-patterns/swatches/${tid}/${main}` : "";
}

/** Build-time list for the Stitch Library catalog (search, filter, sort on the client). */
export function getStitchCatalogItems(): StitchCatalogItem[] {
  return (patterns as Record<string, unknown>[]).map((pattern) => {
    const id = Number(pattern.id);
    const technique = getTechniqueById(Number(pattern.techniqueId));
    const cats = getCategoriesForPattern(id).filter(Boolean) as {
      id: number;
      title?: string;
    }[];
    return {
      id,
      title: String(pattern.title ?? ""),
      techniqueId: Number(pattern.techniqueId),
      techniqueTitle: technique?.title?.trim() || "",
      stitchMultiple: String(pattern.stitchMultiple ?? ""),
      punchcard: Boolean(pattern.punchcard),
      lk150: Boolean(pattern.lk150),
      dateMs: parseDateAdded(pattern.dateAdded),
      swatchSrc: mainSwatchSrcForPattern(
        pattern as { id: number; techniqueId: number; swatchUrl?: string }
      ),
      categoryIds: cats.map((c) => c.id),
      categoryTitles: cats
        .map((c) => (c.title || "").trim())
        .filter(Boolean),
    };
  });
}

export function getPatternById(id: number) {
  return patterns.find((p: any) => p.id === id);
}

export function getImagesForPattern(patternId: number) {
  return images.filter((img: any) => img.patternId === patternId);
}

export function getFilesForPattern(patternId: number) {
  return files.filter((file: any) => file.patternId === patternId);
}

export function getTechniqueById(id: number) {
  return techniques.find((t: any) => t.id === id);
}

export function getCategoriesForPattern(patternId: number) {
  const assignments = categoryAssignments.filter(
    (a: any) => a.patternId === patternId
  );
  return assignments.map((a: any) =>
    categories.find((c: any) => c.id === a.categoryId)
  );
}