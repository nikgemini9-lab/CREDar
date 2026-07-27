import type { TweetLike } from "./monitor.js";

const HANDLES = [
  "solana_sarah",
  "degen_dave",
  "cred_believer",
  "chainwatcher_99",
  "onchain_oli",
  "moonbag_mia",
  "cryptocasper",
  "pumpfun_pete",
];

const TEMPLATES = [
  "$CRED is quietly building while everyone's distracted. accumulating here.",
  "just aped into @crediblefin, the roadmap actually makes sense for once",
  "CA: CREDBHvVqREBCAxMihzr8D1nepHMr2gmQoZWpmgGmeta — do your own research but this chart is clean",
  "@crediblefin team just shipped another update, bullish on $CRED",
  "why is nobody talking about $CRED yet? volume creeping up",
  "added to my bags: CREDBHvVqREBCAxMihzr8D1nepHMr2gmQoZWpmgGmeta $CRED",
  "@crediblefin credibility score feature is actually genius for this market",
];

let counter = 0;

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomTweet(): TweetLike {
  counter += 1;
  const handle = randomFrom(HANDLES);
  const text = randomFrom(TEMPLATES);
  const id = `demo-${Date.now()}-${counter}`;

  return {
    id,
    fullText: text,
    createdAt: new Date().toUTCString(),
    url: `https://x.com/${handle}/status/${id}`,
    likeCount: Math.floor(Math.random() * 200),
    retweetCount: Math.floor(Math.random() * 60),
    replyCount: Math.floor(Math.random() * 30),
    viewCount: Math.floor(Math.random() * 5000),
    tweetBy: {
      userName: handle,
      fullName: handle
        .split("_")
        .map((s) => s[0]!.toUpperCase() + s.slice(1))
        .join(" "),
      id: `demo-user-${handle}`,
      followersCount: Math.floor(Math.random() * 20000),
      isVerified: Math.random() > 0.7,
      profileImage: null,
    },
  };
}

/** Emits a synthetic tweet every 8-20s so the dashboard/alerts can be exercised without real credentials. */
export async function* demoFeed(): AsyncGenerator<TweetLike> {
  while (true) {
    const delay = 8_000 + Math.random() * 12_000;
    await new Promise((resolve) => setTimeout(resolve, delay));
    yield randomTweet();
  }
}
