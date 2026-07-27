import { Router } from "express";
import { config } from "../config.js";
import { getRecentTweets, getStats, getTopAccounts } from "../db/index.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true, demoMode: config.demoMode });
});

apiRouter.get("/tweets", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  res.json(getRecentTweets(limit));
});

apiRouter.get("/accounts", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  res.json(getTopAccounts(limit));
});

apiRouter.get("/stats", (_req, res) => {
  res.json(getStats());
});

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
