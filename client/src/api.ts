import { useEffect, useRef, useState } from "react";
import type { AccountRecord, BigBuyRecord, CredarPublicConfig, Sentiment, Stats, TweetRecord } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return (await res.json()) as T;
}

export interface TokenPrice {
  mint: string;
  priceUsd: number | null;
  fetchedAt: string;
}

export const api = {
  tweets: (limit = 50) => getJson<TweetRecord[]>(`/api/tweets?limit=${limit}`),
  accounts: (limit = 20) => getJson<AccountRecord[]>(`/api/accounts?limit=${limit}`),
  stats: () => getJson<Stats>("/api/stats"),
  config: () => getJson<CredarPublicConfig>("/api/config"),
  bigBuys: (limit = 50) => getJson<BigBuyRecord[]>(`/api/big-buys?limit=${limit}`),
  price: () => getJson<TokenPrice>("/api/price"),
};

type SocketMessage =
  | { type: "tweet"; payload: TweetRecord }
  | { type: "bigBuy"; payload: BigBuyRecord }
  | { type: "sentiment"; payload: { id: string; sentiment: Sentiment } }
  | { type: "hello"; payload: unknown };

interface LiveHandlers {
  onTweet?: (tweet: TweetRecord) => void;
  onBigBuy?: (buy: BigBuyRecord) => void;
  onSentiment?: (id: string, sentiment: Sentiment) => void;
}

/** Connects to the CREDAR websocket feed and dispatches new tweets/big-buys to the given handlers. */
export function useCredarSocket(handlers: LiveHandlers): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let socket: WebSocket;
    let retryTimer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    function connect() {
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (!cancelled) retryTimer = setTimeout(connect, 3000);
      };
      socket.onerror = () => socket.close();
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as SocketMessage;
          if (message.type === "tweet") handlersRef.current.onTweet?.(message.payload);
          if (message.type === "bigBuy") handlersRef.current.onBigBuy?.(message.payload);
          if (message.type === "sentiment") handlersRef.current.onSentiment?.(message.payload.id, message.payload.sentiment);
        } catch {
          // ignore malformed frames
        }
      };
    }

    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  return { connected };
}
