const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

/** Formats a whole-won amount, e.g. `28000` -> `₩28,000`. */
export function formatKrw(amount: number): string {
  return KRW.format(amount);
}

/** Formats an amount in its original currency, e.g. `22.24` USD -> `$22.24`. */
export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("ko-KR", { style: "currency", currency }).format(amount);
  } catch {
    // unknown/invalid ISO code — fall back to a plain number with the code appended
    return `${amount.toLocaleString("ko-KR")} ${currency}`;
  }
}

/** `1 Album` / `2 Albums` — matches the pluralisation the Streamlit app used. */
export function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
