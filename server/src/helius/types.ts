/**
 * Shapes delivered by a Helius "Enhanced" webhook (https://www.helius.dev/docs/webhooks).
 * A webhook delivery POSTs a JSON array of these. Field names verified against
 * the official `helius-sdk`'s Enhanced Transactions API types, which describe
 * the same transaction shape used by webhooks.
 */

export interface EnhancedNativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  /** Amount in lamports (1 SOL = 1e9 lamports). */
  amount: number;
}

export interface EnhancedTokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  mint: string;
  /** Human-readable (UI) token amount, already adjusted for decimals. */
  tokenAmount: number | string;
  decimals?: number;
}

export interface EnhancedTransaction {
  signature: string;
  type?: string;
  source?: string;
  feePayer?: string;
  timestamp?: number;
  nativeTransfers?: EnhancedNativeTransfer[];
  tokenTransfers?: EnhancedTokenTransfer[];
}
