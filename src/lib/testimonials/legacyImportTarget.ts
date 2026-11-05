import {
  describeTestimonialDatabase,
  isolatedLocalTestimonialDatabase,
} from "./testimonialDatabase";

/** Named target that selects the configured Watson database. */
export const CONFIGURED_WATSON_IMPORT_TARGET = "configured-watson";

export type LegacyImportPlan =
  | { ok: true; write: false; description: string }
  | { ok: true; write: true; url: string; description: string }
  | { ok: false; reason: string };

function describeUrl(databaseUrl: string): string | null {
  try {
    const target = describeTestimonialDatabase(databaseUrl);
    return `${target.host}:${target.port}/${target.database}`;
  } catch {
    return null;
  }
}

/**
 * Default imports stay on an isolated local database. The configured Watson
 * database is used only when that target is named and --apply is also present.
 */
export function resolveLegacyImportDestination(input: {
  apply: boolean;
  target: string | null;
  localUrl: string;
  watsonUrl: string;
}): LegacyImportPlan {
  const selected = input.target?.trim() || "";
  if (selected && selected !== CONFIGURED_WATSON_IMPORT_TARGET) {
    return { ok: false, reason: `Unknown import target "${selected}".` };
  }

  if (selected === CONFIGURED_WATSON_IMPORT_TARGET) {
    const watsonUrl = input.watsonUrl.trim();
    if (!watsonUrl) {
      return {
        ok: false,
        reason: "WATSON_DATABASE_URL is unset, so the configured Watson target cannot be selected.",
      };
    }
    const description = describeUrl(watsonUrl);
    if (!description) {
      return { ok: false, reason: "WATSON_DATABASE_URL is not a usable Postgres URL." };
    }
    if (!input.apply) {
      return {
        ok: true,
        write: false,
        description: `Configured Watson target ${description}. Dry run only. Pass --apply with this target to write.`,
      };
    }
    return {
      ok: true,
      write: true,
      url: watsonUrl,
      description: `Configured Watson target ${description}.`,
    };
  }

  const localUrl = input.localUrl.trim();
  if (!localUrl) {
    return {
      ok: true,
      write: false,
      description: "TESTIMONIALS_DATABASE_URL is unset. The configured Watson database was not selected.",
    };
  }
  const safety = isolatedLocalTestimonialDatabase(localUrl);
  const description = `${safety.target.host}:${safety.target.port}/${safety.target.database}`;
  if (!input.apply) {
    return {
      ok: true,
      write: false,
      description: safety.ok
        ? `Local testimonial database ${description}. Dry run only.`
        : `${safety.reason} Dry run only.`,
    };
  }
  if (!safety.ok) return { ok: false, reason: safety.reason };
  return {
    ok: true,
    write: true,
    url: localUrl,
    description: `Local testimonial database ${description}.`,
  };
}
