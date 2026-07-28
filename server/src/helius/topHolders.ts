import { PublicKey } from "@solana/web3.js";
import { config } from "../config.js";
import { getTopHolders as getStoredTopHolders, isTopHolderWallet as isStoredTopHolderWallet, replaceTopHolders } from "../db/index.js";
import type { TopHolder } from "../types.js";

// Matches the fixed wallet list demoSwaps.ts uses, so demo mode can also
// demonstrate top-holder-sell alerting without needing live credentials.
const DEMO_TOP_HOLDERS: Omit<TopHolder, "updatedAt">[] = [
  { walletAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", tokenAmount: 12_500_000, rank: 1 },
  { walletAddress: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1", tokenAmount: 8_200_000, rank: 2 },
  { walletAddress: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", tokenAmount: 4_750_000, rank: 3 },
];

let lastRefreshError: string | undefined;

export function getLastTopHoldersError(): string | undefined {
  return lastRefreshError;
}

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(config.solanaRpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Solana RPC ${method} -> ${res.status}`);

  const body = (await res.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(`Solana RPC ${method} -> ${body.error.message ?? "unknown error"}`);
  if (body.result === undefined) throw new Error(`Solana RPC ${method} -> missing result`);
  return body.result;
}

interface LargestAccountsResult {
  value: { address: string; amount: string; decimals: number; uiAmount: number | null; uiAmountString?: string }[];
}

interface ParsedAccountsResult {
  value: ({ data: { parsed?: { info?: { owner?: string; tokenAmount?: { uiAmount?: number } } } } } | null)[];
}

/**
 * Fetches the current top $CRED holders directly from a Solana RPC endpoint
 * (no Helius webhook/key needed - this is a standard RPC call). Filters out
 * PDA-owned token accounts (liquidity pools, AMM vaults) since only
 * addresses on the ed25519 curve can be genuine user-controlled wallets -
 * without this, the pool itself would constantly show up as "the top
 * holder selling" on every routine buy.
 */
export async function refreshTopHolders(): Promise<void> {
  if (config.chainDemoMode) {
    await replaceTopHolders(DEMO_TOP_HOLDERS);
    lastRefreshError = undefined;
    return;
  }

  try {
    const largest = await rpcCall<LargestAccountsResult>("getTokenLargestAccounts", [config.contractAddress]);
    const tokenAccountAddresses = largest.value.map((a) => a.address);
    if (tokenAccountAddresses.length === 0) {
      await replaceTopHolders([]);
      lastRefreshError = undefined;
      return;
    }

    const parsed = await rpcCall<ParsedAccountsResult>("getMultipleAccounts", [
      tokenAccountAddresses,
      { encoding: "jsonParsed" },
    ]);

    const holders: Omit<TopHolder, "updatedAt" | "rank">[] = [];
    parsed.value.forEach((account, i) => {
      const info = account?.data.parsed?.info;
      const owner = info?.owner;
      if (!owner) return;

      let ownerKey: PublicKey;
      try {
        ownerKey = new PublicKey(owner);
      } catch {
        return;
      }
      if (!PublicKey.isOnCurve(ownerKey.toBytes())) return;

      const uiAmount = info?.tokenAmount?.uiAmount ?? largest.value[i]?.uiAmount ?? 0;
      holders.push({ walletAddress: owner, tokenAmount: uiAmount });
    });

    holders.sort((a, b) => b.tokenAmount - a.tokenAmount);
    const ranked = holders.slice(0, config.topHolderCount).map((h, i) => ({ ...h, rank: i + 1 }));

    await replaceTopHolders(ranked);
    lastRefreshError = undefined;
  } catch (err) {
    lastRefreshError = err instanceof Error ? err.message : String(err);
    console.error("[topHolders] refresh failed:", err);
  }
}

export async function isTopHolderWallet(wallet: string): Promise<boolean> {
  return isStoredTopHolderWallet(wallet);
}

export async function getTopHolders(): Promise<TopHolder[]> {
  return getStoredTopHolders();
}

/**
 * Awaits the first refresh (so top holders are known before any swap gets
 * processed) then keeps refreshing periodically in the background.
 */
export async function startTopHoldersMonitor(): Promise<void> {
  await refreshTopHolders();
  setInterval(() => {
    refreshTopHolders().catch((err) => console.error("[topHolders] refresh failed:", err));
  }, config.topHolderRefreshMs);
}
