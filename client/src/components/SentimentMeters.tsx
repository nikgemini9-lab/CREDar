import type { SentimentMeterWindow, Stats } from "../types";

const WINDOW_LABELS: Record<SentimentMeterWindow, string> = {
  "24h": "Past 24 hours",
  "3d": "Past 3 days",
  "7d": "Past 7 days",
};

export function SentimentMeters({ stats }: { stats: Stats | null }) {
  const meters = stats?.sentimentMeters ?? [];
  const hasAnyData = meters.some((m) => m.score !== null);

  return (
    <div className="panel">
      <h3 className="panel-title">Sentiment meter</h3>
      {!hasAnyData ? (
        <div className="empty-state">Waiting for classified tweets…</div>
      ) : (
        meters.map((m) => (
          <div className="meter-row" key={m.window}>
            <div className="meter-head">
              <span>{WINDOW_LABELS[m.window] ?? m.window}</span>
              <span>
                {m.score !== null ? (
                  <>
                    <strong>{m.score}</strong> — {m.label}
                  </>
                ) : (
                  "No data yet"
                )}
                {m.sampleSize > 0 ? ` (${m.sampleSize})` : ""}
              </span>
            </div>
            <div className="meter-track">
              {m.score !== null && <div className="meter-marker" style={{ left: `${m.score}%` }} />}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
