import { describe, expect, it } from "vitest";
import type { VinylRecord } from "@my-vinyls/discogs";

import {
  availableGroups,
  buildCollection,
  groupRecords,
  priceBucket,
  purchasePriceKrw,
  resolveGroup,
  searchRecords,
  sortRecords,
} from "./grouping";
import { summarize } from "./summary";

function record(overrides: Partial<VinylRecord> = {}): VinylRecord {
  return {
    cover: "https://example.com/cover.jpg",
    artist: "Artist",
    title: "Title",
    year: 2020,
    genre: "Pop",
    genres: ["Pop"],
    styles: ["Synth-pop"],
    format: "Album",
    ...overrides,
  };
}

describe("availableGroups", () => {
  it("prefers `genres` over `genre` when the full list is present", () => {
    const groups = availableGroups([record({ genres: ["Pop", "Rock"] })]);
    expect(groups).toContain("genres");
    expect(groups).not.toContain("genre");
  });

  it("falls back to `genre` when no record carries a genre list", () => {
    const groups = availableGroups([record({ genres: [] })]);
    expect(groups).toContain("genre");
    expect(groups).not.toContain("genres");
  });

  it("drops country and purchase groupings when the data lacks them", () => {
    const groups = availableGroups([record({ country: undefined, purchase: undefined, styles: [] })]);
    expect(groups).not.toContain("country");
    expect(groups).not.toContain("styles");
    expect(groups).not.toContain("purchase_price");
    expect(groups).not.toContain("purchase_date");
    expect(groups).not.toContain("purchase_location");
  });

  it("is pure — repeated calls return the same set", () => {
    const records = [record()];
    expect(availableGroups(records)).toEqual(availableGroups(records));
  });
});

describe("resolveGroup", () => {
  const available = availableGroups([record({ country: "South Korea 🇰🇷" })]);

  it("falls back to the default for unknown or unavailable values", () => {
    expect(resolveGroup("nonsense", available)).toBe("format");
    expect(resolveGroup(null, available)).toBe("format");
    expect(resolveGroup("purchase_price", available)).toBe("format");
  });

  it("keeps a valid value", () => {
    expect(resolveGroup("artist", available)).toBe("artist");
  });
});

describe("searchRecords", () => {
  const records = [
    record({ artist: "IU", title: "Lilac", genre: "Pop", country: "South Korea 🇰🇷" }),
    record({ artist: "Daft Punk", title: "Discovery", genre: "Electronic", purchase: { location: "알라딘" } }),
  ];

  it("matches artist and title", () => {
    expect(searchRecords(records, "lilac")).toHaveLength(1);
    expect(searchRecords(records, "daft")).toHaveLength(1);
  });

  it("matches genre, country and purchase location — fields the old search missed", () => {
    expect(searchRecords(records, "electronic")).toHaveLength(1);
    expect(searchRecords(records, "korea")).toHaveLength(1);
    expect(searchRecords(records, "알라딘")).toHaveLength(1);
  });

  it("returns everything for an empty query", () => {
    expect(searchRecords(records, "  ")).toHaveLength(2);
  });
});

describe("sortRecords", () => {
  it("does not throw when a record has no purchase info", () => {
    const records = [
      record({ title: "Priced", purchase: { currency: "KRW", price: 28000, date: "2024-03-25" } }),
      record({ title: "Unpriced" }),
    ];
    expect(() => sortRecords(records, "purchase_price", "ascending")).not.toThrow();
  });

  it("sorts records without a price last", () => {
    const records = [record({ title: "Unpriced" }), record({ title: "Priced", purchase: { currency: "KRW", price: 100 } })];
    const sorted = sortRecords(records, "purchase_price", "ascending");
    expect(sorted.map((r) => r.title)).toEqual(["Priced", "Unpriced"]);
  });

  it("only reverses record order for purchase groupings", () => {
    const records = [record({ artist: "B" }), record({ artist: "A" })];
    expect(sortRecords(records, "format", "descending").map((r) => r.artist)).toEqual(["A", "B"]);
  });
});

describe("priceBucket", () => {
  it("buckets by order of magnitude", () => {
    expect(priceBucket(28000).lowerBound).toBe(20000);
    expect(priceBucket(9500).lowerBound).toBe(9000);
    expect(priceBucket(100).lowerBound).toBe(100);
  });

  it("collects anything under the smallest bound into a `~` bucket", () => {
    expect(priceBucket(5).lowerBound).toBe(0);
    expect(priceBucket(5).label.startsWith("~")).toBe(true);
  });

  it("handles prices past the top bound without mislabelling them", () => {
    // the Python version wrapped around here and reported ₩1,000,000 ~
    expect(priceBucket(9_500_000).lowerBound).toBe(9_000_000);
  });
});

describe("purchasePriceKrw", () => {
  it("uses the scraper-resolved KRW price", () => {
    expect(purchasePriceKrw(record({ purchase: { currency: "JPY", price: 3290, priceKrw: 30994 } }))).toBe(30994);
  });

  it("uses the raw price when it is already KRW", () => {
    expect(purchasePriceKrw(record({ purchase: { currency: "KRW", price: 28000 } }))).toBe(28000);
  });

  it("is undefined when no price is known", () => {
    expect(purchasePriceKrw(record({ purchase: { location: "알라딘" } }))).toBeUndefined();
    expect(purchasePriceKrw(record())).toBeUndefined();
  });
});

