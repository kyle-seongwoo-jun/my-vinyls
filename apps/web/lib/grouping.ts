import type { VinylRecord } from "@my-vinyls/discogs";

import { formatKrw } from "./format";

export const GROUP_KEYS = [
  "artist",
  "genre",
  "genres",
  "styles",
  "format",
  "year",
  "country",
  "purchase_price",
  "purchase_date",
  "purchase_location",
  "none",
] as const;

export type GroupKey = (typeof GROUP_KEYS)[number];
export type SortOrder = "ascending" | "descending";

export const DEFAULT_GROUP: GroupKey = "format";
export const DEFAULT_ORDER: SortOrder = "ascending";

/** Which record fields each grouping sorts its records by, in priority order. */
const SORT_FIELDS: Record<GroupKey, readonly SortField[]> = {
  artist: ["year", "title"],
  genre: ["artist", "year"],
  genres: ["artist", "year"],
  styles: ["artist", "year"],
  format: ["artist", "year"],
  year: ["artist", "title"],
  country: ["artist", "year"],
  purchase_price: ["purchase_price", "purchase_date"],
  purchase_date: ["purchase_date", "artist", "year"],
  purchase_location: ["purchase_date", "artist", "year"],
  none: ["artist", "year"],
};

type SortField = "artist" | "title" | "year" | "purchase_price" | "purchase_date";

/**
 * Only these groupings flip the *record* order; every other grouping keeps its
 * records ascending and flips the order of the groups themselves.
 */
const REVERSIBLE_RECORD_ORDER: ReadonlySet<GroupKey> = new Set<GroupKey>(["purchase_price", "purchase_date"]);

export const GROUP_LABELS: Record<GroupKey, string> = {
  artist: "artist",
  genre: "genre",
  genres: "genres",
  styles: "styles",
  format: "format",
  year: "year",
  country: "country",
  purchase_price: "purchase price",
  purchase_date: "purchase date",
  purchase_location: "purchase location",
  none: "none",
};

const collator = new Intl.Collator("ko", { numeric: true });

export interface Group {
  /** Heading shown above the group. */
  name: string;
  /** Value the groups are ordered by. */
  sortKey: string | number;
  /**
   * True for the bucket holding records with no value for the grouped field.
   * It is pinned last in both directions rather than being swept to the front
   * by the descending reversal.
   */
  unavailable: boolean;
  records: VinylRecord[];
}

export interface GroupedCollection {
  groups: Group[];
  /** Records matching the search, counted once even when they fan out across groups. */
  matchCount: number;
  /** True when there is more than one group to order. */
  sortable: boolean;
}

// ---------------------------------------------------------------------------
// derived record fields
// ---------------------------------------------------------------------------

/**
 * Purchase price normalised to KRW. The scraper resolves this once using the
 * rate on the purchase date, so the UI never does currency maths.
 */
export function purchasePriceKrw(record: VinylRecord): number | undefined {
  const { purchase } = record;
  if (!purchase) return undefined;

  // Discogs' price field defaults to 0 when it was never filled in, so a zero
  // price means "unknown", not "free". The Streamlit app read it the same way.
  if (!purchase.price) return undefined;

  if (purchase.priceKrw !== undefined) return purchase.priceKrw;
  // records priced in KRW don't need a conversion
  if (purchase.currency === "KRW") return purchase.price;
  return undefined;
}

export function purchaseDate(record: VinylRecord): string | undefined {
  return record.purchase?.date || undefined;
}

export function purchaseLocation(record: VinylRecord): string | undefined {
  return record.purchase?.location || undefined;
}

// ---------------------------------------------------------------------------
// group availability
// ---------------------------------------------------------------------------

/**
 * Hides groupings the data can't support. Pure — the Streamlit version mutated
 * a module-level dict, which only survived because Streamlit re-executes the
 * whole script on every interaction.
 */
