import type { VinylRecord } from "@my-vinyls/discogs";

import list from "../../../list.json";

/**
 * The single place the app gets records from.
 *
 * Today that's the `list.json` the scheduled Discogs scrape commits, imported
 * at build time so the whole site renders statically. Keeping it behind this
 * function means swapping in a live Discogs fetch — or a per-user source for
 * `/u/[username]` — is a change to this file alone.
 */
export function getCollection(): VinylRecord[] {
  return list as VinylRecord[];
}
