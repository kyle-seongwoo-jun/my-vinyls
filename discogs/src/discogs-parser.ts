import { ALBUM_COUNTRY, ARTIST_ALIAS, ARTIST_COUNTRY } from "./constants.js";

import { Format, Note, Release } from "./discogs-client.js";

export function convert(release: Release) {
  const {
    basic_information: { cover_image, artists, title, year, genres, formats, resource_url },
    notes,
  } = release;

  const [main_title, secondary_title] = title.trim().split(" = ");
  const album_title = secondary_title ? `${main_title} (${secondary_title})` : main_title;

  const artist = artists[0].name.replace(/ \(\d+\)$/, "");
  const genre = genres.join(", ");
  const format = parseFormat(formats);

  const country = ARTIST_COUNTRY[artist] || ALBUM_COUNTRY[title];
  const purchase = parsePurchase(notes);
  const url = resource_url.replace('api.discogs.com/releases/', 'www.discogs.com/release/');

  return {
    cover: cover_image,
    artist: ARTIST_ALIAS[artist] || artist,
    title: album_title,
    year,
    genre,
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

export function parsePurchase(notes: Note[]) {
  const cur_price = notes.find((x) => x.field_id === 4)!.value.split(" ");
  const currency = cur_price[0];
  const price = parseFloat(cur_price[1]);
  const date = notes.find((x) => x.field_id === 5)!.value;
  const location = notes.find((x) => x.field_id === 6)!.value.trim();

  return {
    currency,
    price,
    date,
    location,
  };
}
