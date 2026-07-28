import type { MatchKind, TweetRecord } from "../types";

const BADGES: Record<MatchKind, { label: string; color: string }> = {
  cashtag: { label: "$CRED", color: "var(--series-cashtag)" },
  mention: { label: "@crediblefin", color: "var(--series-mention)" },
  contract: { label: "CA", color: "var(--series-contract)" },
  keyword: { label: "keyword", color: "var(--series-keyword)" },
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function TweetCard({ tweet }: { tweet: TweetRecord }) {
  return (
    <div className="tweet-card">
      <div className="tweet-head">
        <span className="tweet-author">
          <a href={tweet.url} target="_blank" rel="noreferrer">
            @{tweet.authorUsername}
          </a>
          {tweet.authorVerified ? " ✓" : ""}
        </span>
        <span className="tweet-time">{timeAgo(tweet.createdAt)}</span>
      </div>
      <p className="tweet-text">{tweet.text}</p>
      <div className="tweet-foot">
        <div className="tweet-metrics">
          <span>❤ {tweet.likeCount}</span>
          <span>↻ {tweet.retweetCount}</span>
          <span>💬 {tweet.replyCount}</span>
        </div>
        <div className="match-badges">
          {tweet.matches.map((m) => (
            <span key={m} className="match-badge" style={{ background: BADGES[m].color }}>
              {BADGES[m].label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
