import { config } from "../config.js";
import type { BigBuyRecord } from "../types.js";
import { getSolPriceUsd } from "./price.js";
import type { EnhancedTransaction } from "./types.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

const EPSILON = 1e-9;

function netTokenAmountForWallet(tx: EnhancedTransaction, mint: string, wallet: string): number {
  let net = 0;
  for (const t of tx.tokenTransfers ?? []) {
    if (t.mint !== mint) continue;
    const amount = Number(t.tokenAmount);
    if (!Number.isFinite(amount)) continue;
    if (t.toUserAccount === wallet) net += amount;
    if (t.fromUserAccount === wallet) net -= amount;
  }
  return net;
}

// A trader's SOL side of a swap can show up as a native lamport transfer, a
// wrapped-SOL (WSOL) SPL token transfer, or both within the same
// transaction (e.g. wrap-then-swap) - Jupiter-routed swaps commonly use
// WSOL rather than native SOL, so both must be added together or those
// swaps are silently priced as "unknown".
function netSolForWallet(tx: EnhancedTransaction, wallet: string): number {
  let netLamports = 0;
  for (const t of tx.nativeTransfers ?? []) {
    if (t.toUserAccount === wallet) netLamports += t.amount;
    if (t.fromUserAccount === wallet) netLamports -= t.amount;
  }
  return netLamports / 1e9 + netTokenAmountForWallet(tx, SOL_MINT, wallet);
}

/**
 * Turns a Helius enhanced SWAP transaction into a normalized big-buy/sell
 * record, from the perspective of the wallet that paid the transaction fee
 * (the trader). Returns null if the transaction doesn't actually move the
 * tracked contract address for that wallet (shouldn't happen given Helius
 * filters webhook deliveries by account address, but defensive regardless).
 */
export async function parseSwap(tx: EnhancedTransaction): Promise<BigBuyRecord | null> {
  const wallet = tx.feePayer;
  if (!wallet) return null;

  const netCred = netTokenAmountForWallet(tx, config.contractAddress, wallet);
  if (Math.abs(netCred) < EPSILON) return null;

  const side: "buy" | "sell" = netCred > 0 ? "buy" : "sell";
  const tokenAmount = Math.abs(netCred);

  const netSol = netSolForWallet(tx, wallet);
  const netUsdc = netTokenAmountForWallet(tx, USDC_MINT, wallet);
  const netUsdt = netTokenAmountForWallet(tx, USDT_MINT, wallet);

  // For a buy, the trader's reference-asset balance should have gone down
  // (they spent it); for a sell, it should have gone up (they received it).
  const wantsNegative = side === "buy";

  let counterSymbol = "unknown";
  let counterAddress = "";
  let counterAmount = 0;
  let usdValue: number | null = null;

  if ((wantsNegative && netSol < -EPSILON) || (!wantsNegative && netSol > EPSILON)) {
    counterSymbol = "SOL";
    counterAddress = SOL_MINT;
    counterAmount = Math.abs(netSol);
    const solPrice = await getSolPriceUsd();
    if (solPrice !== undefined) usdValue = counterAmount * solPrice;
  } else if ((wantsNegative && netUsdc < -EPSILON) || (!wantsNegative && netUsdc > EPSILON)) {
    counterSymbol = "USDC";
    counterAddress = USDC_MINT;
    counterAmount = Math.abs(netUsdc);
    usdValue = counterAmount;
  } else if ((wantsNegative && netUsdt < -EPSILON) || (!wantsNegative && netUsdt > EPSILON)) {
    counterSymbol = "USDT";
    counterAddress = USDT_MINT;
    counterAmount = Math.abs(netUsdt);
    usdValue = counterAmount;
  }

  return {
    txId: tx.signature,
    blockTime: new Date((tx.timestamp ?? Date.now() / 1000) * 1000).toISOString(),
    discoveredAt: new Date().toISOString(),
    side,
    walletAddress: wallet,
    tokenAmount,
    counterSymbol,
    counterAddress,
    counterAmount,
    usdValue,
    platform: tx.source ? [tx.source] : [],
  };
}

// Same threshold applies to both sides - a big sell is exactly as newsworthy
// as a big buy of the same size.
export function isBigEnough(buy: BigBuyRecord): boolean {
  if (buy.usdValue !== null) return buy.usdValue >= config.bigBuyMinUsd;
  return config.bigBuyMinTokens > 0 && buy.tokenAmount >= config.bigBuyMinTokens;
}
