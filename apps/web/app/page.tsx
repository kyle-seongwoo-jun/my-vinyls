import { Suspense } from "react";

import { CollectionContent, DEFAULT_STATE } from "@/components/collection-content";
import { CollectionView } from "@/components/collection-view";
import { getCollection } from "@/lib/collection";

/**
 * The collection is a build-time import, so the whole page is static. Filtering
 * and grouping happen client-side against the records handed down from here —
 * no refetch on interaction.
 *
 * `CollectionView` reads the URL, which has to suspend during prerender. The
 * fallback renders the very same grid at its default state, so the static HTML
 * ships a complete page rather than a skeleton.
 */
export default function Home() {
  const records = getCollection();

  return (
    <Suspense fallback={<CollectionContent records={records} state={DEFAULT_STATE} />}>
      <CollectionView records={records} />
    </Suspense>
  );
}
