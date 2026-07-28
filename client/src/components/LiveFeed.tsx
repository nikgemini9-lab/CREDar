import { useState } from "react";
import type { TweetRecord } from "../types";
import { TweetCard } from "./TweetCard";

interface Props {
  tweets: TweetRecord[];
}

type SortOrder = "newest" | "oldest";

export function LiveFeed({ tweets }: Props) {
  const [order, setOrder] = useState<SortOrder>("newest");

  const sorted = [...tweets].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return order === "newest" ? -diff : diff;
  });

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="panel-title">Live feed</h3>
        <div className="sort-toggle">
          <button
            type="button"
            className={`sort-btn${order === "newest" ? " active" : ""}`}
            onClick={() => setOrder("newest")}
          >
            Newest first
          </button>
          <button
            type="button"
            className={`sort-btn${order === "oldest" ? " active" : ""}`}
            onClick={() => setOrder("oldest")}
          >
            Oldest first
          </button>
        </div>
      </div>
      <div className="feed-list">
        {sorted.length === 0 ? (
          <div className="empty-state">No mentions detected yet. Radar is sweeping…</div>
        ) : (
          sorted.map((tweet) => <TweetCard tweet={tweet} key={tweet.id} />)
        )}
      </div>
    </div>
  );
}
