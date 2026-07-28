const SOL_MINT = "So11111111111111111111111111111111111111112";
const PRICE_TTL_MS = 60_000;

const priceCache = new Map<string, { value: number; fetchedAt: number }>();

/**
 * Live USD price for any SPL token mint from Jupiter's free public Price API
 * (no key required), cached for a minute per mint. Returns undefined if the
 * lookup fails or Jupiter has no price for the mint (e.g. no tracked
 * liquidity) - callers should fall back to "unpriced" rather than break.
 */
export async function getTokenPriceUsd(mint: string): Promise<number | undefined> {
  const cached = priceCache.get(mint);
  if (cached && Date.now() - cached.fetchedAt < PRICE_TTL_MS) {
    return cached.value;
  }

  try {
    const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mint}`);
    if (!res.ok) throw new Error(`Jupiter price API -> ${res.status}`);

    const body = (await res.json()) as Record<string, unknown>;
    // Price API v3 keys the response by mint at the top level (no `data`
    // wrapper) and the price field is `usdPrice` - NOT `price` (that was an
    // older API version's field name and doesn't exist in v3 responses).
    const entry = (body.data as Record<string, unknown> | undefined)?.[mint] ?? body[mint];
    const price = Number((entry as { usdPrice?: number | string } | undefined)?.usdPrice);

    if (!Number.isFinite(price)) throw new Error("unexpected response shape");

    priceCache.set(mint, { value: price, fetchedAt: Date.now() });
    return price;
  } catch (err) {
    console.error(`[helius] failed to fetch price for ${mint} from Jupiter:`, err);
    return cached?.value;
  }
}

export async function getSolPriceUsd(): Promise<number | undefined> {
  return getTokenPriceUsd(SOL_MINT);
}
