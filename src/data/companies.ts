import type { Company, SegmentId } from "./types";

export const companies: Company[] = [
  // US Tech
  { ticker: "NVDA US", slug: "nvda", name: "Nvidia", segmentId: "us-tech", exchange: "US", yahooTicker: "NVDA" },
  { ticker: "GOOGL US", slug: "googl", name: "Alphabet", segmentId: "us-tech", exchange: "US", yahooTicker: "GOOGL" },
  { ticker: "AAPL US", slug: "aapl", name: "Apple", segmentId: "us-tech", exchange: "US", yahooTicker: "AAPL" },
  { ticker: "MSFT US", slug: "msft", name: "Microsoft", segmentId: "us-tech", exchange: "US", yahooTicker: "MSFT" },
  { ticker: "AMZN US", slug: "amzn", name: "Amazon.com", segmentId: "us-tech", exchange: "US", yahooTicker: "AMZN" },

  // Asia Tech
  { ticker: "2330 TT", slug: "tsmc", name: "Taiwan Semiconductor Mfg", segmentId: "asia-tech", exchange: "TT", yahooTicker: "2330.TW" },
  { ticker: "005930 KS", slug: "samsung", name: "Samsung Electronics", segmentId: "asia-tech", exchange: "KS", yahooTicker: "005930.KS" },
  { ticker: "000660 KS", slug: "sk-hynix", name: "SK Hynix", segmentId: "asia-tech", exchange: "KS", yahooTicker: "000660.KS" },
  { ticker: "700 HK", slug: "tencent", name: "Tencent Holdings", segmentId: "asia-tech", exchange: "HK", yahooTicker: "0700.HK" },
  { ticker: "9988 HK", slug: "alibaba", name: "Alibaba Group", segmentId: "asia-tech", exchange: "HK", yahooTicker: "9988.HK" },

  // Asia Financials
  { ticker: "1398 HK", slug: "icbc", name: "Industrial & Commercial Bank of China", segmentId: "asia-financials", exchange: "HK", yahooTicker: "1398.HK" },
  { ticker: "5 HK", slug: "hsbc", name: "HSBC Holdings", segmentId: "asia-financials", exchange: "HK", yahooTicker: "0005.HK" },
  { ticker: "CBA AU", slug: "cba", name: "Commonwealth Bank of Australia", segmentId: "asia-financials", exchange: "AU", yahooTicker: "CBA.AX" },
  { ticker: "8306 JP", slug: "mufg", name: "Mitsubishi UFJ Financial Group", segmentId: "asia-financials", exchange: "JP", yahooTicker: "8306.T" },
  { ticker: "HDFCB IN", slug: "hdfc-bank", name: "HDFC Bank", segmentId: "asia-financials", exchange: "IN", yahooTicker: "HDFCBANK.NS" },
];

export function getCompanyBySlug(slug: string): Company | undefined {
  return companies.find((c) => c.slug === slug);
}

export function getCompaniesBySegment(segmentId: SegmentId): Company[] {
  return companies.filter((c) => c.segmentId === segmentId);
}
