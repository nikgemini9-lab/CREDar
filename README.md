# CREDAR

**CRED**ible**R**adar — a monitoring dashboard for `$CRED` (CredibleFin) on X/Twitter.

CREDAR watches X/Twitter in near real-time for posts that:

- mention the cashtag **`$CRED`**
- mention **`@crediblefin`**
- contain the contract address **`CREDBHvVqREBCAxMihzr8D1nepHMr2gmQoZWpmgGmeta`**

Every matching post is logged, shown live on a dashboard, tracked per-account
(a leaderboard of who's talking about $CRED), and pushed as a Telegram alert.

Search is done via [**Rettiwt-API**](https://github.com/Rishikant181/Rettiwt-API)
(an unofficial, cookie-authenticated X/Twitter client) instead of the paid
official X API.

## How it works

```
server/   Node.js + TypeScript backend
  - polls X/Twitter via rettiwt-api's tweet.stream()
  - stores matches in SQLite (node:sqlite)
  - tracks a per-account mention leaderboard
  - broadcasts new matches over a WebSocket
  - sends a Telegram alert for every match
  - exposes a small REST API for the dashboard

client/   Vite + React + TypeScript dashboard
  - live feed of matching posts
  - stat cards (total tracked, unique accounts, last hour / 24h)
  - 24h mention-volume chart + match-type breakdown
  - tracked-accounts leaderboard
```

If no Rettiwt credentials are configured, the server automatically runs in
**demo mode**: it generates synthetic sample posts on a timer so you can try
the whole pipeline (dashboard, WebSocket updates, Telegram alerts) before
wiring up real credentials.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the server

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

#### Rettiwt credentials (to monitor real tweets)

Rettiwt authenticates as a logged-in X/Twitter account via cookies, not an
official API key:

1. Log into x.com in your browser.
2. Open DevTools → Application/Storage → Cookies, and copy the values of
   `auth_token`, `ct0`, and `twid`.
3. Base64-encode the cookie string:
   ```js
   btoa("auth_token=<value>;ct0=<value>;twid=<value>;")
   ```
   (or use the "Rettiwt Auth Helper" browser extension mentioned in the
   Rettiwt-API docs)
4. Put the result in `RETTIWT_API_KEY` in `server/.env`.

Use a secondary/throwaway account for this — treat the resulting key like a
password, since it grants full access to that account.

Leave `RETTIWT_API_KEY` blank to run in demo mode.

#### Telegram alerts

1. Message [`@BotFather`](https://t.me/BotFather) on Telegram, run `/newbot`,
   and copy the token into `TELEGRAM_BOT_TOKEN`.
2. Message your new bot (or add it to a group), then visit
   `https://api.telegram.org/bot<TOKEN>/getUpdates` to find the numeric chat
   id, and put it in `TELEGRAM_CHAT_ID`.

Leave both blank to disable Telegram alerts.

#### What CREDAR tracks

The defaults match `$CRED` / `@crediblefin` / the CA above. Override with
`SEARCH_TERMS` (comma-separated, OR'd together) if you want to track
additional terms.

### 3. Run it

```bash
# terminal 1
npm run dev:server

# terminal 2
npm run dev:client
```

The dashboard is served at `http://localhost:5173` (proxies `/api` and `/ws`
to the backend on `:8787`).

### Production build

```bash
npm run build
npm start
```

`npm run build` builds both the server and the dashboard. In production the
server serves the built dashboard itself (`server/src/index.ts` serves
`client/dist` as static files whenever that directory exists), so `npm start`
alone runs the whole app — API, WebSocket, and UI — on a single port. No
separate static host or CORS config needed.

## Deploying to Render

This repo ships a [`render.yaml`](./render.yaml) Blueprint that deploys CREDAR
as a single Node web service:

1. In the Render dashboard: **New → Blueprint**, point it at this repo/branch.
2. Render provisions one web service (`credar`) running `npm install && npm run build`
   to build, then `npm start` to serve everything on one port.
3. After the first deploy, set the secret env vars it left blank (they're
   marked `sync: false` in `render.yaml` so Render prompts for them instead of
   storing them in the blueprint):
   - `RETTIWT_API_KEY` — see cookie extraction steps above (omit to stay in demo mode)
   - `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`
   - `SEARCH_TERMS` / `DEMO_MODE` if you want to override the defaults

`render.yaml` is set to the **free** plan, which has two tradeoffs worth
knowing about:

- **Spin-down**: free web services sleep after 15 minutes with no inbound
  traffic, and take about a minute to wake back up on the next request. While
  asleep, CREDAR isn't polling for new mentions. To keep it running
  continuously at no cost, set up an external uptime pinger to hit it every
  ~10 minutes (below).
- **Ephemeral filesystem**: the free plan has no persistent disk, so the
  SQLite file (tracked tweets/accounts) resets whenever the service redeploys,
  restarts, or spins down+up. Fine for trying it out; if you later want
  history to survive restarts, add a paid disk (see the commented-out block
  in `render.yaml`) or point `DB_PATH` at an external database instead.

### Keeping the free instance awake

Use a free uptime service to ping the health endpoint every 5-10 minutes so
Render never sees 15 idle minutes:

1. Sign up at [UptimeRobot](https://uptimerobot.com) (or
   [cron-job.org](https://cron-job.org) — no credit card needed for either).
2. Add a new HTTP(s) monitor:
   - URL: `https://<your-service>.onrender.com/api/health`
   - Interval: 5 minutes
3. Save. Each ping counts as inbound traffic, so Render never spins the
   service down (note: this does *not* prevent the ephemeral-filesystem reset
   above — it only stops the *sleep*-triggered restarts).

If you'd rather configure the service by hand instead of using the blueprint:
build command `npm install && npm run build`, start command `npm start`,
health check path `/api/health`, plan free.

## REST API

| Endpoint         | Description                                   |
|------------------|------------------------------------------------|
| `GET /api/health`   | Liveness + current mode (demo/live)          |
| `GET /api/tweets`   | Recent matching posts (`?limit=`)            |
| `GET /api/accounts` | Account leaderboard by mention count (`?limit=`) |
| `GET /api/stats`    | Totals, 24h hourly volume, match breakdown   |
| `GET /api/config`   | Public config (tracked terms, alert status)  |
| `WS /ws`            | Live push of each newly discovered post      |
