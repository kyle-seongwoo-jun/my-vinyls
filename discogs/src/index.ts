import { DiscogsClient } from "@lionralfs/discogs-client";
import type { GetReleasesResponse } from "@lionralfs/discogs-client/types/collection";
import { ARTIST_ALIAS, ARTIST_COUNTRY } from "./artist-constants.js";
type Release = GetReleasesResponse["releases"][number];

const { DISCOGS_USERNAME, DISCOGS_API_KEY } = process.env;
if (!DISCOGS_USERNAME || !DISCOGS_API_KEY) {
  throw new Error("DISCOGS_USERNAME and DISCOGS_API_KEY must be set");
}

const client = new DiscogsClient({
  auth: {
    userToken: DISCOGS_API_KEY,
  },
});

async function getReleases(): Promise<Release[]> {
  let page = 1;
  let releases: Release[] = [];
  do {
    const response = await client.user().collection().getReleases(DISCOGS_USERNAME!, 0, {
      sort: "year",
      sort_order: "asc",
      page,
      per_page: 100,
    });
    releases = [...releases, ...response.data.releases];
    if (response.data.pagination.pages == page) break;
    page++;
  } while (true);

  return releases;
}

function convert(release: Release) {
  const {
    basic_information: { cover_image, artists, title, year, genres, formats, resource_url },
    notes,
  } = release;

  const cover = cover_image;
  const artist = artists[0].name.replace(/ \(\d+\)$/, "");
  const genre = genres.join(", ");
  const format = formats[0].name;

  const country = ARTIST_COUNTRY[artist];

  const cur_price = notes.find((x) => x.field_id === 4)!.value.split(" ");
  const currency = cur_price[0];
  const price = parseFloat(cur_price[1]);
  const date = notes.find((x) => x.field_id === 5)!.value;
  const location = notes.find((x) => x.field_id === 6)!.value.trim();
  const purchase = {
    currency,
    price,
    date,
    location,
  };

  const url = resource_url.replace('api.discogs.com/releases/', 'www.discogs.com/release/');

  return {
    cover,
    artist: ARTIST_ALIAS[artist] || artist,
    title,
    year,
    genre,
    format,
    country,
    purchase,
    url,
  };
}

const releases = await getReleases();
const json = releases.map(convert);
console.log(JSON.stringify(json, null, 4));
