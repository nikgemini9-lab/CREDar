import { useCallback, useEffect, useState } from "react";
import { api, useLiveTweets } from "./api";
import { AccountLeaderboard } from "./components/AccountLeaderboard";
import { Header } from "./components/Header";
import { LiveFeed } from "./components/LiveFeed";
import { StatCards } from "./components/StatCards";
import { VolumeChart } from "./components/VolumeChart";
import type { AccountRecord, CredarPublicConfig, Stats, TweetRecord } from "./types";

const MAX_FEED_ITEMS = 100;
const STATS_REFRESH_MS = 20_000;

export default function App() {
  const [config, setConfig] = useState<CredarPublicConfig | null>(null);
  const [tweets, setTweets] = useState<TweetRecord[]>([]);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const refresh = useCallback(async () => {
    const [accountsRes, statsRes] = await Promise.all([api.accounts(10), api.stats()]);
    setAccounts(accountsRes);
    setStats(statsRes);
  }, []);

  useEffect(() => {
    api.config().then(setConfig).catch(console.error);
    api.tweets(50).then(setTweets).catch(console.error);
    refresh().catch(console.error);

    const interval = setInterval(() => refresh().catch(console.error), STATS_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const { connected } = useLiveTweets((tweet) => {
    setTweets((prev) => [tweet, ...prev].slice(0, MAX_FEED_ITEMS));
    refresh().catch(console.error);
  });

  return (
    <div className="app">
      <Header config={config} connected={connected} />
      <StatCards stats={stats} />

      <div className="grid-main">
        <LiveFeed tweets={tweets} />
        <div>
          <VolumeChart stats={stats} />
          <AccountLeaderboard accounts={accounts} />
        </div>
      </div>

      <div className="footer-note">CREDAR — monitoring X/Twitter for $CRED mentions via Rettiwt</div>
    </div>
  );
}
