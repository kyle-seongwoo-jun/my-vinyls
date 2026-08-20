import type { VinylRecord } from "@my-vinyls/discogs";

import { formatKrw, pluralize } from "./format";
import { purchasePriceKrw } from "./grouping";

export interface Summary {
  /** Format name -> count, in order of first appearance. */
  formats: Array<[format: string, count: number]>;
  /** Total spend in KRW across records that have a resolved price. */
  totalKrw: number;
  /** Distinct records — not inflated by genres/styles fan-out. */
  recordCount: number;
}

export function summarize(records: readonly VinylRecord[]): Summary {
  const formats = new Map<string, number>();
  let totalKrw = 0;

  for (const record of records) {
    const format = record.format || "N/A";
    formats.set(format, (formats.get(format) ?? 0) + 1);

    const price = purchasePriceKrw(record);
    if (price !== undefined) totalKrw += price;
  }

  return { formats: [...formats.entries()], totalKrw, recordCount: records.length };
}

/** e.g. `100 Albums, 11 Singles, 6 EPs`. */
export function formatCounts(summary: Summary): string {
  return summary.formats.map(([format, count]) => pluralize(count, format)).join(", ");
}

/**
 * The line under a group heading, e.g. `11 Singles, ₩312,000`.
 * Price is omitted when nothing in the group has a resolved price.
 */
export function formatGroupSummary(summary: Summary): string {
  const parts = [formatCounts(summary)];
  if (summary.totalKrw > 0) parts.push(formatKrw(summary.totalKrw));
  return parts.filter(Boolean).join(", ");
}
