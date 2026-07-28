import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApiRouter } from "./api/router.js";
import { config } from "./config.js";
import { initDb } from "./db/index.js";
import { startChainMonitor } from "./helius/monitor.js";
import { startTopHoldersMonitor } from "./helius/topHolders.js";
import { startMonitor } from "./monitor/monitor.js";
import { startSentimentMonitor } from "./sentiment/monitor.js";
import { sendBigBuyAlert, sendTelegramAlert } from "./telegram/telegram.js";
import { attachWebSocketHub, broadcast } from "./ws/hub.js";

async function main() {
  await initDb();
  await startTopHoldersMonitor();

  const onBigBuy = async (buy: Parameters<typeof sendBigBuyAlert>[0]) => {
    broadcast("bigBuy", buy);
    await sendBigBuyAlert(buy);
  };

  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());
  app.use("/api", createApiRouter(onBigBuy));

  // Serve the built dashboard from the same service/port when it's been built
  // alongside the server (this is how CREDAR runs as a single Render web
  // service: one process, one port, no CORS/cross-origin WebSocket to manage).
  const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
  }

  const server = createServer(app);
  attachWebSocketHub(server);

  startMonitor(async (tweet) => {
    broadcast("tweet", tweet);
    await sendTelegramAlert(tweet);
  });

  startChainMonitor(onBigBuy);

  startSentimentMonitor((id, sentiment) => {
    broadcast("sentiment", { id, sentiment });
  });

  server.listen(config.port, () => {
    console.log(`CREDAR server listening on http://localhost:${config.port}`);
    console.log(`Tracking: ${config.searchTerms.join(" | ")}`);
    console.log(`Mode: ${config.demoMode ? "DEMO" : "LIVE"} (tweets), ${config.chainDemoMode ? "DEMO" : "LIVE"} (chain)`);
  });
}

main().catch((err) => {
  console.error("[credar] fatal startup error:", err);
  process.exit(1);
});
