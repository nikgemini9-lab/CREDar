export type MatchKind = "cashtag" | "mention" | "contract" | "keyword";

export interface TweetRecord {
  id: string;
  authorUsername: string;
  authorName: string;
  authorId: string;
  authorFollowers: number;
  authorVerified: boolean;
  authorProfileImage: string | null;
  text: string;
  url: string;
  createdAt: string;
  discoveredAt: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  viewCount: number;
  matches: MatchKind[];
}

export interface AccountRecord {
  username: string;
  displayName: string;
  userId: string;
  followers: number;
  verified: boolean;
  profileImage: string | null;
  firstSeen: string;
  lastSeen: string;
  mentionCount: number;
}

export interface StatsBucket {
  bucketStart: string;
  count: number;
}

export interface Stats {
  totalTweets: number;
  totalAccounts: number;
  tweetsLastHour: number;
  tweetsLast24h: number;
  matchBreakdown: Record<MatchKind, number>;
  hourlyVolume: StatsBucket[];
  topAccounts: AccountRecord[];
}

export interface CredarConfig {
  port: number;
  databaseUrl: string;
  databaseAuthToken: string | undefined;
  rettiwtApiKey: string | undefined;
  demoMode: boolean;
  searchTerms: string[];
  contractAddress: string;
  cashtag: string;
  handle: string;
  pollIntervalMs: number;
  telegramBotToken: string | undefined;
  telegramChatId: string | undefined;
  corsOrigin: string;
}
