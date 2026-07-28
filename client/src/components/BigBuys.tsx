import type { BigBuyRecord } from "../types";

interface Props {
  buys: BigBuyRecord[];
}

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatSize(buy: BigBuyRecord): string {
  if (buy.usdValue !== null) {
    return `$${buy.usdValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  return `${buy.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} $CRED`;
}

export function BigBuys({ buys }: Props) {
  return (
    <div className="panel">
      <h3 className="panel-title">Big buys on-chain</h3>
      <div className="feed-list">
        {buys.length === 0 ? (
          <div className="empty-state">No big buys detected yet.</div>
        ) : (
          buys.map((buy) => (
            <div className="tweet-card" key={buy.txId}>
              <div className="tweet-head">
                <span className="tweet-author">
                  <a href={`https://solscan.io/account/${buy.walletAddress}`} target="_blank" rel="noreferrer">
                    {shortAddress(buy.walletAddress)}
                  </a>
                </span>
                <span className="tweet-time">{timeAgo(buy.discoveredAt)}</span>
              </div>
              <p className="tweet-text">
                Bought <strong style={{ color: "var(--text-primary)" }}>{formatSize(buy)}</strong> worth of $CRED
                for {buy.counterAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {buy.counterSymbol}
                {buy.platform.length > 0 ? ` via ${buy.platform.join(", ")}` : ""}
              </p>
              <div className="tweet-foot">
                <div className="tweet-metrics">
                  <a href={`https://solscan.io/tx/${buy.txId}`} target="_blank" rel="noreferrer">
                    view tx ↗
                  </a>
                </div>
                <div className="match-badges">
                  <span className="match-badge" style={{ background: "var(--series-contract)" }}>
                    BUY
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
