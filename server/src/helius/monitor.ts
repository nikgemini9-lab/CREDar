import { config } from "../config.js";
import { bigBuyExists, insertBigBuy } from "../db/index.js";
import type { BigBuyRecord } from "../types.js";
import { demoSwaps } from "./demoSwaps.js";
import { isBigEnough, parseSwap } from "./parse.js";
import type { EnhancedTransaction } from "./types.js";

export type BigBuyHandler = (buy: BigBuyRecord) => void | Promise<void>;

export interface WebhookDebugEntry {
  at: string;
  signature: string;
  type: string | undefined;
  source: string | undefined;
  verdict: string;
}

const MAX_DEBUG_ENTRIES = 30;
const recentDeliveries: WebhookDebugEntry[] = [];
let lastAuthFailureAt: string | undefined;

function pushDebug(entry: WebhookDebugEntry): void {
  recentDeliveries.unshift(entry);
  if (recentDeliveries.length > MAX_DEBUG_ENTRIES) recentDeliveries.pop();
}

export function recordWebhookAuthFailure(): void {
  lastAuthFailureAt = new Date().toISOString();
}

export function getWebhookDebugState(): { lastAuthFailureAt: string | undefined; recentDeliveries: WebhookDebugEntry[] } {
  return { lastAuthFailureAt, recentDeliveries };
}

/**
 * Handles one delivered transaction from the Helius webhook, regardless of
 * its `type` - every decision (recorded, skipped, why) is logged to an
 * in-memory ring buffer surfaced via GET /api/admin/webhook-debug, since
 * "check the Render logs" isn't a workable debugging path for every user.
 */
export async function processTransaction(
  tx: EnhancedTransaction,
  onBigBuy: BigBuyHandler,
  isDemo: boolean,
): Promise<void> {
  const shortSig = tx.signature ? `${tx.signature.slice(0, 8)}…` : "unknown";
  const log = (verdict: string) =>
    pushDebug({ at: new Date().toISOString(), signature: shortSig, type: tx.type, source: tx.source, verdict });

  if (tx.type !== "SWAP") {
    log(`skipped: type=${tx.type ?? "unknown"} (not SWAP)`);
    return;
  }

  if (await bigBuyExists(tx.signature)) {
    log("skipped: already recorded");
    return;
  }

  const buy = await parseSwap(tx);
  if (!buy) {
    log("skipped: contract address didn't move for the fee-payer wallet");
    return;
  }

  if (!isBigEnough(buy)) {
    const sizeLabel = buy.usdValue !== null ? `$${buy.usdValue.toFixed(2)}` : `${buy.tokenAmount} $CRED (unpriced)`;
    log(`skipped: ${buy.side} of ${sizeLabel} is below the $${config.bigBuyMinUsd} threshold`);
    return;
  }

  await insertBigBuy(buy, isDemo);
  await onBigBuy(buy);
  const sizeLabel = buy.usdValue !== null ? `$${buy.usdValue.toFixed(2)}` : `${buy.tokenAmount} $CRED (unpriced)`;
  log(`recorded: ${buy.side} of ${sizeLabel}`);
}

async function runDemoLoop(onBigBuy: BigBuyHandler): Promise<void> {
  console.log("[chain] HELIUS_WEBHOOK_AUTH_HEADER not set - running big-buy detection in DEMO MODE with synthetic swaps");
  for await (const tx of demoSwaps()) {
    await processTransaction(tx, onBigBuy, true);
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
