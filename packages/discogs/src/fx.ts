import { readFile, writeFile } from "node:fs/promises";

/**
 * Converts purchase prices to KRW using the exchange rate on the *purchase
 * date*, not today's rate.
 *
 * Historical rates never change, so every rate we resolve is cached in
 * `fx-rates.json` and committed. That keeps `list.json` byte-stable across
 * scrapes (no diff noise from a fluctuating rate) and makes the scrape
 * reproducible offline once the cache is warm.
 */

const FRANKFURTER_ENDPOINT = "https://api.frankfurter.app";
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Last-resort rates, used only when a brand-new purchase date cannot be looked
 * up live. Deterministic on purpose: a repeated outage produces the same
 * numbers rather than oscillating values. A later successful run corrects them.
 */
const FALLBACK_RATES_TO_KRW: Readonly<Record<string, number>> = {
  KRW: 1,
  USD: 1450,
  JPY: 9.5,
  EUR: 1570,
  GBP: 1840,
};

export type RateCache = Record<string, number>;

const cacheKey = (currency: string, date: string) => `${currency}@${date}`;

export async function loadRateCache(path: string): Promise<RateCache> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as RateCache;
  } catch {
    return {};
  }
}

export async function saveRateCache(path: string, cache: RateCache): Promise<void> {
  // sort keys so the committed file has a stable, reviewable order
  const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(path, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

async function fetchHistoricalRate(currency: string, date: string): Promise<number | undefined> {
  const url = `${FRANKFURTER_ENDPOINT}/${date}?from=${currency}&to=KRW`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) {
      console.warn(`[fx] ${currency}@${date}: HTTP ${response.status}`);
      return undefined;
    }
    const body = (await response.json()) as { rates?: Record<string, number> };
    const rate = body.rates?.KRW;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      console.warn(`[fx] ${currency}@${date}: no usable KRW rate in response`);
      return undefined;
    }
    return rate;
  } catch (error) {
    console.warn(`[fx] ${currency}@${date}: lookup failed —`, error instanceof Error ? error.message : error);
    return undefined;
  }
}

/**
 * Resolves the {currency} -> KRW rate for a date, consulting the cache first.
 * Mutates `cache` so subsequent lookups in the same run are free. Only rates
 * that were actually resolved (cache or live) are stored; fallback values are
 * deliberately not cached so a later run can correct them.
 */
export async function resolveRate(
  currency: string,
  date: string | undefined,
  cache: RateCache,
): Promise<number | undefined> {
  if (currency === "KRW") return 1;
  if (!date) return FALLBACK_RATES_TO_KRW[currency];

  const key = cacheKey(currency, date);
  const cached = cache[key];
  if (typeof cached === "number") return cached;

  const live = await fetchHistoricalRate(currency, date);
  if (live !== undefined) {
    cache[key] = live;
    return live;
  }

  const fallback = FALLBACK_RATES_TO_KRW[currency];
  if (fallback === undefined) {
    console.warn(`[fx] ${currency}: no fallback rate configured, leaving price unconverted`);
  }
  return fallback;
}

/** KRW has no minor units, so prices are whole won. */
export function toKrw(price: number, rate: number): number {
  return Math.round(price * rate);
}
