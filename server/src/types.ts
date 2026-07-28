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

export type SwapSide = "buy" | "sell";

export interface BigBuyRecord {
  /** Solscan transaction signature. */
  txId: string;
  blockTime: string;
  discoveredAt: string;
  side: SwapSide;
  walletAddress: string;
  /** Human-readable amount of $CRED that changed hands. */
  tokenAmount: number;
  /** The asset paid with (buy) or received (sell) on the other side of the swap. */
  counterSymbol: string;
  counterAddress: string;
  counterAmount: number;
  /** USD value of the swap, when the counter asset is a priceable reference asset (SOL/USDC/USDT). Null otherwise. */
  usdValue: number | null;
  platform: string[];
}

export interface Stats {
  totalTweets: number;
  totalAccounts: number;
  tweetsLastHour: number;
  tweetsLast24h: number;
  tweetsLast7d: number;
  matchBreakdown: Record<MatchKind, number>;
  hourlyVolume: StatsBucket[];
  dailyVolume: StatsBucket[];
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
  backfillDays: number;
  telegramBotToken: string | undefined;
  telegramChatId: string | undefined;
  corsOrigin: string;
  heliusWebhookAuthHeader: string | undefined;
  chainDemoMode: boolean;
  bigBuyMinUsd: number;
  bigBuyMinTokens: number;
  adminToken: string | undefined;
}
