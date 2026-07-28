# CREDAR

**CRED**ible**R**adar — a monitoring dashboard for `$CRED` (CredibleFin) on X/Twitter.

CREDAR watches X/Twitter in near real-time for posts that:

- mention the cashtag **`$CRED`**
- mention **`@crediblefin`**
- contain the contract address **`CREDBHvVqREBCAxMihzr8D1nepHMr2gmQoZWpmgGmeta`**

Every matching post is logged, shown live on a dashboard, tracked per-account
(a leaderboard of who's talking about $CRED), and pushed as a Telegram alert.
Each real post is also classified by sentiment - **bullish, positive,
negative, or FUD** - via the free-tier Gemini API, shown as a live 24h/3d/7d
sentiment meter and charted over the last 7 days.

CREDAR also watches the contract address on-chain (Solana) for **big buys and
sells** — swaps above a USD threshold, whether traded directly on a DEX or
routed through an aggregator like Jupiter — and alerts on those too. The
dashboard also shows $CRED's live USD price (via Jupiter's price API).

Search is done via [**Rettiwt-API**](https://github.com/Rishikant181/Rettiwt-API)
(an unofficial, cookie-authenticated X/Twitter client) instead of the paid
official X API. On-chain activity is delivered via a **Helius webhook**
(free tier, push-based - no polling).

## How it works

```
server/   Node.js + TypeScript backend
  - polls X/Twitter via rettiwt-api's tweet.stream()
  - receives a webhook from Helius on every SWAP involving the contract
    address, flags buys/sells above a USD threshold as "big" trades
  - fetches $CRED's live USD price from Jupiter's price API
  - stores everything in SQLite - a local file by default, or a free remote
    libSQL/Turso database for storage that survives redeploys (via @libsql/client)
  - tracks a per-account mention leaderboard
  - broadcasts new matches/big-trades over a WebSocket
  - sends a Telegram alert for every match and every big buy/sell
  - classifies each real tweet's sentiment via the Gemini API in a background
    sweep (bullish/positive/negative/fud), broadcast over the WebSocket too
  - exposes a small REST API for the dashboard

client/   Vite + React + TypeScript dashboard
  - big, prominent live $CRED price ticker
  - live feed of matching posts, with a sentiment badge per tweet
  - live sentiment meter (24h/3d/7d gauge scores, Fear & Greed Index style)
  - tracked-accounts leaderboard (front and center - mentions happen far
    more often than big trades)
  - live feed of big buys/sells, with tx/wallet links to Solscan's explorer
  - stat cards (total tracked, unique accounts, last hour / 24h / 7d)
  - 24h and 7-day mention-volume charts + match-type breakdown
  - 7-day sentiment chart (stacked bullish/positive/negative/fud)
```

If no Rettiwt credentials are configured, the server automatically runs tweet
monitoring in **demo mode**: it generates synthetic sample posts on a timer so
you can try the whole pipeline (dashboard, WebSocket updates, Telegram alerts)
before wiring up real credentials. Big-buy detection has its own independent
demo mode, active whenever `HELIUS_WEBHOOK_AUTH_HEADER` isn't set.

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

#### Helius (on-chain big-buy/sell detection)

Helius has a genuine free tier (unlike Solscan's Pro API, which is paid-only)
and pushes events to CREDAR the instant a swap happens, instead of polling.

1. Sign up free at [helius.dev](https://helius.dev) (no card needed for the free tier).
2. In the dashboard, go to **Webhooks** → **Create Webhook**:
   - **Webhook URL**: `https://<your-service>.onrender.com/api/webhooks/helius`
   - **Transaction Type(s)**: `SWAP`
   - **Account Address(es)**: the contract address, `CREDBHvVqREBCAxMihzr8D1nepHMr2gmQoZWpmgGmeta`
   - **Webhook Type**: `Enhanced`
   - **Auth Header**: make up a random secret string (e.g. generate one with
     `openssl rand -hex 32`) - Helius will echo it back on every delivery so
     CREDAR can verify requests are really from Helius.
3. Put that same secret in `HELIUS_WEBHOOK_AUTH_HEADER` in `server/.env` (or
   as a Render env var).

With that set, every SWAP transaction touching the contract address gets
POSTed to CREDAR, which works out which side of the swap is $CRED and treats
it as a **buy** whenever the tracked wallet (the transaction's fee payer)
receives $CRED, or a **sell** whenever it gives $CRED up. Swaps priced in
SOL, USDC, or USDT get a real USD value (SOL's price comes from Jupiter's
free public Price API, cached for a few minutes); swaps against anything
else fall back to a raw-token-amount threshold (`BIG_BUY_MIN_TOKENS`,
disabled by default). The same threshold (`BIG_BUY_MIN_USD`, default `500`)
applies to both buys and sells - a big sell is just as worth flagging as a
big buy of the same size.

Both direct DEX swaps and aggregator-routed swaps (e.g. via Jupiter) show up
as `SWAP` transactions in Helius, so both are covered.

Leave `HELIUS_WEBHOOK_AUTH_HEADER` blank to run big-buy detection in demo mode
with synthetic swaps instead.

#### Sentiment analysis (optional, free)

CREDAR can classify every real (non-demo) tweet's sentiment into **bullish,
positive, negative, or FUD** using the [Gemini API](https://aistudio.google.com),
show a live **sentiment meter** (a 0-100 gauge, like a crypto "Fear & Greed"
index) for the past 24 hours / 3 days / 7 days, and chart the breakdown over
the last 7 days.

**Getting a free Gemini API key (no credit card required):**

1. Go to [aistudio.google.com](https://aistudio.google.com) and sign in with
   a Google account.
2. Click **Get API key** (top left or in the left sidebar) → **Create API
   key**.
3. Copy the key and put it in `GEMINI_API_KEY` in `server/.env` (or as a
   Render env var).

That's it - no billing setup, no card. Gemini's free tier covers
`gemini-2.5-flash-lite` (the model CREDAR uses) at a request-per-day and
request-per-minute cap that Google adjusts periodically - check your
[AI Studio dashboard](https://aistudio.google.com) for the current numbers,
but it's comfortably enough for a project at this scale. One caveat: on the
free tier, Google may use submitted content to improve their products (this
only applies to tweet text, which is already public).

Classification runs in a slow background sweep (one tweet every ~8 seconds)
rather than inline as tweets are ingested or all at once. Some accounts see
a free-tier daily quota as low as **~20 requests/day** for
`gemini-2.5-flash-lite` - far too low to ever backfill a large tweet
history - so rather than endlessly queuing an unreachable backlog, only the
most recent `SENTIMENT_WINDOW_SIZE` (default `20`) real tweets are ever
considered for classification. Anything older is intentionally left
unclassified. Demo tweets are never classified, so demo mode never touches
the API. On a quota error, the sweep backs off exponentially (up to 30
minutes) instead of retrying every 8 seconds and burning through the next
reset's allowance.

If your account has a higher quota (check `GET
/api/admin/sentiment-debug`), or you've enabled Google Cloud billing for a
much higher Tier 1 limit (still typically just a few dollars/month at this
volume, pay-per-token, no subscription), raise `SENTIMENT_WINDOW_SIZE`
accordingly.

Leave `GEMINI_API_KEY` blank to disable sentiment analysis entirely - the
meter, chart, and badges simply don't appear.

#### Admin: is Gemini actually working?

If the sentiment meter keeps showing "No data yet" longer than expected,
visit (with the same `ADMIN_TOKEN` as above):

```
https://<your-service>.onrender.com/api/admin/sentiment-debug?token=<your ADMIN_TOKEN>
```

This makes one real test call to Gemini and reports whether it actually
succeeded - not just "is a key configured," but "does it authenticate and
respond right now" - along with the exact error message if it doesn't (e.g.
an invalid key, or a rate-limit/quota error), plus how many tweets within
the current `SENTIMENT_WINDOW_SIZE` window are classified vs. still
pending, so you can tell backfill progress from a genuine failure.

#### Database (optional, for persistence across redeploys)

By default CREDAR stores everything in a local SQLite file
(`server/data/credar.db`) — zero setup, works great for local dev. The
tradeoff: on a host with an ephemeral filesystem (like Render's free plan),
that file resets on every redeploy/restart.

To keep tracked tweets/accounts across redeploys for free, create a
[Turso](https://turso.tech) database (libSQL — wire-compatible with SQLite,
generous free tier, no credit card):

```bash
# after installing the Turso CLI and logging in (turso auth login)
turso db create credar
turso db show credar --url                # -> DATABASE_URL
turso db tokens create credar              # -> DATABASE_AUTH_TOKEN
```

Put those two values in `DATABASE_URL` / `DATABASE_AUTH_TOKEN` in
`server/.env` (or as Render env vars). Leave both unset to keep using the
local file.

#### What CREDAR tracks

The defaults match `$CRED` / `@crediblefin` / the CA above. Override with
`SEARCH_TERMS` (comma-separated, OR'd together) if you want to track
additional terms.

The first time CREDAR runs (no stored cursor yet), it backfills mentions
from up to `BACKFILL_DAYS` ago (default `7`) instead of only catching tweets
posted after that first run - X/Twitter's search only goes back about 7 days
regardless of this setting, so that's the practical ceiling. After the
initial catch-up, it resumes from the newest tweet seen on every subsequent
poll, so nothing is missed between polls or across restarts.

#### Admin: forcing a fresh backfill

Backfill only runs when there's no stored cursor at all - if the app ever
ran live even briefly before you read this, it already saved a cursor from
that run, and won't backfill again on its own. To force it:

1. Set `ADMIN_TOKEN` to a secret you invent (e.g. `openssl rand -hex 16`).
2. After it's deployed, visit this URL in any browser:
   ```
   https://<your-service>.onrender.com/api/admin/reset-tweet-cursor?token=<your ADMIN_TOKEN>
   ```
3. You'll see a confirmation message. Within ~30 seconds (one poll cycle),
   the server logs will show `no prior cursor - backfilling up to 7 day(s)
   of mentions`, and the dashboard will fill in with historical mentions.

#### Admin: debugging missing big buys/sells

If real on-chain trades aren't showing up on the dashboard, visit (with the
same `ADMIN_TOKEN` as above):

```
https://<your-service>.onrender.com/api/admin/webhook-debug?token=<your ADMIN_TOKEN>
```

This shows the last ~30 transactions Helius actually delivered to the
webhook, and exactly why each one was or wasn't recorded - e.g. `type=TRANSFER
(not SWAP)`, `below the $500 threshold`, or `recorded: buy of $612.40`. If
`recentDeliveries` is empty even after a real trade happens, Helius isn't
reaching the endpoint at all - double check the webhook URL, that its
Transaction Type is set to `SWAP`, and that the Auth Header matches
`HELIUS_WEBHOOK_AUTH_HEADER` exactly (check `lastAuthFailureAt` here too).

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
   - `HELIUS_WEBHOOK_AUTH_HEADER` — see the Helius setup above (omit to stay in chain demo mode)
   - `DATABASE_URL` / `DATABASE_AUTH_TOKEN` — see the Turso setup above. **Set
     these on Render**, since without them CREDAR falls back to a local
     SQLite file, which the free plan wipes on every redeploy/restart.
   - `SEARCH_TERMS` / `DEMO_MODE` if you want to override the defaults
   - `ADMIN_TOKEN` — a secret of your choosing, lets you force a fresh backfill later (see above)

`render.yaml` is set to the **free** plan, which has one tradeoff worth
knowing about: free web services sleep after 15 minutes with no inbound
traffic, and take about a minute to wake back up on the next request. While
asleep, CREDAR isn't polling for new mentions. To keep it running
continuously at no cost, set up an external uptime pinger (below).

Using Turso for `DATABASE_URL` (rather than the default local file) is what
makes tracked tweets/accounts survive redeploys on the free plan — the free
plan's filesystem itself is still ephemeral, but the database now lives
outside it.

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
| `GET /api/big-buys` | Recent on-chain big buys/sells (`?limit=`)   |
| `GET /api/accounts` | Account leaderboard by mention count (`?limit=`) |
| `GET /api/stats`    | Totals, hourly/daily volume, match + sentiment breakdown |
| `GET /api/price`    | Live $CRED/USD price (via Jupiter)           |
| `GET /api/config`   | Public config (tracked terms, alert status)  |
| `WS /ws`            | Live push of each newly discovered post/big buy/sell/sentiment |
| `POST /api/webhooks/helius` | Helius webhook delivery target (see setup above) |
| `GET /api/admin/reset-tweet-cursor` | Forces a fresh 7-day backfill (`?token=` must match `ADMIN_TOKEN`) |
| `GET /api/admin/webhook-debug` | Last ~30 Helius webhook deliveries + why each was/wasn't recorded (`?token=` must match `ADMIN_TOKEN`) |
| `GET /api/admin/sentiment-debug` | Live Gemini connectivity test + classification backfill progress (`?token=` must match `ADMIN_TOKEN`) |
