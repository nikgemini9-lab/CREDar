import { useCallback, useEffect, useState } from "react";
import { api, useCredarSocket } from "./api";
import { AccountLeaderboard } from "./components/AccountLeaderboard";
import { BigBuys } from "./components/BigBuys";
import { Header } from "./components/Header";
import { LiveFeed } from "./components/LiveFeed";
import { PriceTicker } from "./components/PriceTicker";
import { SentimentChart } from "./components/SentimentChart";
import { StatCards } from "./components/StatCards";
import { VolumeChart, WeeklyVolumeChart } from "./components/VolumeChart";
import type { AccountRecord, BigBuyRecord, CredarPublicConfig, Stats, TweetRecord } from "./types";

const MAX_FEED_ITEMS = 100;
const STATS_REFRESH_MS = 20_000;

export default function App() {
  const [config, setConfig] = useState<CredarPublicConfig | null>(null);
  const [tweets, setTweets] = useState<TweetRecord[]>([]);
  const [bigBuys, setBigBuys] = useState<BigBuyRecord[]>([]);
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
    api.bigBuys(30).then(setBigBuys).catch(console.error);
    refresh().catch(console.error);

    const interval = setInterval(() => refresh().catch(console.error), STATS_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const { connected } = useCredarSocket({
    onTweet: (tweet) => {
      setTweets((prev) => [tweet, ...prev].slice(0, MAX_FEED_ITEMS));
      refresh().catch(console.error);
    },
    onBigBuy: (buy) => {
      setBigBuys((prev) => [buy, ...prev].slice(0, MAX_FEED_ITEMS));
    },
    onSentiment: (id, sentiment) => {
      setTweets((prev) => prev.map((t) => (t.id === id ? { ...t, sentiment } : t)));
      refresh().catch(console.error);
    },
  });

  return (
    <div className="app">
      <Header config={config} connected={connected} />
      <PriceTicker stats={stats} sentimentEnabled={Boolean(config?.sentimentEnabled)} />
      <StatCards stats={stats} />

      <div className="grid-main">
        <LiveFeed tweets={tweets} />
        <AccountLeaderboard accounts={accounts} />
        <div>
          <VolumeChart stats={stats} />
          <WeeklyVolumeChart stats={stats} />
          {config?.sentimentEnabled && <SentimentChart stats={stats} />}
          <BigBuys buys={bigBuys} />
        </div>
      </div>

      <div className="footer-note">
        CREDAR — monitoring X/Twitter via Rettiwt and on-chain swaps via Helius
      </div>
    </div>
  );
}
