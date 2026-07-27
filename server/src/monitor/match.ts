import { config } from "../config.js";
import type { MatchKind } from "../types.js";

/** Determines which tracked terms a tweet's text actually matches, for labeling/telemetry. */
export function classifyMatches(text: string): MatchKind[] {
  const lower = text.toLowerCase();
  const matches: MatchKind[] = [];

  if (lower.includes(config.cashtag.toLowerCase())) {
    matches.push("cashtag");
  }
  if (lower.includes(config.handle.toLowerCase())) {
    matches.push("mention");
  }
  if (lower.includes(config.contractAddress.toLowerCase())) {
    matches.push("contract");
  }

  const knownTerms = [config.cashtag, config.handle, config.contractAddress].map((t) => t.toLowerCase());
  const extraTermHit = config.searchTerms.some(
    (term) => !knownTerms.includes(term.toLowerCase()) && lower.includes(term.toLowerCase()),
  );
  if (extraTermHit) {
    matches.push("keyword");
  }

  return matches.length > 0 ? matches : ["keyword"];
}
