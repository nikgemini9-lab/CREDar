import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { apiRouter } from "./api/router.js";
import { config } from "./config.js";
import "./db/index.js";
import { startMonitor } from "./monitor/monitor.js";
import { sendTelegramAlert } from "./telegram/telegram.js";
import { attachWebSocketHub, broadcast } from "./ws/hub.js";

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use("/api", apiRouter);

const server = createServer(app);
attachWebSocketHub(server);

startMonitor(async (tweet) => {
  broadcast("tweet", tweet);
  await sendTelegramAlert(tweet);
});

server.listen(config.port, () => {
  console.log(`CREDAR server listening on http://localhost:${config.port}`);
  console.log(`Tracking: ${config.searchTerms.join(" | ")}`);
  console.log(`Mode: ${config.demoMode ? "DEMO" : "LIVE"}`);
});
