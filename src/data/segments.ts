import type { Segment } from "./types";

export const segments: Segment[] = [
  {
    id: "us-tech",
    name: "US Tech",
    description: "Mega-cap US technology companies",
  },
  {
    id: "asia-tech",
    name: "Asia Tech",
    description: "Asian semiconductors and internet platforms",
  },
  {
    id: "asia-financials",
    name: "Asia Financials",
    description: "Asia-Pacific banking and financial services",
  },
];

export function getSegmentById(id: string): Segment | undefined {
  return segments.find((s) => s.id === id);
}
