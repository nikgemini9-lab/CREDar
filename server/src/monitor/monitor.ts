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

async function processTweet(raw: TweetLike, onTweet: TweetHandler): Promise<void> {
  if (tweetExists(raw.id)) return;

  const record = toTweetRecord(raw);
  insertTweet(record);
  upsertAccount(record);
  setMeta(LAST_SEEN_ID_KEY, record.id);

  await onTweet(record);
}

async function runDemoLoop(onTweet: TweetHandler): Promise<void> {
  console.log("[monitor] RETTIWT_API_KEY not set - running in DEMO MODE with synthetic tweets");
  for await (const tweet of demoFeed()) {
    await processTweet(tweet, onTweet);
  }
}

async function runLiveLoop(onTweet: TweetHandler): Promise<void> {
  const rettiwt = createRettiwtClient();

  while (true) {
    try {
      const sinceId = getMeta(LAST_SEEN_ID_KEY);
      const filter = new TweetFilter({
        optionalWords: config.searchTerms,
        ...(sinceId ? { sinceId } : {}),
      });

      console.log(
        `[monitor] streaming tweets matching: ${config.searchTerms.join(" OR ")}` +
          (sinceId ? ` (since ${sinceId})` : ""),
      );

      for await (const tweet of rettiwt.tweet.stream(filter, config.pollIntervalMs)) {
        await processTweet(tweet as unknown as TweetLike, onTweet);
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
