"use client";

import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import type { VinylRecord } from "@my-vinyls/discogs";

import { CollectionContent } from "@/components/collection-content";
import { DEFAULT_GROUP, DEFAULT_ORDER } from "@/lib/grouping";

/**
 * Same query-parameter names the Streamlit app used (`search`, `group`,
 * `order`), so links people already have keep working.
 */
const searchParams = {
  search: parseAsString.withDefault(""),
  group: parseAsString.withDefault(DEFAULT_GROUP),
  order: parseAsStringLiteral(["ascending", "descending"] as const).withDefault(DEFAULT_ORDER),
};

export function CollectionView({ records }: { records: VinylRecord[] }) {
  const [state, setState] = useQueryStates(searchParams, {
    history: "replace",
    clearOnDefault: true,
  });

  return (
    <CollectionContent
      records={records}
      state={state}
      onChange={(next) => setState(next)}
      onClear={() => setState({ search: null, group: null, order: null })}
    />
  );
}
