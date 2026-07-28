import type { Sentiment, SentimentMeterWindow } from "../types.js";

// Maps each category onto a 0-100 spectrum so a window's classified tweets
// can be averaged into a single gauge score, the same way a "Fear & Greed"
// style index works.
const SENTIMENT_POINTS: Record<Sentiment, number> = {
  fud: 0,
  negative: 33,
  positive: 66,
  bullish: 100,
};

// Band widths mirror the classic Fear & Greed Index shape (a wide "neutral"
// middle band, narrower bands at the extremes).
const BANDS: [max: number, label: string][] = [
  [24, "FUD Heavy"],
  [44, "Bearish"],
  [55, "Mixed"],
  [75, "Bullish"],
  [100, "Very Bullish"],
];

export function sentimentPoints(sentiment: Sentiment): number {
  return SENTIMENT_POINTS[sentiment];
}

export function sentimentLabel(score: number): string {
  for (const [max, label] of BANDS) {
    if (score <= max) return label;
  }
  return "Very Bullish";
}

export const SENTIMENT_METER_WINDOWS: { key: SentimentMeterWindow; ms: number }[] = [
  { key: "24h", ms: 24 * 60 * 60 * 1000 },
  { key: "3d", ms: 3 * 24 * 60 * 60 * 1000 },
  { key: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
];
