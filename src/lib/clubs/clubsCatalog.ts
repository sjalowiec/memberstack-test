/**
 * Machine Knitting Clubs & Groups — data access layer.
 *
 * Single source of truth for reading the clubs directory
 * (src/data/machine-knitting-clubs.json) and shaping it for the
 * /reference/clubs page.
 *
 * The JSON is generated from src/data/machine-knitting-clubs.csv (see
 * scripts/build-clubs-json.cjs). Lat/Long are kept on each record for a future
 * map view but are not used by the directory yet.
 *
 * Search is normalized so that abbreviations and full names are
 * interchangeable: "California" finds clubs stored as state "CA", "CA" finds
 * California, "Canada" finds country "CA", and "Ontario"/"ON" find each other.
 *
 * Pages and components consume these helpers, never the JSON directly, so the
 * data source can later move without touching the UI.
 */
import clubsData from "../../data/machine-knitting-clubs.json";

/** Raw record shape as stored in machine-knitting-clubs.json. */
interface RawClub {
  name?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
  details?: string | null;
  lat?: number | null;
  long?: number | null;
}

/** A usable website link, or null when the source value is not a real URL. */
export interface ClubWebsite {
  href: string;
  label: string;
}

/** Normalized club record consumed by the directory UI. */
export interface Club {
  name: string;
  city: string;
  /** Original state/province value as stored (abbreviation or full name). */
  state: string;
  /** Resolved abbreviation, e.g. "CA", "ON" ("" when unknown). */
  stateAbbr: string;
  /** Resolved full name, e.g. "California", "Ontario" ("" when none). */
  stateName: string;
  /** Raw 2-letter country code as stored, e.g. "US", "CA", "GB". */
  country: string;
  /** Expanded country name, e.g. "United States", "Canada". */
  countryName: string;
  /** Sanitized website link (null when the source value was junk). */
  website: ClubWebsite | null;
  email: string;
  phone: string;
  contactName: string;
  details: string;
  /** Latitude, kept for a future map view. */
  lat: number | null;
  /** Longitude, kept for a future map view. */
  long: number | null;
  /** Combined "City, State, Country" location line (omits blanks). */
  location: string;
  /**
   * Space-separated set of unique, normalized search tokens covering name,
   * city, state (abbreviation + full name), country (name + aliases) and
   * details. Used for instant client-side matching.
   */
  search: string;
}

/** US states and DC, abbreviation → full name. */
const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  PR: "Puerto Rico", GU: "Guam", VI: "U.S. Virgin Islands",
};

/** Canadian provinces and territories, abbreviation → full name. */
const CA_PROVINCES: Record<string, string> = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", NS: "Nova Scotia",
  NT: "Northwest Territories", NU: "Nunavut", ON: "Ontario",
  PE: "Prince Edward Island", QC: "Quebec", SK: "Saskatchewan", YT: "Yukon",
};

/** Country code → display name. */
const COUNTRY_NAMES: Record<string, string> = {
  AU: "Australia", CA: "Canada", CH: "Switzerland", GB: "United Kingdom",
  UK: "United Kingdom", IE: "Ireland", IS: "Iceland", MX: "Mexico",
  NO: "Norway", NZ: "New Zealand", US: "United States",
};

/**
 * Extra search aliases per country code. We deliberately omit bare 2-letter
 * codes here so a search for "CA" matches the state California rather than the
 * country Canada (whose only token is "canada").
 */
const COUNTRY_ALIASES: Record<string, string> = {
  AU: "australia",
  CA: "canada",
  CH: "switzerland",
  GB: "united kingdom britain england scotland wales",
  UK: "united kingdom britain england scotland wales",
  IE: "ireland",
  IS: "iceland",
  MX: "mexico",
  NO: "norway",
  NZ: "new zealand",
  US: "united states america usa",
};

