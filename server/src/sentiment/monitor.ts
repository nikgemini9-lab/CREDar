import { config } from "../config.js";
import { getUnclassifiedTweets, setTweetSentiment } from "../db/index.js";
import type { Sentiment } from "../types.js";
import { classifySentiment } from "./classify.js";

// Gemini's free tier caps requests per minute in the low double digits (and
// this can change - check your Google AI Studio console for the current
// limit). One classification every 8s (~7.5/min) stays comfortably under
// that with room to spare, while still clearing a backlog of thousands of
// tweets per day.
const SWEEP_INTERVAL_MS = 8_000;
const BATCH_SIZE = 1;

export type SentimentHandler = (id: string, sentiment: Sentiment) => void;

async function sweepOnce(onSentiment: SentimentHandler): Promise<void> {
  const pending = await getUnclassifiedTweets(BATCH_SIZE);
  for (const tweet of pending) {
    const sentiment = await classifySentiment(tweet.text);
    if (!sentiment) continue;
    await setTweetSentiment(tweet.id, sentiment);
    onSentiment(tweet.id, sentiment);
  }
}

/**
 * Runs as a background sweep over already-stored tweets rather than
 * classifying inline as each tweet is ingested - this keeps historical
 * backfill fast and avoids bursting past the classifier API's rate limit.
 */
export function startSentimentMonitor(onSentiment: SentimentHandler): void {
  if (!config.geminiApiKey) {
    console.log("[sentiment] GEMINI_API_KEY not set - sentiment classification disabled");
    return;
  }

  const tick = () => {
    sweepOnce(onSentiment)
      .catch((err) => console.error("[sentiment] sweep failed:", err))
      .finally(() => setTimeout(tick, SWEEP_INTERVAL_MS));
  };
  tick();
}
