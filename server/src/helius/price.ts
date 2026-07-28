const SOL_MINT = "So11111111111111111111111111111111111111112";
const PRICE_TTL_MS = 5 * 60_000;

let cachedSolPrice: { value: number; fetchedAt: number } | undefined;

/**
 * Live SOL/USD price from Jupiter's free public Price API (no key required),
 * cached for a few minutes. Returns undefined if the lookup fails - a swap
 * priced in SOL then falls back to "unpriced" rather than breaking anything.
 */
export async function getSolPriceUsd(): Promise<number | undefined> {
  if (cachedSolPrice && Date.now() - cachedSolPrice.fetchedAt < PRICE_TTL_MS) {
    return cachedSolPrice.value;
  }

  try {
    const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`);
    if (!res.ok) throw new Error(`Jupiter price API -> ${res.status}`);

    const body = (await res.json()) as Record<string, unknown>;
    // Defensive: Jupiter's price API has changed response shape across
    // versions (nested under `data`, or flat). Try both.
    const entry = (body.data as Record<string, unknown> | undefined)?.[SOL_MINT] ?? body[SOL_MINT];
    const price = Number((entry as { price?: number | string } | undefined)?.price);

    if (!Number.isFinite(price)) throw new Error("unexpected response shape");

    cachedSolPrice = { value: price, fetchedAt: Date.now() };
    return price;
  } catch (err) {
    console.error("[helius] failed to fetch SOL price from Jupiter:", err);
    return cachedSolPrice?.value;
  }
}
