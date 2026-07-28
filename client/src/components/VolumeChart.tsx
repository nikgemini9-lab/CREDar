import type { MatchKind, Stats, StatsBucket } from "../types";

const LEGEND: { key: MatchKind; label: string; color: string }[] = [
  { key: "cashtag", label: "$CRED cashtag", color: "var(--series-cashtag)" },
  { key: "mention", label: "@crediblefin mention", color: "var(--series-mention)" },
  { key: "contract", label: "Contract address", color: "var(--series-contract)" },
  { key: "keyword", label: "Other tracked term", color: "var(--series-keyword)" },
];

interface MentionVolumeChartProps {
  title: string;
  buckets: StatsBucket[];
  formatLabel: (iso: string) => string;
  matchBreakdown?: Record<MatchKind, number>;
}

export function MentionVolumeChart({ title, buckets, formatLabel, matchBreakdown }: MentionVolumeChartProps) {
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="panel">
      <h3 className="panel-title">{title}</h3>

      {buckets.length === 0 ? (
        <div className="empty-state">Waiting for data…</div>
      ) : (
        <>
          <div className="chart-wrap">
            {buckets.map((bucket) => (
              <div className="chart-bar-col" key={bucket.bucketStart}>
                <div className="chart-tooltip">
                  {bucket.count} · {formatLabel(bucket.bucketStart)}
                </div>
                <div
                  className="chart-bar"
                  style={{ height: `${Math.max((bucket.count / max) * 100, bucket.count > 0 ? 4 : 1)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="chart-axis">
            <span>{formatLabel(buckets[0].bucketStart)}</span>
            <span>now</span>
          </div>
        </>
      )}

      {matchBreakdown && (
        <div className="legend">
          {LEGEND.map((item) => (
            <div className="legend-item" key={item.key}>
              <span className="legend-swatch" style={{ background: item.color }} />
              {item.label} ({matchBreakdown[item.key] ?? 0})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function VolumeChart({ stats }: { stats: Stats | null }) {
  return (
    <MentionVolumeChart
      title="Mention volume — last 24h"
      buckets={stats?.hourlyVolume ?? []}
      formatLabel={formatHour}
    />
  );
}

export function WeeklyVolumeChart({ stats }: { stats: Stats | null }) {
  return (
    <MentionVolumeChart
      title="Mention volume — last 7 days"
      buckets={stats?.dailyVolume ?? []}
      formatLabel={formatDay}
      matchBreakdown={stats?.matchBreakdown}
    />
  );
}
