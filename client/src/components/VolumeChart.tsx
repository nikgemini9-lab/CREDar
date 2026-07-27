import type { MatchKind, Stats } from "../types";

interface Props {
  stats: Stats | null;
}

const LEGEND: { key: MatchKind; label: string; color: string }[] = [
  { key: "cashtag", label: "$CRED cashtag", color: "var(--series-cashtag)" },
  { key: "mention", label: "@crediblefin mention", color: "var(--series-mention)" },
  { key: "contract", label: "Contract address", color: "var(--series-contract)" },
  { key: "keyword", label: "Other tracked term", color: "var(--series-keyword)" },
];

function formatHour(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function VolumeChart({ stats }: Props) {
  const buckets = stats?.hourlyVolume ?? [];
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="panel">
      <h3 className="panel-title">Mention volume — last 24h</h3>

      {buckets.length === 0 ? (
        <div className="empty-state">Waiting for data…</div>
      ) : (
        <>
          <div className="chart-wrap">
            {buckets.map((bucket) => (
              <div className="chart-bar-col" key={bucket.bucketStart}>
                <div className="chart-tooltip">
                  {bucket.count} · {formatHour(bucket.bucketStart)}
                </div>
                <div
                  className="chart-bar"
                  style={{ height: `${Math.max((bucket.count / max) * 100, bucket.count > 0 ? 4 : 1)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="chart-axis">
            <span>{formatHour(buckets[0].bucketStart)}</span>
            <span>now</span>
          </div>
        </>
      )}

      <div className="legend">
        {LEGEND.map((item) => (
          <div className="legend-item" key={item.key}>
            <span className="legend-swatch" style={{ background: item.color }} />
            {item.label} ({stats?.matchBreakdown[item.key] ?? 0})
          </div>
        ))}
      </div>
    </div>
  );
}
