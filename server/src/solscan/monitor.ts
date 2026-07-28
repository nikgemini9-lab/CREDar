import { config } from "../config.js";
import { bigBuyExists, getMeta, insertBigBuy, setMeta } from "../db/index.js";
import type { BigBuyRecord } from "../types.js";
import { REFERENCE_ASSETS, getSolPriceUsd, getTokenDefiActivities } from "./client.js";
import { demoBigBuys } from "./demoBuys.js";
import type { SolscanTokenDefiActivity } from "./types.js";

const LAST_BLOCK_TIME_KEY = "last_swap_block_time";
const RESTART_DELAY_MS = 20_000;

export type BigBuyHandler = (buy: BigBuyRecord) => void | Promise<void>;

const SOL_MINT = "So11111111111111111111111111111111111111112";

async function toBigBuyRecord(activity: SolscanTokenDefiActivity): Promise<BigBuyRecord | null> {
  const { routers } = activity;
  if (!routers) return null;

  let side: "buy" | "sell";
  let tokenAmount: number;
  let counterAddress: string;
  let counterAmount: number;
  let counterDecimals: number;

  if (routers.token2 === config.contractAddress) {
    side = "buy";
    tokenAmount = routers.amount2 / 10 ** routers.token2_decimals;
    counterAddress = routers.token1;
    counterAmount = routers.amount1 / 10 ** routers.token1_decimals;
    counterDecimals = routers.token1_decimals;
  } else if (routers.token1 === config.contractAddress) {
    side = "sell";
    tokenAmount = routers.amount1 / 10 ** routers.token1_decimals;
    counterAddress = routers.token2;
    counterAmount = routers.amount2 / 10 ** routers.token2_decimals;
    counterDecimals = routers.token2_decimals;
  } else {
    return null;
  }

  const reference = REFERENCE_ASSETS[counterAddress];
  let usdValue: number | null = null;
  if (reference?.usdPerUnit !== undefined) {
    usdValue = counterAmount * reference.usdPerUnit;
  } else if (counterAddress === SOL_MINT) {
    const solPrice = await getSolPriceUsd();
    if (solPrice !== undefined) usdValue = counterAmount * solPrice;
  }

  return {
    txId: activity.trans_id,
    blockTime: new Date(activity.block_time * 1000).toISOString(),
    discoveredAt: new Date().toISOString(),
    side,
    walletAddress: activity.from_address,
    tokenAmount,
    counterSymbol: reference?.symbol ?? `${counterAddress.slice(0, 4)}…${counterAddress.slice(-4)}`,
    counterAddress,
    counterAmount,
    usdValue,
    platform: activity.platform ?? [],
  };
}

function isBigEnough(buy: BigBuyRecord): boolean {
  if (buy.side !== "buy") return false;
  if (buy.usdValue !== null) return buy.usdValue >= config.bigBuyMinUsd;
  return config.bigBuyMinTokens > 0 && buy.tokenAmount >= config.bigBuyMinTokens;
}

async function processActivity(activity: SolscanTokenDefiActivity, onBigBuy: BigBuyHandler): Promise<void> {
  if (await bigBuyExists(activity.trans_id)) return;

  const buy = await toBigBuyRecord(activity);
  if (!buy || !isBigEnough(buy)) return;

  await insertBigBuy(buy);
  await onBigBuy(buy);
}

async function runDemoLoop(onBigBuy: BigBuyHandler): Promise<void> {
  console.log("[chain] SOLSCAN_API_KEY not set - running big-buy detection in DEMO MODE with synthetic swaps");
  for await (const activity of demoBigBuys()) {
    await processActivity(activity, onBigBuy);
  }
}

async function runLiveLoop(onBigBuy: BigBuyHandler): Promise<void> {
  while (true) {
    try {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const lastBlockTimeRaw = await getMeta(LAST_BLOCK_TIME_KEY);
      const fromBlockTime = lastBlockTimeRaw
        ? Number(lastBlockTimeRaw) + 1
        : nowSeconds - Math.ceil((config.chainPollIntervalMs / 1000) * 2);

      const activities = await getTokenDefiActivities(config.contractAddress, {
        fromBlockTime,
        toBlockTime: nowSeconds,
        pageSize: 100,
      });

      for (const activity of activities) {
        await processActivity(activity, onBigBuy);
      }

      await setMeta(LAST_BLOCK_TIME_KEY, String(nowSeconds));
    } catch (err) {
      console.error("[chain] poll error, retrying shortly:", err);
    }

    await new Promise((resolve) => setTimeout(resolve, config.chainPollIntervalMs));
  }
}

export function startChainMonitor(onBigBuy: BigBuyHandler): void {
  const loop = config.chainDemoMode ? runDemoLoop(onBigBuy) : runLiveLoop(onBigBuy);
  loop.catch((err) => {
    console.error("[chain] fatal error, chain monitor stopped:", err);
    setTimeout(() => startChainMonitor(onBigBuy), RESTART_DELAY_MS);
  });
}
