import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getReleases } from "./discogs-client.js";
import { convert } from "./discogs-parser.js";
import { loadRateCache, resolveRate, saveRateCache, toKrw } from "./fx.js";
import type { VinylRecord } from "./types.js";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RATE_CACHE_PATH = resolve(PACKAGE_ROOT, "fx-rates.json");

/** `--out <path>`, defaulting to `list.json` in the cwd. `-` means stdout. */
function parseOutPath(argv: string[]): string {
  const index = argv.indexOf("--out");
  if (index !== -1 && argv[index + 1]) return argv[index + 1];
  return resolve(process.cwd(), "list.json");
}

/** Fills in `purchase.priceKrw` so the web app never has to do currency maths. */
async function withKrwPrices(records: VinylRecord[]): Promise<VinylRecord[]> {
  const cache = await loadRateCache(RATE_CACHE_PATH);

  for (const { purchase } of records) {
    if (!purchase?.price || !purchase.currency) continue;
    // already in KRW — the web app reads `price` directly, no need to duplicate it
    if (purchase.currency === "KRW") continue;

    const rate = await resolveRate(purchase.currency, purchase.date, cache);
    if (rate !== undefined) purchase.priceKrw = toKrw(purchase.price, rate);
  }

  await saveRateCache(RATE_CACHE_PATH, cache);
  return records;
}

const outPath = parseOutPath(process.argv.slice(2));
const releases = await getReleases();
const records = await withKrwPrices(releases.map(convert));

// 4-space indent + trailing newline keeps the committed diff minimal
const json = `${JSON.stringify(records, null, 4)}\n`;

if (outPath === "-") {
  process.stdout.write(json);
} else {
  await writeFile(outPath, json, "utf8");
  // stderr so it never pollutes a piped run
  console.warn(`[scrape] wrote ${records.length} records to ${outPath}`);
}
