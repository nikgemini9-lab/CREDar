import type { SolscanTokenDefiActivity } from "./types.js";
import { config } from "../config.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const WALLETS = [
  "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
  "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
];

let counter = 0;

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Emits a synthetic swap every 10-25s, mostly modest, occasionally a whale-sized buy. */
export async function* demoBigBuys(): AsyncGenerator<SolscanTokenDefiActivity> {
  while (true) {
    const delay = 10_000 + Math.random() * 15_000;
    await new Promise((resolve) => setTimeout(resolve, delay));
    counter += 1;

    const isBuy = Math.random() > 0.35;
    const isWhale = Math.random() > 0.6;
    const solSpent = isWhale ? 5 + Math.random() * 40 : Math.random() * 3;
    const credAmount = solSpent * (5_000 + Math.random() * 2_000); // fake CRED/SOL rate
    const counterMint = Math.random() > 0.5 ? SOL_MINT : USDC_MINT;
    const counterAmount = counterMint === SOL_MINT ? solSpent : solSpent * 150; // fake SOL/USD ~150

    const routers = isBuy
      ? {
          token1: counterMint,
          token1_decimals: counterMint === SOL_MINT ? 9 : 6,
          amount1: counterAmount * 10 ** (counterMint === SOL_MINT ? 9 : 6),
          token2: config.contractAddress,
          token2_decimals: 6,
          amount2: credAmount * 10 ** 6,
        }
      : {
          token1: config.contractAddress,
          token1_decimals: 6,
          amount1: credAmount * 10 ** 6,
          token2: counterMint,
          token2_decimals: counterMint === SOL_MINT ? 9 : 6,
          amount2: counterAmount * 10 ** (counterMint === SOL_MINT ? 9 : 6),
        };

    yield {
      block_id: 300_000_000 + counter,
      trans_id: `demo-swap-${Date.now()}-${counter}`,
      block_time: Math.floor(Date.now() / 1000),
      activity_type: isWhale ? "ACTIVITY_AGG_TOKEN_SWAP" : "ACTIVITY_TOKEN_SWAP",
      from_address: randomFrom(WALLETS),
      to_address: randomFrom(WALLETS),
      platform: isWhale ? ["jupiter"] : ["raydium"],
      sources: isWhale ? ["jupiter"] : ["raydium"],
      routers,
    };
  }
}