describe("groupRecords", () => {
  it("fans a record out across every one of its genres", () => {
    const { groups, matchCount } = groupRecords([record({ genres: ["Pop", "Rock", "Electronic"] })], "genres", "ascending");
    expect(groups.map((g) => g.name).sort()).toEqual(["Electronic", "Pop", "Rock"]);
    // the record is counted once even though it appears in three groups
    expect(matchCount).toBe(1);
  });

  it("orders artists by the name without its leading article", () => {
    const records = [record({ artist: "The Weeknd" }), record({ artist: "Zara" }), record({ artist: "Adele" })];
    const { groups } = groupRecords(records, "artist", "ascending");
    expect(groups.map((g) => g.name)).toEqual(["Adele", "The Weeknd", "Zara"]);
  });

  it("only strips a leading `The `, not one in the middle", () => {
    const { groups } = groupRecords([record({ artist: "Panic At The Disco" })], "artist", "ascending");
    expect(groups[0].sortKey).toBe("Panic At The Disco");
  });

  it("groups purchase dates by year", () => {
    const records = [
      record({ purchase: { date: "2024-03-25", currency: "KRW", price: 1 } }),
      record({ purchase: { date: "2024-11-02", currency: "KRW", price: 1 } }),
      record({ purchase: { date: "2025-01-26", currency: "KRW", price: 1 } }),
    ];
    const { groups } = groupRecords(records, "purchase_date", "ascending");
    expect(groups.map((g) => g.name)).toEqual(["2024", "2025"]);
    expect(groups[0].records).toHaveLength(2);
  });

  it("reverses group order on descending", () => {
    const records = [record({ format: "Album" }), record({ format: "Single" })];
    const { groups } = groupRecords(records, "format", "descending");
    expect(groups.map((g) => g.name)).toEqual(["Single", "Album"]);
  });

  it("puts everything in one group for `none`", () => {
    const { groups, sortable } = groupRecords([record(), record()], "none", "ascending");
    expect(groups).toHaveLength(1);
    expect(sortable).toBe(false);
  });

  it("orders year groups numerically", () => {
    const records = [record({ year: 1998 }), record({ year: 2005 }), record({ year: 1980 })];
    const { groups } = groupRecords(records, "year", "ascending");
    expect(groups.map((g) => g.name)).toEqual(["1980", "1998", "2005"]);
  });
});

describe("summarize", () => {
  it("counts formats and totals KRW spend", () => {
    const summary = summarize([
      record({ format: "Album", purchase: { currency: "KRW", price: 28000 } }),
      record({ format: "Album", purchase: { currency: "JPY", price: 3290, priceKrw: 30994 } }),
      record({ format: "Single" }),
    ]);
    expect(summary.formats).toEqual([
      ["Album", 2],
      ["Single", 1],
    ]);
    expect(summary.totalKrw).toBe(58994);
    expect(summary.recordCount).toBe(3);
  });
});

describe("missing-value groups", () => {
  it("stays last in descending order, not swept to the front by the reversal", () => {
    const records = [
      record({ purchase: { date: "2024-03-25", currency: "KRW", price: 1 } }),
      record({ purchase: { date: "2025-01-26", currency: "KRW", price: 1 } }),
      record({ purchase: { currency: "KRW", price: 1 } }), // no date
    ];

    const asc = groupRecords(records, "purchase_date", "ascending");
    expect(asc.groups.map((g) => g.name)).toEqual(["2024", "2025", "N/A"]);

    const desc = groupRecords(records, "purchase_date", "descending");
    expect(desc.groups.map((g) => g.name)).toEqual(["2025", "2024", "N/A"]);
  });

  it("keeps the unpriced bucket last in both directions", () => {
    const records = [
      record({ purchase: { currency: "KRW", price: 20000 } }),
      record({ purchase: { currency: "KRW", price: 90000 } }),
      record({ purchase: { location: "알라딘" } }), // no price
    ];
    expect(groupRecords(records, "purchase_price", "descending").groups.at(-1)?.name).toBe("N/A");
    expect(groupRecords(records, "purchase_price", "ascending").groups.at(-1)?.name).toBe("N/A");
  });

  it("does not mark the single `none` bucket as unavailable", () => {
    const { groups } = groupRecords([record()], "none", "ascending");
    expect(groups[0].unavailable).toBe(false);
  });
});

describe("per-field purchase group availability", () => {
  it("offers only the groupings the partial notes can support", () => {
    // a date-only note: price and location groupings would be all-N/A
    const groups = availableGroups([record({ purchase: { date: "2024-03-25" } })]);
    expect(groups).toContain("purchase_date");
    expect(groups).not.toContain("purchase_price");
    expect(groups).not.toContain("purchase_location");
  });

  it("offers all three when every field is filled in", () => {
    const groups = availableGroups([
      record({ purchase: { currency: "KRW", price: 28000, date: "2024-03-25", location: "알라딘" } }),
    ]);
    expect(groups).toEqual(expect.arrayContaining(["purchase_price", "purchase_date", "purchase_location"]));
  });

  it("treats a zero price as unknown, the way the Streamlit app did", () => {
    // Discogs' price field defaults to 0 when never filled in
    expect(purchasePriceKrw(record({ purchase: { currency: "KRW", price: 0 } }))).toBeUndefined();
    expect(availableGroups([record({ purchase: { currency: "KRW", price: 0 } })])).not.toContain("purchase_price");
  });
});

describe("buildCollection", () => {
  it("searches, sorts and groups together", () => {
    const records = [
      record({ artist: "IU", format: "Album", year: 2021 }),
      record({ artist: "Daft Punk", format: "Album", year: 2001 }),
      record({ artist: "IU", format: "Single", year: 2019 }),
    ];
    const { groups } = buildCollection(records, { search: "iu", group: "format", order: "ascending" });
    expect(groups.map((g) => g.name)).toEqual(["Album", "Single"]);
    expect(groups.flatMap((g) => g.records)).toHaveLength(2);
  });
});
