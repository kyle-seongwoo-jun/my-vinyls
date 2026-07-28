/**
 * Shape of `list.json`, shared between the scraper that writes it and the web
 * app that reads it. This is the single source of truth for the record type —
 * the web app imports it rather than redeclaring it.
 */

export interface PurchaseInfo {
  /** Currency the record was actually paid for in, e.g. "KRW", "JPY", "USD". */
  currency?: string;
  /** Price in `currency`. */
  price?: number;
  /**
   * `price` converted to KRW at the exchange rate on `date`, rounded to a whole
   * won. Resolved once by the scraper and cached, so it never drifts between
   * runs. Absent when no rate could be resolved.
   */
  priceKrw?: number;
  /** ISO date, e.g. "2025-01-26". */
  date?: string;
  /** Free-text place of purchase. */
  location?: string;
}

export interface VinylRecord {
  cover: string;
  artist: string;
  title: string;
  year: number;
  /** Primary genre — the first entry of `genres`. */
  genre: string;
  genres: string[];
  styles: string[];
  /** Normalised to one of: Album, EP, Single, Compilation, Box Set, N/A. */
  format: string;
  /** Hand-curated in `constants.ts`; absent for artists not yet mapped. */
  country?: string;
  purchase?: PurchaseInfo;
  /** Public discogs.com release page. */
  url?: string;
}
