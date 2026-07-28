import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import type { Sentiment } from "../types.js";

const client = config.anthropicApiKey ? new Anthropic({ apiKey: config.anthropicApiKey }) : null;

const CLASSIFY_TOOL: Anthropic.Tool = {
  name: "classify_sentiment",
  description: "Record the sentiment classification of a crypto-related social media post.",
  input_schema: {
    type: "object",
    properties: {
      sentiment: {
        type: "string",
        enum: ["bullish", "positive", "negative", "fud"],
        description:
          "bullish: enthusiastic, price-positive, actively promoting/hyping the token. " +
          "positive: generally favorable or supportive, without hype. " +
          "negative: generally unfavorable, critical, or skeptical. " +
          "fud: fear/uncertainty/doubt - alarmist, spreading rumors of a scam, rug pull, or collapse.",
      },
    },
    required: ["sentiment"],
  },
};

const SENTIMENTS = new Set<Sentiment>(["bullish", "positive", "negative", "fud"]);

export async function classifySentiment(text: string): Promise<Sentiment | null> {
  if (!client) return null;
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 128,
      system:
        "You classify the sentiment of social media posts about a cryptocurrency token called $CRED " +
        '(CredibleFin). Interpret crypto slang and context (e.g. "wagmi", "rug", "ngmi", "aping in", ' +
        '"diamond hands").',
      messages: [{ role: "user", content: text }],
      tools: [CLASSIFY_TOOL],
      tool_choice: { type: "tool", name: "classify_sentiment" },
    });

    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const sentiment = (toolUse?.input as { sentiment?: string } | undefined)?.sentiment;
    return sentiment && SENTIMENTS.has(sentiment as Sentiment) ? (sentiment as Sentiment) : null;
  } catch (err) {
    console.error("[sentiment] classification failed:", err);
    return null;
  }
}
