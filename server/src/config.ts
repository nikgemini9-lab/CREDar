import "dotenv/config";
import path from "node:path";
import type { CredarConfig } from "./types.js";

const DEFAULT_CONTRACT_ADDRESS = "CREDBHvVqREBCAxMihzr8D1nepHMr2gmQoZWpmgGmeta";
const DEFAULT_CASHTAG = "$CRED";
const DEFAULT_HANDLE = "@crediblefin";

function parseSearchTerms(): string[] {
  const raw = process.env.SEARCH_TERMS;
  if (raw && raw.trim().length > 0) {
    return raw
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean);
  }
  return [DEFAULT_CASHTAG, DEFAULT_HANDLE, DEFAULT_CONTRACT_ADDRESS];
}

const rettiwtApiKey = process.env.RETTIWT_API_KEY?.trim() || undefined;
const solscanApiKey = process.env.SOLSCAN_API_KEY?.trim() || undefined;

const defaultLocalDbPath = path.join(process.cwd(), "data", "credar.db");

export const config: CredarConfig = {
  port: Number(process.env.PORT ?? 8787),
  // Accepts a local `file:` path (default - no setup needed) or a remote
  // libSQL/Turso URL (`libsql://<db>.turso.io`) for storage that survives
  // redeploys on hosts with an ephemeral filesystem.
  databaseUrl: process.env.DATABASE_URL ?? `file:${defaultLocalDbPath}`,
  databaseAuthToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
  rettiwtApiKey,
  demoMode: process.env.DEMO_MODE === "true" || (!rettiwtApiKey && process.env.DEMO_MODE !== "false"),
  searchTerms: parseSearchTerms(),
  contractAddress: process.env.CONTRACT_ADDRESS ?? DEFAULT_CONTRACT_ADDRESS,
  cashtag: process.env.CASHTAG ?? DEFAULT_CASHTAG,
  handle: process.env.HANDLE ?? DEFAULT_HANDLE,
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 30_000),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || undefined,
  telegramChatId: process.env.TELEGRAM_CHAT_ID?.trim() || undefined,
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  solscanApiKey,
  chainDemoMode: process.env.CHAIN_DEMO_MODE === "true" || (!solscanApiKey && process.env.CHAIN_DEMO_MODE !== "false"),
  chainPollIntervalMs: Number(process.env.CHAIN_POLL_INTERVAL_MS ?? 30_000),
  bigBuyMinUsd: Number(process.env.BIG_BUY_MIN_USD ?? 500),
  bigBuyMinTokens: Number(process.env.BIG_BUY_MIN_TOKENS ?? 0),
};
