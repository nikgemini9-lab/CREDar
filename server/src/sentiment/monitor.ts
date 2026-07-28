import { config } from "../config.js";
import { getUnclassifiedTweets, setTweetSentiment } from "../db/index.js";
import type { Sentiment } from "../types.js";
import { classifySentiment, getLastClassifyError } from "./classify.js";

// Gemini's actual free-tier daily quota varies by account/project and can be
// far lower than public docs suggest (some accounts see as little as 20
// requests/day for gemini-2.5-flash-lite) - check GET
// /api/admin/sentiment-debug for what your account is really allowed. One
// classification every 8s is fine for a per-minute limit, but useless
// against a daily cap, hence the exponential backoff below: once we hit a
// quota error, retrying every 8s would just burn through tomorrow's quota
// today on guaranteed-to-fail attempts.
const SWEEP_INTERVAL_MS = 8_000;
const MAX_BACKOFF_MS = 30 * 60_000;
const BATCH_SIZE = 1;

export type SentimentHandler = (id: string, sentiment: Sentiment) => void;

function isQuotaError(message: string): boolean {
  return /RESOURCE_EXHAUSTED|quota/i.test(message);
}

/** Returns true if a quota error was hit, so the caller can back off. */
async function sweepOnce(onSentiment: SentimentHandler): Promise<boolean> {
  const pending = await getUnclassifiedTweets(BATCH_SIZE);
  for (const tweet of pending) {
    const sentiment = await classifySentiment(tweet.text);
    if (!sentiment) {
      const err = getLastClassifyError();
      if (err && isQuotaError(err.message)) return true;
      continue;
    }
    await setTweetSentiment(tweet.id, sentiment);
    onSentiment(tweet.id, sentiment);
  }
  return false;
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

  let consecutiveQuotaHits = 0;

  const tick = () => {
    sweepOnce(onSentiment)
      .then((hitQuota) => {
        if (!hitQuota) {
          consecutiveQuotaHits = 0;
          setTimeout(tick, SWEEP_INTERVAL_MS);
          return;
        }
        consecutiveQuotaHits += 1;
        const backoffMs = Math.min(SWEEP_INTERVAL_MS * 2 ** consecutiveQuotaHits, MAX_BACKOFF_MS);
        console.log(`[sentiment] Gemini quota exhausted - backing off ${Math.round(backoffMs / 60_000)}m`);
        setTimeout(tick, backoffMs);
      })
      .catch((err) => {
        console.error("[sentiment] sweep failed:", err);
        setTimeout(tick, SWEEP_INTERVAL_MS);
      });
  };
  tick();
}
