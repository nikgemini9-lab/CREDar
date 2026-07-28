import { config } from "../config.js";
import { bigBuyExists, insertBigBuy } from "../db/index.js";
import type { BigBuyRecord } from "../types.js";
import { demoSwaps } from "./demoSwaps.js";
import { isBigEnough, parseSwap } from "./parse.js";
import type { EnhancedTransaction } from "./types.js";

export type BigBuyHandler = (buy: BigBuyRecord) => void | Promise<void>;

export async function processTransaction(tx: EnhancedTransaction, onBigBuy: BigBuyHandler): Promise<void> {
  if (await bigBuyExists(tx.signature)) return;

  const buy = await parseSwap(tx);
  if (!buy || !isBigEnough(buy)) return;

  await insertBigBuy(buy);
  await onBigBuy(buy);
}

async function runDemoLoop(onBigBuy: BigBuyHandler): Promise<void> {
  console.log("[chain] HELIUS_WEBHOOK_AUTH_HEADER not set - running big-buy detection in DEMO MODE with synthetic swaps");
  for await (const tx of demoSwaps()) {
    await processTransaction(tx, onBigBuy);
  }
}

/**
 * In live mode, big-buy detection is entirely webhook-driven (see
 * api/router.ts's POST /webhooks/helius) - there's no polling loop to start.
 * In demo mode, this runs a synthetic swap generator instead.
 */
export function startChainMonitor(onBigBuy: BigBuyHandler): void {
  if (!config.chainDemoMode) {
    console.log("[chain] waiting for Helius webhook deliveries at /api/webhooks/helius");
    return;
  }

  runDemoLoop(onBigBuy).catch((err) => {
    console.error("[chain] demo loop crashed:", err);
  });
}
