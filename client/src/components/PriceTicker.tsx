import { useEffect, useState } from "react";
import { api, type TokenPrice } from "../api";
import type { SentimentMeterWindow, Stats } from "../types";

const POLL_MS = 20_000;

const WINDOW_LABELS: Record<SentimentMeterWindow, string> = {
  "24h": "24H",
  "3d": "3D",
  "7d": "7D",
};

function formatPrice(price: number): string {
  if (price >= 1) {
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  }
  // Small token prices need more decimals to show any meaningful digits at all.
  const decimals = Math.min(10, Math.max(4, -Math.floor(Math.log10(price)) + 3));
  return `$${price.toFixed(decimals)}`;
}

interface Props {
  stats: Stats | null;
  sentimentEnabled: boolean;
}

export function PriceTicker({ stats, sentimentEnabled }: Props) {
  const [price, setPrice] = useState<TokenPrice | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      api
        .price()
        .then((p) => {
          if (cancelled) return;
          setPrice(p);
          setFailed(false);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    };

    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const meters = stats?.sentimentMeters ?? [];

  return (
    <div className="price-ticker">
      <div className="price-ticker-main">
        <span className="price-ticker-label">$CRED</span>
        {price?.priceUsd != null ? (
          <span className="price-ticker-value">{formatPrice(price.priceUsd)}</span>
        ) : (
          <span className="price-ticker-value price-ticker-unavailable">
            {failed || price ? "price unavailable" : "loading…"}
          </span>
        )}
      </div>

      {sentimentEnabled && meters.length > 0 && (
        <div className="price-ticker-meters">
          {meters.map((m) => (
            <div className="mini-meter" key={m.window}>
              <div className="mini-meter-head">
                <span>{WINDOW_LABELS[m.window] ?? m.window}</span>
                <span>{m.score !== null ? <strong>{m.score}</strong> : "—"}</span>
              </div>
              <div className="mini-meter-track">
                {m.score !== null && <div className="mini-meter-marker" style={{ left: `${m.score}%` }} />}
              </div>
              <div className="mini-meter-label">{m.score !== null ? m.label : "No data yet"}</div>
            </div>
          ))}
        </div>
      )}

      <span className="price-ticker-source">live via Jupiter</span>
    </div>
  );
}
