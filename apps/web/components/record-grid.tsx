import type { VinylRecord } from "@my-vinyls/discogs";

import { RecordCard } from "./record-card";

interface RecordGridProps {
  records: readonly VinylRecord[];
  showPurchase?: boolean;
}

export function RecordGrid({ records, showPurchase }: RecordGridProps) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {records.map((record, index) => (
        <RecordCard
          // a release can legitimately appear twice (two copies of the same
          // pressing), so the url alone isn't unique
          key={`${record.url ?? record.title}-${index}`}
          record={record}
          showPurchase={showPurchase}
        />
      ))}
    </div>
  );
}
