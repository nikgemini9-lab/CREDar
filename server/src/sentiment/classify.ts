import { GoogleGenAI, Type } from "@google/genai";
import { config } from "../config.js";
import type { Sentiment } from "../types.js";

const client = config.geminiApiKey ? new GoogleGenAI({ apiKey: config.geminiApiKey }) : null;

const SENTIMENTS = new Set<Sentiment>(["bullish", "positive", "negative", "fud"]);

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    sentiment: {
      type: Type.STRING,
      enum: ["bullish", "positive", "negative", "fud"],
      description:
        "bullish: enthusiastic, price-positive, actively promoting/hyping the token. " +
        "positive: generally favorable or supportive, without hype. " +
        "negative: generally unfavorable, critical, or skeptical. " +
        "fud: fear/uncertainty/doubt - alarmist, spreading rumors of a scam, rug pull, or collapse.",
    },
  },
  required: ["sentiment"],
};

const PROMPT_PREFIX =
  "You classify the sentiment of social media posts about a cryptocurrency token called $CRED " +
  '(CredibleFin). Interpret crypto slang and context (e.g. "wagmi", "rug", "ngmi", "aping in", ' +
  '"diamond hands").\n\nPost:\n';

export async function classifySentiment(text: string): Promise<Sentiment | null> {
  if (!client) return null;
  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: PROMPT_PREFIX + text,
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const parsed = JSON.parse(response.text ?? "{}") as { sentiment?: string };
    const sentiment = parsed.sentiment;
    return sentiment && SENTIMENTS.has(sentiment as Sentiment) ? (sentiment as Sentiment) : null;
  } catch (err) {
    console.error("[sentiment] classification failed:", err);
    return null;
  }
}
