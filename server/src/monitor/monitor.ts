import { TweetFilter } from "rettiwt-api";
import { config } from "../config.js";
import { getMeta, insertTweet, setMeta, tweetExists, upsertAccount } from "../db/index.js";
import type { TweetRecord } from "../types.js";
import { classifyMatches } from "./match.js";
import { createRettiwtClient } from "./rettiwtClient.js";
import { demoFeed } from "./demoFeed.js";

const LAST_SEEN_ID_KEY = "last_seen_tweet_id";
const RESTART_DELAY_MS = 15_000;

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

async function runLiveLoop(onTweet: TweetHandler): Promise<void> {
  const rettiwt = createRettiwtClient();

  while (true) {
    try {
      const storedSinceId = await getMeta(LAST_SEEN_ID_KEY);
      const sinceId = storedSinceId && isValidSinceId(storedSinceId) ? storedSinceId : undefined;
      if (storedSinceId && !sinceId) {
        console.warn(`[monitor] ignoring invalid stored since_id "${storedSinceId}" (likely left over from demo mode)`);
      }
      const filter = new TweetFilter({
        optionalWords: config.searchTerms,
        ...(sinceId ? { sinceId } : {}),
      });

      console.log(
        `[monitor] streaming tweets matching: ${config.searchTerms.join(" OR ")}` +
          (sinceId ? ` (since ${sinceId})` : ""),
      );

      for await (const tweet of rettiwt.tweet.stream(filter, config.pollIntervalMs)) {
        await processTweet(tweet as unknown as TweetLike, onTweet, false);
      }
    } catch (err) {
      console.error("[monitor] stream error, restarting shortly:", err);
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
