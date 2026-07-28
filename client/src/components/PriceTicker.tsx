import { useEffect, useState } from "react";
import { api, type TokenPrice } from "../api";

const POLL_MS = 20_000;

function formatPrice(price: number): string {
  if (price >= 1) {
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  }
  // Small token prices need more decimals to show any meaningful digits at all.
  const decimals = Math.min(10, Math.max(4, -Math.floor(Math.log10(price)) + 3));
  return `$${price.toFixed(decimals)}`;
}

export function PriceTicker() {
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

  return (
    <div className="price-ticker">
      <span className="price-ticker-label">$CRED</span>
      {price?.priceUsd != null ? (
        <span className="price-ticker-value">{formatPrice(price.priceUsd)}</span>
      ) : (
        <span className="price-ticker-value price-ticker-unavailable">
          {failed || price ? "price unavailable" : "loading…"}
        </span>
      )}
      <span className="price-ticker-source">live via Jupiter</span>
    </div>
  );
}
