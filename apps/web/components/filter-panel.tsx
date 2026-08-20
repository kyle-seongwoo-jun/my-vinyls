"use client";

import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { GROUP_LABELS, type GroupKey, type SortOrder } from "@/lib/grouping";

const ORDERS: SortOrder[] = ["ascending", "descending"];

interface FilterPanelProps {
  /**
   * Namespaces this instance's control ids. The desktop panel stays mounted
   * (CSS-hidden) while the mobile sheet is open, so without a prefix both
   * instances would share ids and a sheet label would resolve to the hidden
   * desktop control that comes first in the document.
   */
  idPrefix: string;
  search: string;
  onSearchChange: (value: string) => void;
  group: GroupKey;
  onGroupChange: (value: GroupKey) => void;
  groups: readonly GroupKey[];
  order: SortOrder;
  onOrderChange: (value: SortOrder) => void;
  orderEnabled: boolean;
  onClear: () => void;
  canClear: boolean;
}

export function FilterPanel({
  idPrefix,
  search,
  onSearchChange,
  group,
  onGroupChange,
  groups,
  order,
  onOrderChange,
  orderEnabled,
  onClear,
  canClear,
}: FilterPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-search`} className="text-muted-foreground text-xs tracking-wide uppercase">
          filter
        </Label>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
          <Input
            id={`${idPrefix}-search`}
            type="search"
            value={search}
            placeholder="search"
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9"
          />
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <span className="text-muted-foreground text-xs tracking-wide uppercase">group by</span>
        <RadioGroup value={group} onValueChange={(value) => onGroupChange(value as GroupKey)} className="gap-2.5">
          {groups.map((key) => (
            <div key={key} className="flex items-center gap-2.5">
              <RadioGroupItem value={key} id={`${idPrefix}-group-${key}`} />
              <Label htmlFor={`${idPrefix}-group-${key}`} className="cursor-pointer text-sm font-normal">
                {GROUP_LABELS[key]}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </section>

      <section className="flex flex-col gap-3">
        <span className="text-muted-foreground text-xs tracking-wide uppercase">order</span>
        <div className="bg-muted inline-flex rounded-md p-0.5" role="group">
          {ORDERS.map((value) => (
            <button
              key={value}
              type="button"
              disabled={!orderEnabled}
              aria-pressed={order === value}
              onClick={() => onOrderChange(value)}
              className={[
                "flex-1 rounded-[5px] px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                "disabled:pointer-events-none disabled:opacity-50",
                order === value ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {value}
            </button>
          ))}
        </div>
      </section>

      <Separator />

      <Button variant="outline" size="sm" onClick={onClear} disabled={!canClear} className="justify-start">
        <X aria-hidden />
        clear filter and options
      </Button>
    </div>
  );
}
