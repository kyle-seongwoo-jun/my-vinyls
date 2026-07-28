"use client";

import { useMemo } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { VinylRecord } from "@my-vinyls/discogs";

import { FilterPanel } from "@/components/filter-panel";
import { RecordGrid } from "@/components/record-grid";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatKrw } from "@/lib/format";
import {
  availableGroups,
  buildCollection,
  DEFAULT_GROUP,
  DEFAULT_ORDER,
  resolveGroup,
  type GroupKey,
  type SortOrder,
} from "@/lib/grouping";
import { formatCounts, formatGroupSummary, summarize } from "@/lib/summary";

/** Groupings where a per-group spend total is worth showing. */
const PURCHASE_GROUPS = new Set<GroupKey>([
  "artist",
  "country",
  "purchase_price",
  "purchase_date",
  "purchase_location",
]);

export interface CollectionState {
  search: string;
  group: string;
  order: SortOrder;
}

export const DEFAULT_STATE: CollectionState = {
  search: "",
  group: DEFAULT_GROUP,
  order: DEFAULT_ORDER,
};

interface CollectionContentProps {
  records: VinylRecord[];
  state: CollectionState;
  /**
   * Omitted while the URL-backed state is still suspending, which is how the
   * prerendered HTML gets a real grid instead of a skeleton.
   */
  onChange?: (next: Partial<CollectionState>) => void;
  onClear?: () => void;
}

export function CollectionContent({ records, state, onChange, onClear }: CollectionContentProps) {
  const groups = useMemo(() => availableGroups(records), [records]);
  const group = resolveGroup(state.group, groups);
  const { search, order } = state;

  const collection = useMemo(() => buildCollection(records, { search, group, order }), [records, search, group, order]);
  const overall = useMemo(() => summarize(records), [records]);

  const showPurchase = PURCHASE_GROUPS.has(group);
  const isDefaultState = search === "" && group === DEFAULT_GROUP && order === DEFAULT_ORDER;
  const interactive = Boolean(onChange);

  const filters = (
    <FilterPanel
      search={search}
      onSearchChange={(value) => onChange?.({ search: value })}
      group={group}
      onGroupChange={(value) => onChange?.({ group: value })}
      groups={groups}
      order={order}
      onOrderChange={(value) => onChange?.({ order: value })}
      orderEnabled={interactive && collection.sortable}
      onClear={() => onClear?.()}
      canClear={interactive && !isDefaultState}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 lg:flex-row lg:gap-10 lg:px-8 lg:py-10">
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-10">{filters}</div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight">Records</h1>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <SlidersHorizontal aria-hidden />
                  filter
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filter &amp; options</SheetTitle>
                </SheetHeader>
                <div className="px-4 pb-8">{filters}</div>
              </SheetContent>
            </Sheet>
          </div>

          <p className="text-muted-foreground text-sm">
            {search
              ? `Found ${collection.matchCount} records for "${search}"`
              : `Totally ${formatCounts(overall)} and ${formatKrw(overall.totalKrw)}`}
          </p>
        </header>

        {collection.groups.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <div className="mt-8 flex flex-col gap-10">
            {collection.groups.map((entry) => (
              <section key={entry.name} className="flex flex-col gap-4">
                {group !== "none" && (
                  <div className="flex flex-col gap-1">
                    <Separator />
                    <h2 className="mt-3 text-xl font-semibold tracking-tight">{entry.name}</h2>
                    <p className="text-muted-foreground text-sm">{formatGroupSummary(summarize(entry.records))}</p>
                  </div>
                )}
                <RecordGrid records={entry.records} showPurchase={showPurchase} />
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="border-border text-muted-foreground mt-10 rounded-lg border border-dashed px-6 py-16 text-center text-sm">
      {search ? `No records found for "${search}"` : "No records found"}
    </div>
  );
}
