export type SegmentId = "us-tech" | "asia-tech" | "asia-financials";

export interface Segment {
  id: SegmentId;
  name: string;
  description: string;
}

export interface Company {
  ticker: string;
  slug: string;
  name: string;
  segmentId: SegmentId;
  exchange: string;
  yahooTicker?: string;
}
