import { DiscogsClient } from "@lionralfs/discogs-client";
import type { GetReleasesResponse } from "@lionralfs/discogs-client/types/collection";

export type Release = GetReleasesResponse["releases"][number];
export type Format = Release["basic_information"]["formats"][number];
export type Note = Release["notes"][number];

const { DISCOGS_USERNAME, DISCOGS_API_KEY } = process.env;
if (!DISCOGS_USERNAME || !DISCOGS_API_KEY) {
  throw new Error("DISCOGS_USERNAME and DISCOGS_API_KEY must be set");
}

const client = new DiscogsClient({
  auth: {
    userToken: DISCOGS_API_KEY,
  },
});

export async function getReleases(): Promise<Release[]> {
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
