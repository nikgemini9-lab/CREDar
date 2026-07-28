import { Rettiwt } from "rettiwt-api";
import { config } from "../config.js";

export function createRettiwtClient(): Rettiwt {
  return new Rettiwt({ apiKey: config.rettiwtApiKey });
}
