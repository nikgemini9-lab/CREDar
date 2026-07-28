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

let lastError: { at: string; message: string } | undefined;

export function getLastClassifyError(): { at: string; message: string } | undefined {
  return lastError;
}

/** Does the actual Gemini call + parse. Throws on any failure - callers decide whether to swallow it. */
async function callGemini(text: string): Promise<Sentiment> {
  if (!client) throw new Error("GEMINI_API_KEY not set");

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
  if (!sentiment || !SENTIMENTS.has(sentiment as Sentiment)) {
    throw new Error(`unexpected response: ${response.text}`);
  }
  return sentiment as Sentiment;
}

export async function classifySentiment(text: string): Promise<Sentiment | null> {
  if (!client) return null;
  try {
    return await callGemini(text);
  } catch (err) {
    lastError = { at: new Date().toISOString(), message: err instanceof Error ? err.message : String(err) };
    console.error("[sentiment] classification failed:", err);
    return null;
  }
}

/**
 * Live connectivity check for the GET /api/admin/sentiment-debug endpoint -
 * makes one real Gemini call and reports success/failure with the actual
 * error message, rather than the silent null that classifySentiment returns
 * during normal operation.
 */
export async function pingGemini(): Promise<
  { ok: true; sentiment: Sentiment; latencyMs: number } | { ok: false; error: string; latencyMs: number }
> {
  const startedAt = Date.now();
  if (!client) {
    return { ok: false, error: "GEMINI_API_KEY not set", latencyMs: 0 };
  }
  try {
    const sentiment = await callGemini("wagmi $CRED to the moon, best token ever");
    return { ok: true, sentiment, latencyMs: Date.now() - startedAt };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - startedAt };
  }
}
