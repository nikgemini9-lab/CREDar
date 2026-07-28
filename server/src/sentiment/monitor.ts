import { config } from "../config.js";
import { getUnclassifiedTweets, setTweetSentiment } from "../db/index.js";
import type { Sentiment } from "../types.js";
import { classifySentiment } from "./classify.js";

const SWEEP_INTERVAL_MS = 5_000;
const BATCH_SIZE = 5;

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
 * backfill fast and avoids spiking API cost on bursts of mentions.
 */
export function startSentimentMonitor(onSentiment: SentimentHandler): void {
  if (!config.anthropicApiKey) {
    console.log("[sentiment] ANTHROPIC_API_KEY not set - sentiment classification disabled");
    return;
  }

  const tick = () => {
    sweepOnce(onSentiment)
      .catch((err) => console.error("[sentiment] sweep failed:", err))
      .finally(() => setTimeout(tick, SWEEP_INTERVAL_MS));
  };
  tick();
}
