import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { DEMO_TWEET_HANDLES } from "../monitor/demoFeed.js";
import { SENTIMENT_METER_WINDOWS, sentimentLabel, sentimentPoints } from "../sentiment/meter.js";
import type {
  AccountRecord,
  BigBuyRecord,
  MatchKind,
  Sentiment,
  SentimentBucket,
  SentimentMeter,
  Stats,
  StatsBucket,
  SwapSide,
  TweetRecord,
} from "../types.js";

// Local `file:` URLs need their parent directory to exist up front.
if (config.databaseUrl.startsWith("file:")) {
  const filePath = config.databaseUrl.slice("file:".length);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

const client = createClient({
  url: config.databaseUrl,
  authToken: config.databaseAuthToken,
});

async function addColumnIfMissing(table: string, column: string, definition: string): Promise<void> {
  try {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (err) {
    if (!String(err).includes("duplicate column")) throw err;
  }
}

export async function initDb(): Promise<void> {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS tweets (
      id TEXT PRIMARY KEY,
      author_username TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_followers INTEGER NOT NULL DEFAULT 0,
      author_verified INTEGER NOT NULL DEFAULT 0,
      author_profile_image TEXT,
      text TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      discovered_at TEXT NOT NULL,
      like_count INTEGER NOT NULL DEFAULT 0,
      retweet_count INTEGER NOT NULL DEFAULT 0,
      reply_count INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      matches TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tweets_discovered_at ON tweets(discovered_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tweets_author ON tweets(author_username);

    CREATE TABLE IF NOT EXISTS accounts (
      username TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      followers INTEGER NOT NULL DEFAULT 0,
      verified INTEGER NOT NULL DEFAULT 0,
      profile_image TEXT,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      mention_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS big_buys (
      tx_id TEXT PRIMARY KEY,
      block_time TEXT NOT NULL,
      discovered_at TEXT NOT NULL,
      side TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      token_amount REAL NOT NULL,
      counter_symbol TEXT NOT NULL,
      counter_address TEXT NOT NULL,
      counter_amount REAL NOT NULL,
      usd_value REAL,
      platform TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_big_buys_discovered_at ON big_buys(discovered_at DESC);
  `);

  // Added after the initial release - CREATE TABLE IF NOT EXISTS doesn't add
  // columns to tables that already exist, so backfill explicitly. This also
  // retroactively tags any demo rows written before this column existed
  // (demo tweets/swaps carry a recognizable id prefix; demo accounts are a
  // small fixed list), so a database that's been running in demo mode never
  // permanently mixes synthetic data in with real data once real credentials
  // are configured.
  await addColumnIfMissing("tweets", "is_demo", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("accounts", "is_demo", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("big_buys", "is_demo", "INTEGER NOT NULL DEFAULT 0");
  // Nullable: null means "not yet classified" (or ANTHROPIC_API_KEY isn't set).
  await addColumnIfMissing("tweets", "sentiment", "TEXT");

  await client.execute("UPDATE tweets SET is_demo = 1 WHERE id LIKE 'demo-%' AND is_demo = 0");
  await client.execute("UPDATE big_buys SET is_demo = 1 WHERE tx_id LIKE 'demo-swap-%' AND is_demo = 0");
  if (DEMO_TWEET_HANDLES.length > 0) {
    const placeholders = DEMO_TWEET_HANDLES.map(() => "?").join(", ");
    await client.execute({
      sql: `UPDATE accounts SET is_demo = 1 WHERE username IN (${placeholders}) AND is_demo = 0`,
      args: DEMO_TWEET_HANDLES,
    });
  }
}

function rowToTweet(row: Record<string, unknown>): TweetRecord {
  return {
    id: row.id as string,
    authorUsername: row.author_username as string,
    authorName: row.author_name as string,
    authorId: row.author_id as string,
    authorFollowers: row.author_followers as number,
    authorVerified: Boolean(row.author_verified),
    authorProfileImage: row.author_profile_image as string | null,
    text: row.text as string,
    url: row.url as string,
    createdAt: row.created_at as string,
    discoveredAt: row.discovered_at as string,
    likeCount: row.like_count as number,
    retweetCount: row.retweet_count as number,
    replyCount: row.reply_count as number,
    viewCount: row.view_count as number,
    matches: JSON.parse(row.matches as string) as MatchKind[],
    sentiment: (row.sentiment as Sentiment | null) ?? null,
  };
}

function rowToAccount(row: Record<string, unknown>): AccountRecord {
  return {
    username: row.username as string,
    displayName: row.display_name as string,
    userId: row.user_id as string,
    followers: row.followers as number,
    verified: Boolean(row.verified),
    profileImage: row.profile_image as string | null,
    firstSeen: row.first_seen as string,
    lastSeen: row.last_seen as string,
    mentionCount: row.mention_count as number,
  };
}

function rowToBigBuy(row: Record<string, unknown>): BigBuyRecord {
  return {
    txId: row.tx_id as string,
    blockTime: row.block_time as string,
    discoveredAt: row.discovered_at as string,
    side: row.side as SwapSide,
    walletAddress: row.wallet_address as string,
    tokenAmount: row.token_amount as number,
    counterSymbol: row.counter_symbol as string,
    counterAddress: row.counter_address as string,
    counterAmount: row.counter_amount as number,
    usdValue: (row.usd_value as number | null) ?? null,
    platform: JSON.parse(row.platform as string) as string[],
  };
}

export async function bigBuyExists(txId: string): Promise<boolean> {
  const rs = await client.execute({ sql: "SELECT 1 FROM big_buys WHERE tx_id = ?", args: [txId] });
  return rs.rows.length > 0;
}

export async function insertBigBuy(buy: BigBuyRecord, isDemo: boolean): Promise<void> {
  await client.execute({
    sql: `INSERT OR IGNORE INTO big_buys
      (tx_id, block_time, discovered_at, side, wallet_address, token_amount,
       counter_symbol, counter_address, counter_amount, usd_value, platform, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      buy.txId,
      buy.blockTime,
      buy.discoveredAt,
      buy.side,
      buy.walletAddress,
      buy.tokenAmount,
      buy.counterSymbol,
      buy.counterAddress,
      buy.counterAmount,
      buy.usdValue,
      JSON.stringify(buy.platform),
      isDemo ? 1 : 0,
    ],
  });
}

export async function getRecentBigBuys(limit = 50, isDemo = config.chainDemoMode): Promise<BigBuyRecord[]> {
  const rs = await client.execute({
    sql: "SELECT * FROM big_buys WHERE is_demo = ? ORDER BY discovered_at DESC LIMIT ?",
    args: [isDemo ? 1 : 0, limit],
  });
  return rs.rows.map((row) => rowToBigBuy(row as unknown as Record<string, unknown>));
}

export async function tweetExists(id: string): Promise<boolean> {
  const rs = await client.execute({ sql: "SELECT 1 FROM tweets WHERE id = ?", args: [id] });
  return rs.rows.length > 0;
}

export async function insertTweet(tweet: TweetRecord, isDemo: boolean): Promise<void> {
  await client.execute({
    sql: `INSERT OR IGNORE INTO tweets
      (id, author_username, author_name, author_id, author_followers, author_verified,
       author_profile_image, text, url, created_at, discovered_at,
       like_count, retweet_count, reply_count, view_count, matches, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      tweet.id,
      tweet.authorUsername,
      tweet.authorName,
      tweet.authorId,
      tweet.authorFollowers,
      tweet.authorVerified ? 1 : 0,
      tweet.authorProfileImage,
      tweet.text,
      tweet.url,
      tweet.createdAt,
      tweet.discoveredAt,
      tweet.likeCount,
      tweet.retweetCount,
      tweet.replyCount,
      tweet.viewCount,
      JSON.stringify(tweet.matches),
      isDemo ? 1 : 0,
    ],
  });
}

// Demo tweets are excluded so classifying synthetic data never burns API
// cost. Candidates are also bounded to the most recent
// config.sentimentWindowSize real tweets overall - free-tier classifier
// quotas can be too low to ever work through a full backlog, so anything
// older than that rolling window is intentionally left unclassified rather
// than endlessly queued.
export async function getUnclassifiedTweets(limit = 5): Promise<{ id: string; text: string }[]> {
  const rs = await client.execute({
    sql: `SELECT id, text FROM (
            SELECT id, text, sentiment, discovered_at FROM tweets WHERE is_demo = 0
            ORDER BY discovered_at DESC LIMIT ?
          ) WHERE sentiment IS NULL
          LIMIT ?`,
    args: [config.sentimentWindowSize, limit],
  });
  return rs.rows.map((row) => ({ id: row.id as string, text: row.text as string }));
}

export async function setTweetSentiment(id: string, sentiment: Sentiment): Promise<void> {
  await client.execute({
    sql: "UPDATE tweets SET sentiment = ? WHERE id = ?",
    args: [sentiment, id],
  });
}

export interface SentimentProgress {
  totalRealTweets: number;
  /** Size of the rolling "most recent" window actually considered for classification (config.sentimentWindowSize). */
  windowSize: number;
  classifiedInWindow: number;
  pendingInWindow: number;
}

export async function getSentimentProgress(): Promise<SentimentProgress> {
  const [totalRs, windowRs] = await Promise.all([
    client.execute({ sql: "SELECT COUNT(*) as c FROM tweets WHERE is_demo = 0", args: [] }),
    client.execute({
      sql: "SELECT sentiment FROM tweets WHERE is_demo = 0 ORDER BY discovered_at DESC LIMIT ?",
      args: [config.sentimentWindowSize],
    }),
  ]);
  const totalRealTweets = Number(totalRs.rows[0]?.c ?? 0);
  const classifiedInWindow = windowRs.rows.filter((row) => row.sentiment !== null).length;
  return {
    totalRealTweets,
    windowSize: config.sentimentWindowSize,
    classifiedInWindow,
    pendingInWindow: windowRs.rows.length - classifiedInWindow,
  };
}

export async function upsertAccount(tweet: TweetRecord, isDemo: boolean): Promise<void> {
  const existing = await client.execute({
    sql: "SELECT 1 FROM accounts WHERE username = ?",
    args: [tweet.authorUsername],
  });

  if (existing.rows.length > 0) {
    await client.execute({
      sql: `UPDATE accounts SET display_name = ?, user_id = ?, followers = ?, verified = ?,
        profile_image = ?, last_seen = ?, mention_count = mention_count + 1
       WHERE username = ?`,
      args: [
        tweet.authorName,
        tweet.authorId,
        tweet.authorFollowers,
        tweet.authorVerified ? 1 : 0,
        tweet.authorProfileImage,
        tweet.discoveredAt,
        tweet.authorUsername,
      ],
    });
  } else {
    await client.execute({
      sql: `INSERT INTO accounts
        (username, display_name, user_id, followers, verified, profile_image, first_seen, last_seen, mention_count, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      args: [
        tweet.authorUsername,
        tweet.authorName,
        tweet.authorId,
        tweet.authorFollowers,
        tweet.authorVerified ? 1 : 0,
        tweet.authorProfileImage,
        tweet.discoveredAt,
        tweet.discoveredAt,
        isDemo ? 1 : 0,
      ],
    });
  }
}

export async function getRecentTweets(limit = 50, isDemo = config.demoMode): Promise<TweetRecord[]> {
  const rs = await client.execute({
    sql: "SELECT * FROM tweets WHERE is_demo = ? ORDER BY discovered_at DESC LIMIT ?",
    args: [isDemo ? 1 : 0, limit],
  });
  return rs.rows.map((row) => rowToTweet(row as unknown as Record<string, unknown>));
}

export async function getTopAccounts(limit = 20, isDemo = config.demoMode): Promise<AccountRecord[]> {
  const rs = await client.execute({
    sql: "SELECT * FROM accounts WHERE is_demo = ? ORDER BY mention_count DESC, last_seen DESC LIMIT ?",
    args: [isDemo ? 1 : 0, limit],
  });
  return rs.rows.map((row) => rowToAccount(row as unknown as Record<string, unknown>));
}

export async function getStats(): Promise<Stats> {
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const isDemo = config.demoMode ? 1 : 0;

  // All "when did this happen" figures use created_at (when the tweet was
  // actually posted), not discovered_at (when CREDAR found it) - otherwise a
  // backfill run stamps a week of history as having all happened "now".
  const [totalTweetsRs, totalAccountsRs, tweetsLastHourRs, tweetsLast24hRs, tweetsLast7dRs, recentTweetsRs, topAccounts] =
    await Promise.all([
      client.execute({ sql: "SELECT COUNT(*) as c FROM tweets WHERE is_demo = ?", args: [isDemo] }),
      client.execute({ sql: "SELECT COUNT(*) as c FROM accounts WHERE is_demo = ?", args: [isDemo] }),
      client.execute({
        sql: "SELECT COUNT(*) as c FROM tweets WHERE is_demo = ? AND created_at >= ?",
        args: [isDemo, oneHourAgo],
      }),
      client.execute({
        sql: "SELECT COUNT(*) as c FROM tweets WHERE is_demo = ? AND created_at >= ?",
        args: [isDemo, oneDayAgo],
      }),
      client.execute({
        sql: "SELECT COUNT(*) as c FROM tweets WHERE is_demo = ? AND created_at >= ?",
        args: [isDemo, sevenDaysAgo],
      }),
      // matchBreakdown/sentimentBreakdown cover the same 7-day window the
      // charts show, so they don't count mentions older than either graph
      // can display.
      client.execute({
        sql: "SELECT matches, created_at, sentiment FROM tweets WHERE is_demo = ? AND created_at >= ?",
        args: [isDemo, sevenDaysAgo],
      }),
      getTopAccounts(5),
    ]);

  const matchBreakdown: Record<MatchKind, number> = {
    cashtag: 0,
    mention: 0,
    contract: 0,
    keyword: 0,
  };
  const sentimentBreakdown: Record<Sentiment, number> = {
    bullish: 0,
    positive: 0,
    negative: 0,
    fud: 0,
  };

  const hourlyBucketMap = new Map<string, number>();
  const dailyBucketMap = new Map<string, number>();
  const dailySentimentMap = new Map<string, Record<Sentiment, number>>();
  const meterAccum = new Map<string, { sum: number; count: number }>();
  for (const w of SENTIMENT_METER_WINDOWS) meterAccum.set(w.key, { sum: 0, count: 0 });

  for (const row of recentTweetsRs.rows) {
    const matches = JSON.parse(row.matches as string) as MatchKind[];
    for (const m of matches) matchBreakdown[m] += 1;

    const sentiment = row.sentiment as Sentiment | null;
    if (sentiment) sentimentBreakdown[sentiment] += 1;

    const createdAt = new Date(row.created_at as string);

    const hourBucket = new Date(createdAt);
    hourBucket.setMinutes(0, 0, 0);
    const hourKey = hourBucket.toISOString();
    hourlyBucketMap.set(hourKey, (hourlyBucketMap.get(hourKey) ?? 0) + 1);

    const dayBucket = new Date(createdAt);
    dayBucket.setHours(0, 0, 0, 0);
    const dayKey = dayBucket.toISOString();
    dailyBucketMap.set(dayKey, (dailyBucketMap.get(dayKey) ?? 0) + 1);

    if (sentiment) {
      if (!dailySentimentMap.has(dayKey)) {
        dailySentimentMap.set(dayKey, { bullish: 0, positive: 0, negative: 0, fud: 0 });
      }
      dailySentimentMap.get(dayKey)![sentiment] += 1;

      const ageMs = now - createdAt.getTime();
      for (const w of SENTIMENT_METER_WINDOWS) {
        if (ageMs > w.ms) continue;
        const acc = meterAccum.get(w.key)!;
        acc.sum += sentimentPoints(sentiment);
        acc.count += 1;
      }
    }
  }

  const sentimentMeters: SentimentMeter[] = SENTIMENT_METER_WINDOWS.map((w) => {
    const acc = meterAccum.get(w.key)!;
    const score = acc.count > 0 ? Math.round(acc.sum / acc.count) : null;
    return {
      window: w.key,
      score,
      label: score !== null ? sentimentLabel(score) : "No data yet",
      sampleSize: acc.count,
    };
  });

  const hourlyVolume: StatsBucket[] = [];
  for (let i = 23; i >= 0; i--) {
    const bucket = new Date(now - i * 60 * 60 * 1000);
    bucket.setMinutes(0, 0, 0);
    const key = bucket.toISOString();
    hourlyVolume.push({ bucketStart: key, count: hourlyBucketMap.get(key) ?? 0 });
  }

  const dailyVolume: StatsBucket[] = [];
  const dailySentiment: SentimentBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const bucket = new Date(now - i * 24 * 60 * 60 * 1000);
    bucket.setHours(0, 0, 0, 0);
    const key = bucket.toISOString();
    dailyVolume.push({ bucketStart: key, count: dailyBucketMap.get(key) ?? 0 });
    const s = dailySentimentMap.get(key);
    dailySentiment.push({
      bucketStart: key,
      bullish: s?.bullish ?? 0,
      positive: s?.positive ?? 0,
      negative: s?.negative ?? 0,
      fud: s?.fud ?? 0,
    });
  }

  return {
    totalTweets: Number(totalTweetsRs.rows[0]?.c ?? 0),
    totalAccounts: Number(totalAccountsRs.rows[0]?.c ?? 0),
    tweetsLastHour: Number(tweetsLastHourRs.rows[0]?.c ?? 0),
    tweetsLast24h: Number(tweetsLast24hRs.rows[0]?.c ?? 0),
    tweetsLast7d: Number(tweetsLast7dRs.rows[0]?.c ?? 0),
    matchBreakdown,
    hourlyVolume,
    dailyVolume,
    sentimentBreakdown,
    dailySentiment,
    sentimentMeters,
    topAccounts,
  };
}

export async function getMeta(key: string): Promise<string | undefined> {
  const rs = await client.execute({ sql: "SELECT value FROM meta WHERE key = ?", args: [key] });
  return rs.rows[0]?.value as string | undefined;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await client.execute({
    sql: "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [key, value],
  });
}

export async function clearMeta(key: string): Promise<void> {
  await client.execute({ sql: "DELETE FROM meta WHERE key = ?", args: [key] });
}
