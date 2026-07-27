import type { TweetRecord } from "../types";
import { TweetCard } from "./TweetCard";

interface Props {
  tweets: TweetRecord[];
}

export function LiveFeed({ tweets }: Props) {
  return (
    <div className="panel">
      <h3 className="panel-title">Live feed</h3>
      <div className="feed-list">
        {tweets.length === 0 ? (
          <div className="empty-state">No mentions detected yet. Radar is sweeping…</div>
        ) : (
          tweets.map((tweet) => <TweetCard tweet={tweet} key={tweet.id} />)
        )}
      </div>
    </div>
  );
}
