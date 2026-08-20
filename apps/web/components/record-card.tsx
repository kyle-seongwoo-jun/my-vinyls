import Image from "next/image";
import { Disc3 } from "lucide-react";
import type { VinylRecord } from "@my-vinyls/discogs";

import { formatCurrency, formatKrw } from "@/lib/format";
import { purchasePriceKrw } from "@/lib/grouping";

interface RecordCardProps {
  record: VinylRecord;
  /** Purchase groupings show what the record cost and where it came from. */
  showPurchase?: boolean;
}

export function RecordCard({ record, showPurchase = false }: RecordCardProps) {
  const { cover, title, artist, year, format, url } = record;

  return (
    <article className="group flex flex-col gap-2">
      <CoverArt cover={cover} title={title} url={url} />

      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm leading-snug font-semibold text-pretty" title={title}>
          {title}
        </h3>
        <p className="text-muted-foreground text-xs">
          {[artist, year, format].filter(Boolean).join(" • ")}
        </p>
        {showPurchase && <PurchaseInfo record={record} />}
      </div>
    </article>
  );
}

function CoverArt({ cover, title, url }: { cover?: string; title: string; url?: string }) {
  const image = cover ? (
    <Image
      src={cover}
      alt={`${title} cover`}
      width={300}
      height={300}
      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 180px"
      className="aspect-square h-auto w-full rounded-lg object-cover transition-opacity group-hover:opacity-85"
    />
  ) : (
    <div className="bg-muted text-muted-foreground flex aspect-square w-full items-center justify-center rounded-lg">
      <Disc3 className="size-8" aria-hidden />
    </div>
  );

  if (!url) return image;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="focus-visible:ring-ring rounded-lg focus-visible:ring-[3px] focus-visible:outline-none"
      aria-label={`${title} on Discogs`}
    >
      {image}
    </a>
  );
}

function PurchaseInfo({ record }: { record: VinylRecord }) {
  const { purchase } = record;
  if (!purchase) return null;

  const krw = purchasePriceKrw(record);
  // show what was actually paid when it wasn't a KRW purchase
  const original =
    purchase.currency && purchase.currency !== "KRW" && purchase.price !== undefined
      ? formatCurrency(purchase.price, purchase.currency)
      : undefined;

  const where = [purchase.location, purchase.date].filter(Boolean).join(" • ");

  return (
    <div className="text-muted-foreground mt-0.5 flex flex-col gap-0.5 text-xs">
      {krw !== undefined && (
        <span>
          💵 {formatKrw(krw)}
          {original && <span className="opacity-70"> ({original})</span>}
        </span>
      )}
      {where && <span>🛒 {where}</span>}
    </div>
  );
}
