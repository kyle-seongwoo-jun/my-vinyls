import { DiscogsClient } from "@lionralfs/discogs-client";
import type { GetReleasesResponse } from "@lionralfs/discogs-client/types/collection";

type Release = GetReleasesResponse["releases"][number];

const ARTIST_ALIAS = {
  "Blackpink": "BLACKPINK",
};

const { USERNAME, DISCOGS_API_KEY } = process.env;
if (!USERNAME || !DISCOGS_API_KEY) {
  throw new Error("USERNAME and DISCOGS_API_KEY must be set");
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
    const response = await client.user().collection().getReleases(USERNAME!, 0, {
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
    basic_information: { cover_image, artists, title, year, genres, formats },
    notes,
  } = release;

  const cover = cover_image;
  let artist = artists[0].name.replace(/ \(\d+\)$/, "");
  if (ARTIST_ALIAS[artist]) {
    artist = ARTIST_ALIAS[artist];
  }
  const genre = genres.join(", ");
  // const format = formats.map(x => x.name).join(', ')
  const format = formats[0].name;
  // const country = ''

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

  return {
    cover,
    artist,
    title,
    year,
    genre,
    format,
    // country,
    purchase,
  };
}

const releases = await getReleases();
const json = releases.map(convert);
console.log(JSON.stringify(json, null, 4));
