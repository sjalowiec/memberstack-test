const REMOTE_HOST_MARKERS = [
  "supabase",
  "neon.tech",
  "amazonaws",
  "netlify",
  "pooler",
  "render.com",
  "railway",
  "azure",
];

export type TestimonialDatabaseTarget = {
  host: string;
  port: string;
  database: string;
};

export function describeTestimonialDatabase(databaseUrl: string): TestimonialDatabaseTarget {
  const parsed = new URL(databaseUrl);
  return {
    host: parsed.hostname.toLowerCase(),
    port: parsed.port || "5432",
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
  };
}

/**
 * Schema changes and imports are allowed only on a loopback Postgres database.
 * A hosted or shared database, including the Supabase pooler, is refused.
 */
export function isolatedLocalTestimonialDatabase(
  databaseUrl: string,
): { ok: true; target: TestimonialDatabaseTarget } | { ok: false; target: TestimonialDatabaseTarget; reason: string } {
  let target: TestimonialDatabaseTarget;
  try {
    target = describeTestimonialDatabase(databaseUrl);
  } catch {
    return {
      ok: false,
      target: { host: "(invalid)", port: "", database: "" },
      reason: "WATSON_DATABASE_URL is not a usable Postgres URL.",
    };
  }
  const localHost =
    target.host === "localhost" || target.host === "127.0.0.1" || target.host === "::1";
  if (!localHost || REMOTE_HOST_MARKERS.some((marker) => target.host.includes(marker))) {
    return {
      ok: false,
      target,
      reason: `Refusing testimonial schema changes and import on ${target.host}/${target.database}. Use an isolated local development database.`,
    };
  }
  if (/prod|production|live/i.test(target.database)) {
    return {
      ok: false,
      target,
      reason: `Refusing testimonial import into database ${target.database}.`,
    };
  }
  return { ok: true, target };
}
