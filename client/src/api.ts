import { useEffect, useRef, useState } from "react";
import type { AccountRecord, CredarPublicConfig, Stats, TweetRecord } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  tweets: (limit = 50) => getJson<TweetRecord[]>(`/api/tweets?limit=${limit}`),
  accounts: (limit = 20) => getJson<AccountRecord[]>(`/api/accounts?limit=${limit}`),
  stats: () => getJson<Stats>("/api/stats"),
  config: () => getJson<CredarPublicConfig>("/api/config"),
};

type SocketMessage = { type: "tweet"; payload: TweetRecord } | { type: "hello"; payload: unknown };

/** Connects to the CREDAR websocket feed and invokes `onTweet` for each newly discovered tweet. */
export function useLiveTweets(onTweet: (tweet: TweetRecord) => void): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onTweet);
  handlerRef.current = onTweet;

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
          if (message.type === "tweet") handlerRef.current(message.payload);
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