function clean(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

/**
 * Resolve a state/province value (which may be an abbreviation, a full name, or
 * empty) into both its abbreviation and full name. The country code is used to
 * disambiguate which lookup table to prefer.
 */
function resolveState(
  raw: string,
  country: string
): { abbr: string; name: string } {
  const v = raw.trim();
  if (!v) return { abbr: "", name: "" };

  const upper = v.toUpperCase();
  const preferred = country === "CA" ? CA_PROVINCES : US_STATES;
  const fallback = country === "CA" ? US_STATES : CA_PROVINCES;

  // Treat as an abbreviation first.
  if (preferred[upper]) return { abbr: upper, name: preferred[upper] };
  if (fallback[upper]) return { abbr: upper, name: fallback[upper] };

  // Otherwise treat the value as a full name and find its abbreviation.
  const lower = v.toLowerCase();
  for (const [abbr, name] of Object.entries(preferred)) {
    if (name.toLowerCase() === lower) return { abbr, name };
  }
  for (const [abbr, name] of Object.entries(fallback)) {
    if (name.toLowerCase() === lower) return { abbr, name };
  }

  // Unknown abbreviation/name: keep the raw value as the display name.
  return { abbr: "", name: v };
}

/** Lowercase, strip punctuation, de-duplicate words into a token string. */
function tokenize(...parts: string[]): string {
  const text = parts.filter(Boolean).join(" ").toLowerCase();
  const tokens = text.replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
  return Array.from(new Set(tokens)).join(" ");
}

/**
 * Many legacy website cells hold placeholder text ("No website", "n/a",
 * "none available", a bare email address, "facebook .com", etc.) instead of a
 * URL. Return a usable link only when we can extract a plausible domain.
 */
function normalizeWebsite(raw: string): ClubWebsite | null {
  const value = clean(raw);
  if (!value) return null;

  const lower = value.toLowerCase();
  if (/^(no website|n\/?a|none|none available|tbd|n\.a\.)$/i.test(lower)) return null;
  if (lower.startsWith("no website") || lower.startsWith("none")) return null;
  if (value.includes("@")) return null;

  const match = value.match(/(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?/i);
  if (!match) return null;

  const found = match[0];
  const href = /^https?:\/\//i.test(found) ? found : `https://${found}`;
  const label = found.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return { href, label };
}

function toClub(raw: RawClub): Club | null {
  const name = clean(raw.name);
  if (!name) return null;

  const city = clean(raw.city);
  const state = clean(raw.state);
  const country = clean(raw.country).toUpperCase();
  const countryName = COUNTRY_NAMES[country] || clean(raw.country);
  const { abbr: stateAbbr, name: stateName } = resolveState(state, country);
  const details = clean(raw.details);

  const locationState = stateAbbr || stateName;
  const location = [city, locationState, countryName].filter(Boolean).join(", ");

  const lat = typeof raw.lat === "number" && !Number.isNaN(raw.lat) ? raw.lat : null;
  const long = typeof raw.long === "number" && !Number.isNaN(raw.long) ? raw.long : null;

  const search = tokenize(
    name,
    city,
    stateAbbr,
    stateName,
    countryName,
    COUNTRY_ALIASES[country] || "",
    details
  );

  return {
    name,
    city,
    state,
    stateAbbr,
    stateName,
    country,
    countryName,
    website: normalizeWebsite(clean(raw.website)),
    email: clean(raw.email),
    phone: clean(raw.phone),
    contactName: clean(raw.contactName),
    details,
    lat,
    long,
    location,
    search,
  };
}

/** All clubs, sorted alphabetically by name. */
export function getAllClubs(): Club[] {
  return (clubsData as RawClub[])
    .map(toClub)
    .filter((c): c is Club => c !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

/** Unique, sorted country names present in the directory (for the filter). */
export function getClubCountries(): string[] {
  const set = new Set<string>();
  for (const c of getAllClubs()) if (c.countryName) set.add(c.countryName);
  return Array.from(set).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

/** Unique, sorted state/province names present in the directory (for the filter). */
export function getClubStates(): string[] {
  const set = new Set<string>();
  for (const c of getAllClubs()) if (c.stateName) set.add(c.stateName);
  return Array.from(set).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}
