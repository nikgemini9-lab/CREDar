import { Router, type NextFunction, type Request, type Response } from "express";
import { config } from "../config.js";
import { getRecentTweets, getStats, getTopAccounts } from "../db/index.js";

export const apiRouter = Router();

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

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

apiRouter.get("/config", (_req, res) => {
  res.json({
    demoMode: config.demoMode,
    searchTerms: config.searchTerms,
    cashtag: config.cashtag,
    handle: config.handle,
    contractAddress: config.contractAddress,
    telegramEnabled: Boolean(config.telegramBotToken && config.telegramChatId),
  });
});
