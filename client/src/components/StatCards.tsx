import type { Stats } from "../types";

interface Props {
  stats: Stats | null;
}

export function StatCards({ stats }: Props) {
  const items = [
    { label: "Total tracked", value: stats?.totalTweets ?? 0 },
    { label: "Unique accounts", value: stats?.totalAccounts ?? 0 },
    { label: "Last hour", value: stats?.tweetsLastHour ?? 0 },
    { label: "Last 24h", value: stats?.tweetsLast24h ?? 0 },
    { label: "Last 7d", value: stats?.tweetsLast7d ?? 0 },
  ];

  return (
    <div className="stat-grid">
      {items.map((item) => (
        <div className="stat-card" key={item.label}>
          <div className="stat-label">{item.label}</div>
          <div className="stat-value">{item.value.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
