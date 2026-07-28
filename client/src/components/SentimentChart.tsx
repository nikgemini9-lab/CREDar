import type { Sentiment, SentimentBucket, Stats } from "../types";

const LEGEND: { key: Sentiment; label: string; color: string }[] = [
  { key: "bullish", label: "Bullish", color: "var(--sentiment-bullish)" },
  { key: "positive", label: "Positive", color: "var(--sentiment-positive)" },
  { key: "negative", label: "Negative", color: "var(--sentiment-negative)" },
  { key: "fud", label: "FUD", color: "var(--sentiment-fud)" },
];

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function bucketTotal(bucket: SentimentBucket): number {
  return bucket.bullish + bucket.positive + bucket.negative + bucket.fud;
}

export function SentimentChart({ stats }: { stats: Stats | null }) {
  const buckets = stats?.dailySentiment ?? [];
  const max = Math.max(1, ...buckets.map(bucketTotal));
  const breakdown = stats?.sentimentBreakdown;

  return (
    <div className="panel">
      <h3 className="panel-title">Sentiment — last 7 days</h3>

      {buckets.length === 0 || buckets.every((b) => bucketTotal(b) === 0) ? (
        <div className="empty-state">Waiting for classified tweets…</div>
      ) : (
        <>
          <div className="chart-wrap">
            {buckets.map((bucket) => {
              const total = bucketTotal(bucket);
              return (
                <div className="chart-bar-col" key={bucket.bucketStart}>
                  <div className="chart-tooltip">
                    {total} · {formatDay(bucket.bucketStart)}
                  </div>
                  <div className="chart-bar-stack" style={{ height: `${Math.max((total / max) * 100, total > 0 ? 4 : 1)}%` }}>
                    {LEGEND.map(({ key, color }) =>
                      bucket[key] > 0 ? (
                        <div
                          key={key}
                          className="chart-bar-segment"
                          style={{
                            height: `${(bucket[key] / total) * 100}%`,
                            background: color,
                          }}
                        />
                      ) : null,
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="chart-axis">
            <span>{formatDay(buckets[0].bucketStart)}</span>
            <span>now</span>
          </div>
        </>
      )}

      {breakdown && (
        <div className="legend">
          {LEGEND.map((item) => (
            <div className="legend-item" key={item.key}>
              <span className="legend-swatch" style={{ background: item.color }} />
              {item.label} ({breakdown[item.key] ?? 0})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