export function availableGroups(records: readonly VinylRecord[]): GroupKey[] {
  const has = (predicate: (record: VinylRecord) => unknown) => records.some((record) => Boolean(predicate(record)));

  const hasGenres = has((record) => record.genres?.length);
  const hasStyles = has((record) => record.styles?.length);
  const hasCountry = has((record) => record.country);
  // notes can be filled in partially, so each purchase grouping is gated on its
  // own field rather than on the presence of a purchase block
  const hasPurchasePrice = has((record) => purchasePriceKrw(record) !== undefined);
  const hasPurchaseDate = has((record) => purchaseDate(record));
  const hasPurchaseLocation = has((record) => purchaseLocation(record));

  return GROUP_KEYS.filter((key) => {
    switch (key) {
      // `genres` (the full list) supersedes `genre` (just the first one)
      case "genres":
        return hasGenres;
      case "genre":
        return !hasGenres;
      case "styles":
        return hasStyles;
      case "country":
        return hasCountry;
      case "purchase_price":
        return hasPurchasePrice;
      case "purchase_date":
        return hasPurchaseDate;
      case "purchase_location":
        return hasPurchaseLocation;
      default:
        return true;
    }
  });
}

export function resolveGroup(value: string | null, available: readonly GroupKey[]): GroupKey {
  const candidate = value as GroupKey | null;
  if (candidate && available.includes(candidate)) return candidate;
  return available.includes(DEFAULT_GROUP) ? DEFAULT_GROUP : available[0];
}

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------

/**
 * Text a record is matched against. Wider than the Streamlit version, which
 * only searched artist/title/year/format — genre, style, country and the shop
 * a record came from are all things you'd reasonably search for.
 */
function haystack(record: VinylRecord): string {
  return [
    record.artist,
    record.title,
    record.year,
    record.format,
    record.genre,
    ...(record.genres ?? []),
    ...(record.styles ?? []),
    record.country,
    record.purchase?.location,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function searchRecords(records: readonly VinylRecord[], search: string): VinylRecord[] {
  const query = search.trim().toLowerCase();
  if (!query) return [...records];
  return records.filter((record) => haystack(record).includes(query));
}

// ---------------------------------------------------------------------------
// record ordering
// ---------------------------------------------------------------------------

function compareField(a: VinylRecord, b: VinylRecord, field: SortField): number {
  switch (field) {
    case "year":
      return (a.year ?? 0) - (b.year ?? 0);
    case "artist":
      return collator.compare(a.artist ?? "", b.artist ?? "");
    case "title":
      return collator.compare(a.title ?? "", b.title ?? "");
    case "purchase_price":
      return compareOptionalNumber(purchasePriceKrw(a), purchasePriceKrw(b));
    case "purchase_date":
      return compareOptionalString(purchaseDate(a), purchaseDate(b));
  }
}

/** Missing values sort last, so a record with no purchase info can't blow up the sort. */
function compareOptionalNumber(a: number | undefined, b: number | undefined): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a - b;
}

function compareOptionalString(a: string | undefined, b: string | undefined): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return collator.compare(a, b);
}

export function sortRecords(records: VinylRecord[], group: GroupKey, order: SortOrder): VinylRecord[] {
  const fields = SORT_FIELDS[group];
  const reverse = REVERSIBLE_RECORD_ORDER.has(group) && order === "descending";

  const sorted = [...records].sort((a, b) => {
    for (const field of fields) {
      const result = compareField(a, b, field);
      if (result !== 0) return result;
    }
    return 0;
  });

  return reverse ? sorted.reverse() : sorted;
}

// ---------------------------------------------------------------------------
// price buckets
// ---------------------------------------------------------------------------

/** 10, 20 … 90, 100, 200 … 900, 1 000 … up to 10 000 000. */
function priceBucketBounds(): number[] {
  const bounds: number[] = [];
  for (let digit = 1; digit <= 7; digit++) {
    const step = 10 ** digit;
    for (let value = step; value < step * 10; value += step) bounds.push(value);
  }
  return bounds;
}

const PRICE_BUCKETS = priceBucketBounds();

