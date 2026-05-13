const EXCHANGE_FLAGS: Record<string, string> = {
  US: "🇺🇸",
  TT: "🇹🇼",
  KS: "🇰🇷",
  HK: "🇭🇰",
  AU: "🇦🇺",
  JP: "🇯🇵",
  IN: "🇮🇳",
};

const EXCHANGE_COUNTRY: Record<string, string> = {
  US: "United States",
  TT: "Taiwan",
  KS: "Korea",
  HK: "Hong Kong",
  AU: "Australia",
  JP: "Japan",
  IN: "India",
};

export function flagForExchange(exchange: string): string {
  return EXCHANGE_FLAGS[exchange] ?? "🌐";
}

export function countryForExchange(exchange: string): string {
  return EXCHANGE_COUNTRY[exchange] ?? exchange;
}

export function formatDate(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}
