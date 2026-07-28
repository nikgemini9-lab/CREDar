import { useEffect, useState } from "react";
import { api } from "../api";
import type { TopHolder } from "../types";

const POLL_MS = 60_000;

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function TopHolders() {
  const [holders, setHolders] = useState<TopHolder[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      api
        .topHolders()
        .then((res) => {
          if (cancelled) return;
          setHolders(res.holders);
          setLastError(res.lastError);
        })
        .catch(() => {
          if (!cancelled) setLastError("failed to load");
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
    <div className="panel">
      <h3 className="panel-title">Top holders</h3>
      {holders.length === 0 ? (
        <div className="empty-state">{lastError ? "Top holders unavailable right now." : "Loading…"}</div>
      ) : (
        <table className="account-table">
          <thead>
            <tr>
              <th></th>
              <th>Wallet</th>
              <th style={{ textAlign: "right" }}>$CRED held</th>
            </tr>
          </thead>
          <tbody>
            {holders.map((holder) => (
              <tr key={holder.walletAddress}>
                <td className="account-rank">{holder.rank}</td>
                <td className="account-name">
                  <a href={`https://solscan.io/account/${holder.walletAddress}`} target="_blank" rel="noreferrer">
                    {shortAddress(holder.walletAddress)}
                  </a>
                </td>
                <td className="account-count">{holder.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
