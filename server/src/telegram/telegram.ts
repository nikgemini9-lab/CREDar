import { config } from "../config.js";
import type { TweetRecord } from "../types.js";

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

function formatAlert(tweet: TweetRecord): string {
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

export async function sendTelegramAlert(tweet: TweetRecord): Promise<void> {
  if (!config.telegramBotToken || !config.telegramChatId) return;

  const apiUrl = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: formatAlert(tweet),
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
