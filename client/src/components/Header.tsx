import type { CredarPublicConfig } from "../types";

interface Props {
  config: CredarPublicConfig | null;
  connected: boolean;
}

export function Header({ config, connected }: Props) {
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark">CR</div>
        <div>
          <div className="brand-title">CREDAR</div>
          <div className="brand-subtitle">radar for $CRED — CredibleFin mention monitor</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        <div className="status-pill">
          <span className={`status-dot ${connected ? "online" : ""}`} />
          {connected ? "LIVE" : "CONNECTING…"}
          {config?.demoMode ? " · DEMO DATA" : ""}
        </div>
        {config && (
          <div className="header-terms">
            <span className="term-chip">{config.cashtag}</span>
            <span className="term-chip">{config.handle}</span>
            <span className="term-chip" title={config.contractAddress}>
              CA…{config.contractAddress.slice(-6)}
            </span>
            <span className="term-chip">{config.telegramEnabled ? "TG alerts on" : "TG alerts off"}</span>
            <span className="term-chip">
              big buys ≥ ${config.bigBuyMinUsd.toLocaleString()}
              {config.chainDemoMode ? " (demo)" : ""}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
