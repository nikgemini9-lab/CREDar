import { Router, type NextFunction, type Request, type Response } from "express";
import { config } from "../config.js";
import { clearMeta, getRecentBigBuys, getRecentTweets, getStats, getTopAccounts } from "../db/index.js";
import type { BigBuyHandler } from "../helius/monitor.js";
import { processTransaction } from "../helius/monitor.js";
import type { EnhancedTransaction } from "../helius/types.js";
import { LAST_SEEN_ID_KEY } from "../monitor/monitor.js";

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

export function createApiRouter(onBigBuy: BigBuyHandler): Router {
  const apiRouter = Router();

  apiRouter.get("/health", (_req, res) => {
    res.json({ ok: true, demoMode: config.demoMode });
  });

  apiRouter.get(
    "/tweets",
    asyncHandler(async (req, res) => {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      res.json(await getRecentTweets(limit));
    }),
  );

  apiRouter.get(
    "/accounts",
    asyncHandler(async (req, res) => {
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      res.json(await getTopAccounts(limit));
    }),
  );

  apiRouter.get(
    "/stats",
    asyncHandler(async (_req, res) => {
      res.json(await getStats());
    }),
  );

  apiRouter.get(
    "/big-buys",
    asyncHandler(async (req, res) => {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      res.json(await getRecentBigBuys(limit));
    }),
  );

  apiRouter.get("/config", (_req, res) => {
    res.json({
      demoMode: config.demoMode,
      searchTerms: config.searchTerms,
      cashtag: config.cashtag,
      handle: config.handle,
      contractAddress: config.contractAddress,
      telegramEnabled: Boolean(config.telegramBotToken && config.telegramChatId),
      chainDemoMode: config.chainDemoMode,
      bigBuyMinUsd: config.bigBuyMinUsd,
    });
  });

  // Helius "Enhanced" webhook delivery: a JSON array of parsed transactions.
  // See README for how to create the webhook and set HELIUS_WEBHOOK_AUTH_HEADER.
  apiRouter.post(
    "/webhooks/helius",
    asyncHandler(async (req, res) => {
      if (!config.heliusWebhookAuthHeader || req.headers.authorization !== config.heliusWebhookAuthHeader) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const transactions = (Array.isArray(req.body) ? req.body : [req.body]) as EnhancedTransaction[];
      for (const tx of transactions) {
        if (tx.type !== "SWAP") continue;
        await processTransaction(tx, onBigBuy, false);
      }

      res.status(200).json({ ok: true });
    }),
  );

  // One-off manual reset: visiting this URL in a browser clears the stored
  // "last seen tweet" cursor, so the next poll treats it as a fresh start
  // and runs the 7-day backfill again. Requires ADMIN_TOKEN to be set.
  apiRouter.get(
    "/admin/reset-tweet-cursor",
    asyncHandler(async (req, res) => {
      if (!config.adminToken || req.query.token !== config.adminToken) {
        res.status(401).send("Unauthorized - check the token in the URL matches ADMIN_TOKEN.");
        return;
      }

      await clearMeta(LAST_SEEN_ID_KEY);
      res.status(200).send("Tweet cursor cleared. The next poll (within ~30s) will backfill again.");
    }),
  );

  return apiRouter;
}
