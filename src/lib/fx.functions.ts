import { createServerFn } from "@tanstack/react-start";

/* -----------------------------------------------------------------------------
 * FX rates — fetches live INR-based exchange rates from open.er-api.com.
 * The endpoint is free, key-less, and returns ~160 currencies.
 *
 * We cache in a module-level object with a 1h TTL so page loads don't hammer
 * the upstream API. Cloudflare Worker isolates share this cache per instance,
 * which is more than enough for a marketing site.
 *
 * HOW TO MODIFY:
 *   - Change `BASE` if your pricing base currency ever moves off INR.
 *   - Change `TTL_MS` to cache rates longer or shorter.
 *   - Swap the provider by editing the fetch URL — response must expose
 *     `{ rates: { <ISO>: <rate vs BASE> } }`.
 * --------------------------------------------------------------------------- */

const BASE = "INR" as const;
const TTL_MS = 60 * 60 * 1000; // 1 hour

type FxPayload = {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number; // epoch ms
};

let cache: FxPayload | null = null;

export const getFxRates = createServerFn({ method: "GET" }).handler(
  async (): Promise<FxPayload> => {
    if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache;

    const res = await fetch(`https://open.er-api.com/v6/latest/${BASE}`);
    if (!res.ok) {
      // On upstream failure, keep the last good cache if we have one.
      if (cache) return cache;
      throw new Error(`FX fetch failed: ${res.status}`);
    }
    const json = (await res.json()) as {
      result?: string;
      base_code?: string;
      rates?: Record<string, number>;
    };
    if (json.result !== "success" || !json.rates) {
      if (cache) return cache;
      throw new Error("FX response malformed");
    }
    cache = {
      base: json.base_code ?? BASE,
      rates: json.rates,
      fetchedAt: Date.now(),
    };
    return cache;
  },
);
