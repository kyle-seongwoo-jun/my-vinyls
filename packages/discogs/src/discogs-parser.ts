import { ALBUM_COUNTRY, ARTIST_ALIAS, ARTIST_COUNTRY } from "./constants.js";

import { Format, Note, Release } from "./discogs-client.js";
import type { PurchaseInfo, VinylRecord } from "./types.js";

/**
 * Discogs "collection notes" are *custom fields the account owner defines*, so
 * these ids are specific to this Discogs account. Pointing the scraper at
 * another user would need `GET /users/{username}/collection/fields` to resolve
 * the ids by name first — see README.
 */
const PURCHASE_FIELD = {
  price: 4,
  date: 5,
  location: 6,
} as const;

export function convert(release: Release): VinylRecord {
  const {
    basic_information: { cover_image, artists, title, year, genres, styles, formats, resource_url },
    notes,
  } = release;

  const [main_title, secondary_title] = title.trim().split(" = ");
  const album_title = secondary_title ? `${main_title} (${secondary_title})` : main_title;

  // strip the disambiguation suffix Discogs appends to duplicate artist names
  const artist = artists[0].name.replace(/ \(\d+\)$/, "");
  const genre = genres[0];
  const format = parseFormat(formats);

  const country = ARTIST_COUNTRY[artist] || ALBUM_COUNTRY[title];
  const purchase = parsePurchase(notes);
  const url = resource_url.replace("api.discogs.com/releases/", "www.discogs.com/release/");

  return {
    cover: cover_image,
    artist: ARTIST_ALIAS[artist] || artist,
    title: album_title,
    year,
    genre,
    genres,
    styles,
    format,
    country,
    purchase,
    url,
  };
}

export function parseFormat(formats: Format[]): string {
  // TODO: Handle Box Sets and other multiple formats
  const isBoxSet = formats.find((x) => x.name === "Box Set");
  if (isBoxSet) {
    if (formats.length > 2) {
      return "Box Set";
    }
    formats = formats.filter((x) => x.name !== "Box Set");
  }

  // use first format (if multiple)
  const descriptions = formats[0].descriptions;

  // pick format from array
  const FORMAT_MAP = {
    "Album": "Album",
    "Single": "Single",
    "EP": "EP",
    "Compilation": "Compilation",
    // fallback
    "Mini-Album": "EP",
    "LP": "Album",
    '7"': "Single",
  };
  const format = Object.keys(FORMAT_MAP).find((x) => descriptions.includes(x));
  if (format) {
    return FORMAT_MAP[format];
  }

  // guess format
  if (descriptions.includes('7"')) {
    return "Single";
  }
  if (descriptions.includes('12"') && descriptions.includes("45 RPM")) {
    return "Single";
  }
  return "N/A";
}

/**
 * Reads the purchase custom fields. Every field is optional: a release with no
 * notes at all yields `undefined`, and a partially filled one yields whatever
 * was present. (The previous implementation asserted all three fields existed
 * and threw on any release missing one.)
 */
export function parsePurchase(notes: Note[] | undefined): PurchaseInfo | undefined {
  if (!notes?.length) return undefined;

  const valueOf = (fieldId: number) => notes.find((x) => x.field_id === fieldId)?.value?.trim() || undefined;

  const date = valueOf(PURCHASE_FIELD.date);
  const location = valueOf(PURCHASE_FIELD.location);
  const { currency, price } = parsePrice(valueOf(PURCHASE_FIELD.price));

  const purchase: PurchaseInfo = {};
  if (currency !== undefined) purchase.currency = currency;
  if (price !== undefined) purchase.price = price;
  if (date !== undefined) purchase.date = date;
  if (location !== undefined) purchase.location = location;

  return Object.keys(purchase).length > 0 ? purchase : undefined;
}

/** Parses the `"KRW 28000"` / `"USD 22.24"` shape the price field is filled in with. */
function parsePrice(raw: string | undefined): { currency?: string; price?: number } {
  if (!raw) return {};

  const match = /^([A-Za-z]{3})\s+(-?[\d.,]+)$/.exec(raw);
  if (match) {
    const price = Number.parseFloat(match[2].replace(/,/g, ""));
    if (Number.isFinite(price)) {
      return { currency: match[1].toUpperCase(), price };
    }
  }

  // bare amount with no currency prefix — keep the number, leave currency unknown
  const bare = Number.parseFloat(raw.replace(/,/g, ""));
  if (Number.isFinite(bare)) return { price: bare };

  console.warn(`[parser] unrecognised price value: ${JSON.stringify(raw)}`);
  return {};
}
