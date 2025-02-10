import { parseFormat } from "./discogs-parser.js";

describe("discogs-parser", () => {
  it("should parse format - Album", () => {
    // Album
    expect(parseFormat([{
      name: "Vinyl",
      qty: "1",
      descriptions: ["LP", "Album"],
    }])).toBe("Album");

    // no Album, but LP
    expect(parseFormat([{
      name: "Vinyl",
      qty: "1",
      descriptions: ["LP"],
    }])).toBe("Album");
    expect(parseFormat([{
      name: "Vinyl",
      qty: "1",
      descriptions: ["LP", "Misprint"],
    }])).toBe("Album");
  });

  it("should parse format - EP", () => {
    // EP
    expect(parseFormat([{
      name: "Vinyl",
      qty: "1",
      descriptions: ["12\"", "EP"],
    }])).toBe("EP");

    // Mini-Album
    expect(parseFormat([{
      name: "Vinyl",
      qty: "1",
      descriptions: ["LP", "Mini-Album"],
    }])).toBe("EP");
  });

  it("should parse format - Single", () => {
    // Single
    expect(parseFormat([{
      name: "Vinyl",
      qty: "1",
      descriptions: ["12\"", "Single"],
    }])).toBe("Single");

    // 7"
    expect(parseFormat([{
      name: "Vinyl",
      qty: "1",
      descriptions: ["7\""],
    }])).toBe("Single");

    // 12" 45 RPM
    expect(parseFormat([{
      name: "Vinyl",
      qty: "1",
      descriptions: ["12\"", "45 RPM"],
    }])).toBe("Single");
  });

  it("should parse format - Compilation", () => {
    // Compilation
    expect(parseFormat([{
      name: "Vinyl",
      qty: "1",
      descriptions: ["LP", "Compilation"],
    }])).toBe("Compilation");
  });

  it("should parse format - Box Set", () => {
    // Box Set
    expect(parseFormat([
      {
        name: "Box Set",
        qty: "1",
        descriptions: ["Limited Edition"],
      },
      {
        name: "Vinyl",
        qty: "1",
        descriptions: ["LP"],
      },
      {
        name: "Vinyl",
        qty: "1",
        descriptions: ["LP"],
      },
    ])).toBe("Box Set");

    // Box Set, but single item
    expect(parseFormat([
      {
        name: "Box Set",
        qty: "1",
        descriptions: ["Limited Edition"],
      },
      {
        name: "Vinyl",
        qty: "1",
        descriptions: ["LP"],
      },
    ])).toBe("Album");
  });

  it("should parse format - multiple formats", () => {
    // multiple formats
    expect(parseFormat([
      {
        name: "Vinyl",
        qty: "1",
        descriptions: [
          "LP",
          "Album",
          "Misprint",
          "Reissue",
          "Remastered"
        ]
      },
      {
        name: "Vinyl",
        qty: "1",
        descriptions: [
          "7\"",
          "45 RPM"
        ]
      },
      {
        name: "All Media",
        qty: "1",
        descriptions: [
          "Limited Edition"
        ]
      }
    ])).toBe("Album");
  });
});