export function priceBucket(price: number): { lowerBound: number; label: string } {
  if (price < PRICE_BUCKETS[0]) {
    return { lowerBound: 0, label: `~ ${formatKrw(PRICE_BUCKETS[0])}` };
  }

  for (let i = PRICE_BUCKETS.length - 1; i >= 0; i--) {
    if (price >= PRICE_BUCKETS[i]) {
      return { lowerBound: PRICE_BUCKETS[i], label: `${formatKrw(PRICE_BUCKETS[i])} ~` };
    }
  }

  return { lowerBound: 0, label: `~ ${formatKrw(PRICE_BUCKETS[0])}` };
}

// ---------------------------------------------------------------------------
// grouping
// ---------------------------------------------------------------------------

const NOT_AVAILABLE = "N/A";

type GroupRef = { name: string; sortKey: string | number; unavailable?: boolean };

/** The bucket for records with no value for the grouped field. */
const missing = (): GroupRef => ({ name: NOT_AVAILABLE, sortKey: NOT_AVAILABLE, unavailable: true });

/**
 * The group(s) a record belongs to. `genres` and `styles` return several — a
 * record with 4 genres appears under all 4 headings.
 */
function groupsFor(record: VinylRecord, group: GroupKey): GroupRef[] {
  switch (group) {
    case "none":
      // not a missing value — this is the single bucket holding everything
      return [{ name: NOT_AVAILABLE, sortKey: NOT_AVAILABLE }];

    case "artist": {
      if (!record.artist) return [missing()];
      const artist = record.artist;
      // order by the name without its leading article, but still display it
      return [{ name: artist, sortKey: artist.replace(/^The /, "") }];
    }

    case "genres":
    case "styles": {
      const values = record[group];
      if (!values?.length) return [missing()];
      return values.map((value) => ({ name: value, sortKey: value }));
    }

    case "year": {
      const year = record.year;
      return year ? [{ name: String(year), sortKey: year }] : [missing()];
    }

    case "purchase_date": {
      const date = purchaseDate(record);
      if (!date || date.length < 4) return [missing()];
      const year = date.slice(0, 4);
      return [{ name: year, sortKey: year }];
    }

    case "purchase_price": {
      const price = purchasePriceKrw(record);
      if (price === undefined) return [missing()];
      const { lowerBound, label } = priceBucket(price);
      return [{ name: label, sortKey: lowerBound }];
    }

    case "purchase_location": {
      const location = purchaseLocation(record);
      if (!location) return [missing()];
      return [{ name: location, sortKey: location }];
    }

    case "genre":
    case "format":
    case "country": {
      const value = record[group];
      if (!value) return [missing()];
      return [{ name: value, sortKey: value }];
    }
  }
}

function compareGroups(a: Group, b: Group): number {
  if (typeof a.sortKey === "number" && typeof b.sortKey === "number") return a.sortKey - b.sortKey;
  return collator.compare(String(a.sortKey), String(b.sortKey));
}

export function groupRecords(records: readonly VinylRecord[], group: GroupKey, order: SortOrder): GroupedCollection {
  const table = new Map<string, Group>();

  for (const record of records) {
    for (const { name, sortKey, unavailable } of groupsFor(record, group)) {
      const existing = table.get(name);
      if (existing) {
        existing.records.push(record);
      } else {
        table.set(name, { name, sortKey, unavailable: unavailable ?? false, records: [record] });
      }
    }
  }

  const all = [...table.values()];
  const known = all.filter((entry) => !entry.unavailable).sort(compareGroups);
  const unavailable = all.filter((entry) => entry.unavailable);
  if (order === "descending") known.reverse();
  const groups = [...known, ...unavailable];

  return {
    groups,
    matchCount: records.length,
    sortable: group !== "none" && groups.length > 1,
  };
}

/** Search, sort and group in one pass — the order the Streamlit app applied them in. */
export function buildCollection(
  records: readonly VinylRecord[],
  { search, group, order }: { search: string; group: GroupKey; order: SortOrder },
): GroupedCollection {
  return groupRecords(sortRecords(searchRecords(records, search), group, order), group, order);
}
