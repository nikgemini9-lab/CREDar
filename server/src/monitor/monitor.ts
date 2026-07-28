import { TweetFilter } from "rettiwt-api";
import { config } from "../config.js";
import { getMeta, insertTweet, setMeta, tweetExists, upsertAccount } from "../db/index.js";
import type { TweetRecord } from "../types.js";
import { classifyMatches } from "./match.js";
import { createRettiwtClient } from "./rettiwtClient.js";
import { demoFeed } from "./demoFeed.js";

export const LAST_SEEN_ID_KEY = "last_seen_tweet_id";
const RESTART_DELAY_MS = 15_000;
const SEARCH_PAGE_SIZE = 20; // rettiwt-api caps tweet.search()'s count at 20
const MAX_PAGES_PER_POLL = 50; // safety cap: 50 * 20 = 1000 tweets per poll/backfill

/** Structural subset of `rettiwt-api`'s `Tweet` used by CREDAR, also satisfied by the demo feed's synthetic tweets. */
export interface TweetLike {
  id: string;
  fullText: string;
  createdAt: string;
  url: string;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  viewCount?: number;
  tweetBy: {
    userName: string;
    fullName: string;
    id: string;
    followersCount: number;
    isVerified: boolean;
    profileImage?: string | null;
  };
}

export function toTweetRecord(tweet: TweetLike): TweetRecord {
  return {
    id: tweet.id,
    authorUsername: tweet.tweetBy.userName,
    authorName: tweet.tweetBy.fullName,
    authorId: tweet.tweetBy.id,
    authorFollowers: tweet.tweetBy.followersCount ?? 0,
    authorVerified: tweet.tweetBy.isVerified ?? false,
    authorProfileImage: tweet.tweetBy.profileImage ?? null,
    text: tweet.fullText,
    url: tweet.url,
    createdAt: new Date(tweet.createdAt).toISOString(),
    discoveredAt: new Date().toISOString(),
    likeCount: tweet.likeCount ?? 0,
    retweetCount: tweet.retweetCount ?? 0,
    replyCount: tweet.replyCount ?? 0,
    viewCount: tweet.viewCount ?? 0,
    matches: classifyMatches(tweet.fullText),
    sentiment: null,
  };
}

export type TweetHandler = (tweet: TweetRecord) => void | Promise<void>;

async function processTweet(raw: TweetLike, onTweet: TweetHandler, isDemo: boolean): Promise<void> {
  if (await tweetExists(raw.id)) return;

  const record = toTweetRecord(raw);
  await insertTweet(record, isDemo);
  await upsertAccount(record, isDemo);
  // Only advance the real Rettiwt cursor from live tweets - a demo tweet's id
  // isn't a valid Twitter snowflake id and would break the next live search.
  if (!isDemo) await setMeta(LAST_SEEN_ID_KEY, record.id);

  await onTweet(record);
}

async function runDemoLoop(onTweet: TweetHandler): Promise<void> {
  console.log("[monitor] RETTIWT_API_KEY not set - running in DEMO MODE with synthetic tweets");
  for await (const tweet of demoFeed()) {
    await processTweet(tweet, onTweet, true);
  }
}

/** A Twitter/X snowflake id is a plain numeric string - guards against a stale/demo value in `meta`. */
function isValidSinceId(value: string): boolean {
  return /^\d+$/.test(value);
}

/**
 * Runs one search pass: either a bounded backfill (no prior cursor - search
 * from `backfillDays` ago forward, paginating) or a steady-state poll (search
 * since the last seen tweet id, paginating in case a burst of mentions
 * arrived since the last poll). Returns the newest tweet id seen, if any, so
 * the caller can persist it as the cursor for next time.
 *
 * Built directly on `search()` rather than rettiwt-api's own `stream()`,
 * because `stream()` hardcodes `startDate: new Date()` at creation time and
 * discards any `sinceId`/`startDate` passed through its filter - it can only
 * ever see tweets posted after the process started, and our own resume
 * cursor was silently having no effect.
 */
async function pollOnce(
  rettiwt: ReturnType<typeof createRettiwtClient>,
  sinceId: string | undefined,
  onTweet: TweetHandler,
): Promise<string | undefined> {
  const isBackfill = !sinceId;
  const startDate = isBackfill ? new Date(Date.now() - config.backfillDays * 24 * 60 * 60 * 1000) : undefined;

  if (isBackfill) {
    console.log(`[monitor] no prior cursor - backfilling up to ${config.backfillDays} day(s) of mentions`);
  }

  let cursor: string | undefined;
  let newestId: string | undefined;
  let pages = 0;

  while (true) {
    const filter = new TweetFilter({
      optionalWords: config.searchTerms,
      ...(sinceId ? { sinceId } : {}),
      ...(startDate ? { startDate } : {}),
    });

    const result = await rettiwt.tweet.search(filter, SEARCH_PAGE_SIZE, cursor);
    pages += 1;

    for (const tweet of result.list) {
      await processTweet(tweet as unknown as TweetLike, onTweet, false);
    }

    if (newestId === undefined && result.list.length > 0) {
      newestId = (result.list[0] as unknown as TweetLike).id;
    }

    if (isBackfill && pages % 10 === 0) {
      console.log(`[monitor] backfill: ${pages} page(s) fetched so far`);
    }

    if (result.next && pages < MAX_PAGES_PER_POLL) {
      cursor = result.next;
      continue;
    }
    if (result.next) {
      console.warn(`[monitor] hit the ${MAX_PAGES_PER_POLL}-page safety cap with more results available - stopping here for this poll`);
    }
    break;
  }

  if (isBackfill) {
    console.log(`[monitor] backfill complete: ${pages} page(s), caught up to now`);
  }

  return newestId;
}

async function runLiveLoop(onTweet: TweetHandler): Promise<void> {
  const rettiwt = createRettiwtClient();

  console.log(`[monitor] polling tweets matching: ${config.searchTerms.join(" OR ")}`);

  while (true) {
    try {
      const storedSinceId = await getMeta(LAST_SEEN_ID_KEY);
      const sinceId = storedSinceId && isValidSinceId(storedSinceId) ? storedSinceId : undefined;
      if (storedSinceId && !sinceId) {
        console.warn(`[monitor] ignoring invalid stored since_id "${storedSinceId}" (likely left over from demo mode)`);
      }

      const newestId = await pollOnce(rettiwt, sinceId, onTweet);
      if (newestId) await setMeta(LAST_SEEN_ID_KEY, newestId);

      await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
    } catch (err) {
      console.error("[monitor] poll error, retrying shortly:", err);
      await new Promise((resolve) => setTimeout(resolve, RESTART_DELAY_MS));
    }
  }
}

export function startMonitor(onTweet: TweetHandler): void {
  const loop = config.demoMode ? runDemoLoop(onTweet) : runLiveLoop(onTweet);
  loop.catch((err) => {
    console.error("[monitor] fatal error, monitor loop stopped:", err);
  });
}
