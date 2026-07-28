import { config } from "../config.js";
import type { ApiV2Response, SolscanTokenDefiActivity, SolscanTokenMeta } from "./types.js";

const BASE_URL = "https://pro-api.solscan.io/v2.0/";

/** Well-known Solana mints priceable in USD without a full price oracle. */
export const REFERENCE_ASSETS: Record<string, { symbol: string; usdPerUnit?: number }> = {
  So11111111111111111111111111111111111111112: { symbol: "SOL" }, // priced live, see getSolPrice()
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: "USDC", usdPerUnit: 1 },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: "USDT", usdPerUnit: 1 },
};

type SolscanParam = string | number | Array<string | number> | undefined;

async function solscanGet<T>(path: string, params: Record<string, SolscanParam>): Promise<T> {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(`${key}[]`, String(v));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    headers: { token: config.solscanApiKey ?? "", accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Solscan API ${path} -> ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as ApiV2Response<T>;
  if (!body.success) {
    throw new Error(`Solscan API ${path} returned an error: ${body.errors?.message ?? "unknown"}`);
  }
  return body.data;
}

export interface DefiActivitiesOptions {
  fromBlockTime: number;
  toBlockTime: number;
  pageSize?: 10 | 20 | 30 | 40 | 60 | 100;
}

/** Fetches DeFi swap activity for a token within a block-time range, most recent first. */
export async function getTokenDefiActivities(
  tokenAddress: string,
  options: DefiActivitiesOptions,
): Promise<SolscanTokenDefiActivity[]> {
  return solscanGet<SolscanTokenDefiActivity[]>("token/defi/activities", {
    address: tokenAddress,
    activity_type: ["ACTIVITY_TOKEN_SWAP", "ACTIVITY_AGG_TOKEN_SWAP"],
    block_time: [options.fromBlockTime, options.toBlockTime],
    page_size: options.pageSize ?? 100,
    sort_by: "block_time",
    sort_order: "desc",
  });
}

let cachedSolPrice: { value: number; fetchedAt: number } | undefined;
const SOL_PRICE_TTL_MS = 5 * 60_000;
const SOL_MINT = "So11111111111111111111111111111111111111112";

/** Live SOL/USD price, cached for a few minutes. Returns undefined if the lookup fails. */
export async function getSolPriceUsd(): Promise<number | undefined> {
  if (cachedSolPrice && Date.now() - cachedSolPrice.fetchedAt < SOL_PRICE_TTL_MS) {
    return cachedSolPrice.value;
  }
  try {
    const meta = await solscanGet<SolscanTokenMeta>("token/meta", { address: SOL_MINT });
    cachedSolPrice = { value: meta.price, fetchedAt: Date.now() };
    return meta.price;
  } catch (err) {
    console.error("[solscan] failed to fetch SOL price:", err);
    return cachedSolPrice?.value;
  }
}
