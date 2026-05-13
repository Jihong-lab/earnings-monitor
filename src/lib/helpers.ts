const EXCHANGE_FLAGS: Record<string, string> = {
  US: "🇺🇸",
  TT: "🇹🇼",
  KS: "🇰🇷",
  HK: "🇭🇰",
  AU: "🇦🇺",
  JP: "🇯🇵",
  IN: "🇮🇳",
};

export function flagForExchange(exchange: string): string {
  return EXCHANGE_FLAGS[exchange] ?? "🌐";
}

export function formatDate(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}
