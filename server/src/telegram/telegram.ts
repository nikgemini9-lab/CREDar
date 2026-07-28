import { config } from "../config.js";
import type { BigBuyRecord, TweetRecord } from "../types.js";

const MATCH_LABELS: Record<string, string> = {
  cashtag: "$CRED",
  mention: "@crediblefin",
  contract: "CA",
  keyword: "keyword",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatTweetAlert(tweet: TweetRecord): string {
  const tags = tweet.matches.map((m) => MATCH_LABELS[m] ?? m).join(", ");
  const excerpt = tweet.text.length > 400 ? `${tweet.text.slice(0, 400)}…` : tweet.text;

  return [
    `🛰️ <b>CREDAR alert</b> — matched: ${escapeHtml(tags)}`,
    `<b>@${escapeHtml(tweet.authorUsername)}</b> (${escapeHtml(tweet.authorName)}, ${tweet.authorFollowers.toLocaleString()} followers)`,
    "",
    escapeHtml(excerpt),
    "",
    `❤️ ${tweet.likeCount}  🔁 ${tweet.retweetCount}  💬 ${tweet.replyCount}`,
    tweet.url,
  ].join("\n");
}

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function formatBigBuyAlert(buy: BigBuyRecord): string {
  const sizeLabel =
    buy.usdValue !== null
      ? `$${buy.usdValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : `${buy.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} $CRED`;
  const verb = buy.side === "sell" ? "sell" : "buy";

  return [
    `🐋 <b>Big ${verb} on $CRED</b> — ${sizeLabel}`,
    `${buy.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} $CRED for ${buy.counterAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${escapeHtml(buy.counterSymbol)}`,
    `Wallet: <code>${shortAddress(buy.walletAddress)}</code>`,
    buy.platform.length > 0 ? `Via: ${escapeHtml(buy.platform.join(", "))}` : "",
    `https://solscan.io/tx/${buy.txId}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendTelegramMessage(text: string): Promise<void> {
  if (!config.telegramBotToken || !config.telegramChatId) return;

  const apiUrl = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[telegram] failed to send alert (${res.status}): ${body}`);
    }
  } catch (err) {
    console.error("[telegram] failed to send alert:", err);
  }
}

export async function sendTelegramAlert(tweet: TweetRecord): Promise<void> {
  await sendTelegramMessage(formatTweetAlert(tweet));
}

export async function sendBigBuyAlert(buy: BigBuyRecord): Promise<void> {
  await sendTelegramMessage(formatBigBuyAlert(buy));
}
