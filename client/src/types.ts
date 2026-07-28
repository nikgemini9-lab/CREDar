export type MatchKind = "cashtag" | "mention" | "contract" | "keyword";

export type Sentiment = "bullish" | "positive" | "negative" | "fud";

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
  sentiment: Sentiment | null;
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

export interface SentimentBucket {
  bucketStart: string;
  bullish: number;
  positive: number;
  negative: number;
  fud: number;
}

export type SentimentMeterWindow = "24h" | "3d" | "7d";

export interface SentimentMeter {
  window: SentimentMeterWindow;
  score: number | null;
  label: string;
  sampleSize: number;
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
  sentimentBreakdown: Record<Sentiment, number>;
  dailySentiment: SentimentBucket[];
  sentimentMeters: SentimentMeter[];
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
  sentimentEnabled: boolean;
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
  isTopHolder: boolean;
}

export interface TopHolder {
  walletAddress: string;
  tokenAmount: number;
  rank: number;
  updatedAt: string;
}
