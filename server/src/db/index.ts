import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import type { AccountRecord, MatchKind, Stats, StatsBucket, TweetRecord } from "../types.js";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new DatabaseSync(config.dbPath);

db.exec(`
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
`);

function rowToTweet(row: any): TweetRecord {
  return {
    id: row.id,
    authorUsername: row.author_username,
    authorName: row.author_name,
    authorId: row.author_id,
    authorFollowers: row.author_followers,
    authorVerified: Boolean(row.author_verified),
    authorProfileImage: row.author_profile_image,
    text: row.text,
    url: row.url,
    createdAt: row.created_at,
    discoveredAt: row.discovered_at,
    likeCount: row.like_count,
    retweetCount: row.retweet_count,
    replyCount: row.reply_count,
    viewCount: row.view_count,
    matches: JSON.parse(row.matches) as MatchKind[],
  };
}

function rowToAccount(row: any): AccountRecord {
  return {
    username: row.username,
    displayName: row.display_name,
    userId: row.user_id,
    followers: row.followers,
    verified: Boolean(row.verified),
    profileImage: row.profile_image,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    mentionCount: row.mention_count,
  };
}

export function tweetExists(id: string): boolean {
  const row = db.prepare("SELECT 1 FROM tweets WHERE id = ?").get(id);
  return row !== undefined;
}

export function insertTweet(tweet: TweetRecord): void {
  db.prepare(
    `INSERT OR IGNORE INTO tweets
      (id, author_username, author_name, author_id, author_followers, author_verified,
       author_profile_image, text, url, created_at, discovered_at,
       like_count, retweet_count, reply_count, view_count, matches)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
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
  );
}

export function upsertAccount(tweet: TweetRecord): void {
  const existing = db.prepare("SELECT * FROM accounts WHERE username = ?").get(tweet.authorUsername);

  if (existing) {
    db.prepare(
      `UPDATE accounts SET display_name = ?, user_id = ?, followers = ?, verified = ?,
        profile_image = ?, last_seen = ?, mention_count = mention_count + 1
       WHERE username = ?`,
    ).run(
      tweet.authorName,
      tweet.authorId,
      tweet.authorFollowers,
      tweet.authorVerified ? 1 : 0,
      tweet.authorProfileImage,
      tweet.discoveredAt,
      tweet.authorUsername,
    );
  } else {
    db.prepare(
      `INSERT INTO accounts
        (username, display_name, user_id, followers, verified, profile_image, first_seen, last_seen, mention_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    ).run(
      tweet.authorUsername,
      tweet.authorName,
      tweet.authorId,
      tweet.authorFollowers,
      tweet.authorVerified ? 1 : 0,
      tweet.authorProfileImage,
      tweet.discoveredAt,
      tweet.discoveredAt,
    );
  }
}

export function getRecentTweets(limit = 50): TweetRecord[] {
  const rows = db
    .prepare("SELECT * FROM tweets ORDER BY discovered_at DESC LIMIT ?")
    .all(limit);
  return rows.map(rowToTweet);
}

export function getTopAccounts(limit = 20): AccountRecord[] {
  const rows = db
    .prepare("SELECT * FROM accounts ORDER BY mention_count DESC, last_seen DESC LIMIT ?")
    .all(limit);
  return rows.map(rowToAccount);
}

export function getStats(): Stats {
  const totalTweets = (db.prepare("SELECT COUNT(*) as c FROM tweets").get() as any).c as number;
  const totalAccounts = (db.prepare("SELECT COUNT(*) as c FROM accounts").get() as any).c as number;

  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const tweetsLastHour = (
    db.prepare("SELECT COUNT(*) as c FROM tweets WHERE discovered_at >= ?").get(oneHourAgo) as any
  ).c as number;
  const tweetsLast24h = (
    db.prepare("SELECT COUNT(*) as c FROM tweets WHERE discovered_at >= ?").get(oneDayAgo) as any
  ).c as number;

  const allTweets = db.prepare("SELECT matches, discovered_at FROM tweets").all() as any[];

  const matchBreakdown: Record<MatchKind, number> = {
    cashtag: 0,
    mention: 0,
    contract: 0,
    keyword: 0,
  };

  const bucketMap = new Map<string, number>();
  for (const row of allTweets) {
    const matches = JSON.parse(row.matches) as MatchKind[];
    for (const m of matches) matchBreakdown[m] += 1;

    const bucket = new Date(row.discovered_at);
    bucket.setMinutes(0, 0, 0);
    const key = bucket.toISOString();
    bucketMap.set(key, (bucketMap.get(key) ?? 0) + 1);
  }

  const hourlyVolume: StatsBucket[] = [];
  for (let i = 23; i >= 0; i--) {
    const bucket = new Date(now - i * 60 * 60 * 1000);
    bucket.setMinutes(0, 0, 0);
    const key = bucket.toISOString();
    hourlyVolume.push({ bucketStart: key, count: bucketMap.get(key) ?? 0 });
  }

  return {
    totalTweets,
    totalAccounts,
    tweetsLastHour,
    tweetsLast24h,
    matchBreakdown,
    hourlyVolume,
    topAccounts: getTopAccounts(5),
  };
}

export function getMeta(key: string): string | undefined {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as any;
  return row?.value;
}

export function setMeta(key: string, value: string): void {
  db.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}
