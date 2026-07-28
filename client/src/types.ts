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
  tweetsLast7d: number;
  matchBreakdown: Record<MatchKind, number>;
  hourlyVolume: StatsBucket[];
  dailyVolume: StatsBucket[];
  topAccounts: AccountRecord[];
}

export interface CredarPublicConfig {
  demoMode: boolean;
  searchTerms: string[];
  cashtag: string;
  handle: string;
  contractAddress: string;
  telegramEnabled: boolean;
  chainDemoMode: boolean;
  bigBuyMinUsd: number;
}

export type SwapSide = "buy" | "sell";

export interface BigBuyRecord {
  txId: string;
  blockTime: string;
  discoveredAt: string;
  side: SwapSide;
  walletAddress: string;
  tokenAmount: number;
  counterSymbol: string;
  counterAddress: string;
  counterAmount: number;
  usdValue: number | null;
  platform: string[];
}
