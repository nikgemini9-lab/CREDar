import { config } from "../config.js";
import type { EnhancedTransaction } from "./types.js";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const POOL = "6VivTuw6ZTDh6xUgWvfhAJqB1nSAWG4mFuk1RJx5eL3W";

// The first 3 match topHolders.ts's DEMO_TOP_HOLDERS list, so demo mode can
// showcase top-holder-sell alerting - the extra 2 are regular (non-tracked)
// traders, so a "top holder sold" alert reads as a notable event rather
// than something that fires on every single sell.
const WALLETS = [
  "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
  "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  "3nMBmadYbEMwqNHzXVDGXQF9DhcS3TxMYSaqz2v9UT2H",
  "BXzT1eYVzMYaGQVwLQEqxq8SnMj5GSK3Zvvn3DwoNsrE",
];

let counter = 0;

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Emits a synthetic SWAP transaction every 10-25s, mostly modest, occasionally whale-sized. */
export async function* demoSwaps(): AsyncGenerator<EnhancedTransaction> {
  while (true) {
    const delay = 10_000 + Math.random() * 15_000;
    await new Promise((resolve) => setTimeout(resolve, delay));
    counter += 1;

    const wallet = randomFrom(WALLETS);
    const isBuy = Math.random() > 0.35;
    const isWhale = Math.random() > 0.6;
    const solAmount = isWhale ? 5 + Math.random() * 40 : Math.random() * 3;
    const useUsdc = Math.random() > 0.5;
    const credAmount = solAmount * (5_000 + Math.random() * 2_000); // fake CRED/SOL rate
    const usdcAmount = solAmount * 150; // fake SOL/USD ~150

    const nativeTransfers = useUsdc
      ? []
      : [
          {
            fromUserAccount: isBuy ? wallet : POOL,
            toUserAccount: isBuy ? POOL : wallet,
            amount: Math.round(solAmount * 1e9),
          },
        ];

    const tokenTransfers = [
      {
        fromUserAccount: isBuy ? POOL : wallet,
        toUserAccount: isBuy ? wallet : POOL,
        mint: config.contractAddress,
        tokenAmount: credAmount,
      },
      ...(useUsdc
        ? [
            {
              fromUserAccount: isBuy ? wallet : POOL,
              toUserAccount: isBuy ? POOL : wallet,
              mint: USDC_MINT,
              tokenAmount: usdcAmount,
            },
          ]
        : []),
    ];

    yield {
      signature: `demo-swap-${Date.now()}-${counter}`,
      type: "SWAP",
      source: isWhale ? "JUPITER" : "RAYDIUM",
      feePayer: wallet,
      timestamp: Math.floor(Date.now() / 1000),
      nativeTransfers,
      tokenTransfers,
    };
  }
}
