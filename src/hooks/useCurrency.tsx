import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getFxRates } from "@/lib/fx.functions";

/* -----------------------------------------------------------------------------
 * useCurrency, global currency selector for the whole site.
 *
 * Pricing is authored in INR (see Pricing.tsx). This provider:
 *   1. Fetches live INR-based FX rates via a TanStack server function
 *      (`getFxRates`) which caches upstream for 1h.
 *   2. Exposes the selected currency + a `format(inr)` helper that returns a
 *      display-ready string in the chosen currency, rounded UP to the next
 *      `.99` (per the project's pricing rule).
 *   3. Persists the user's choice in `localStorage` so it survives reloads.
 *
 * HOW TO MODIFY:
 *   - Add/remove currencies: edit CURRENCIES below (label + symbol + locale).
 *   - Change base currency: also update BASE in `src/lib/fx.functions.ts`.
 *   - Change rounding: edit `roundToNext99()` below.
 *   - Default currency: STORAGE_DEFAULT.
 * --------------------------------------------------------------------------- */

export type Currency = {
  code: string;   // ISO 4217, e.g. "INR", "USD"
  label: string;  // Menu label
  symbol: string; // Prefix symbol used in the formatted output
  locale: string; // BCP 47 locale for number grouping (thousands separators)
};

// Major world currencies. First entry is the base and always uses rate=1.
export const CURRENCIES: Currency[] = [
  { code: "INR", label: "Indian Rupee",     symbol: "₹",    locale: "en-IN" },
  { code: "USD", label: "US Dollar",        symbol: "$",    locale: "en-US" },
  { code: "EUR", label: "Euro",             symbol: "€",    locale: "de-DE" },
  { code: "GBP", label: "British Pound",    symbol: "£",    locale: "en-GB" },
  { code: "JPY", label: "Japanese Yen",     symbol: "¥",    locale: "ja-JP" },
  { code: "CNY", label: "Chinese Yuan",     symbol: "¥",    locale: "zh-CN" },
  { code: "AUD", label: "Australian Dollar",symbol: "A$",   locale: "en-AU" },
  { code: "CAD", label: "Canadian Dollar",  symbol: "C$",   locale: "en-CA" },
  { code: "CHF", label: "Swiss Franc",      symbol: "CHF ", locale: "de-CH" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$",   locale: "en-SG" },
  { code: "HKD", label: "Hong Kong Dollar", symbol: "HK$",  locale: "en-HK" },
  { code: "NZD", label: "NZ Dollar",        symbol: "NZ$",  locale: "en-NZ" },
  { code: "AED", label: "UAE Dirham",       symbol: "AED ", locale: "en-AE" },
  { code: "SAR", label: "Saudi Riyal",      symbol: "SAR ", locale: "en-SA" },
  { code: "KRW", label: "South Korean Won", symbol: "₩",    locale: "ko-KR" },
  { code: "ZAR", label: "South African Rand", symbol: "R",  locale: "en-ZA" },
  { code: "BRL", label: "Brazilian Real",   symbol: "R$",   locale: "pt-BR" },
  { code: "MXN", label: "Mexican Peso",     symbol: "Mex$", locale: "es-MX" },
  { code: "SEK", label: "Swedish Krona",    symbol: "kr ",  locale: "sv-SE" },
  { code: "NOK", label: "Norwegian Krone",  symbol: "kr ",  locale: "nb-NO" },
  { code: "DKK", label: "Danish Krone",     symbol: "kr ",  locale: "da-DK" },
  { code: "PLN", label: "Polish Zloty",     symbol: "zł ",  locale: "pl-PL" },
  { code: "TRY", label: "Turkish Lira",     symbol: "₺",    locale: "tr-TR" },
  { code: "RUB", label: "Russian Ruble",    symbol: "₽",    locale: "ru-RU" },
  { code: "THB", label: "Thai Baht",        symbol: "฿",    locale: "th-TH" },
  { code: "IDR", label: "Indonesian Rupiah",symbol: "Rp ",  locale: "id-ID" },
  { code: "MYR", label: "Malaysian Ringgit",symbol: "RM ",  locale: "ms-MY" },
  { code: "PHP", label: "Philippine Peso",  symbol: "₱",    locale: "en-PH" },
  { code: "VND", label: "Vietnamese Dong",  symbol: "₫",    locale: "vi-VN" },
];

const STORAGE_KEY = "ng.currency";
const STORAGE_DEFAULT = "USD";

/* -----------------------------------------------------------------------------
 * niceRound, tiered "attractive but fair" price rounder.
 *   • x < 10       → next whole X.99          (e.g. 4.2  → 4.99,  7 → 7.99)
 *   • x < 100      → next 5-step ending .99   (e.g. 13.5 → 14.99, 22 → 24.99)
 *   • x < 1000     → next 10-step ending 9    (e.g. 516  → 519,  832 → 839)
 *   • x >= 1000    → next 100-step ending 99  (e.g. 1314 → 1399, 4820 → 4899)
 * Returns both the rounded value and the display decimal count so large
 * amounts render as clean integers (1,399) instead of ugly 1,314.99.
 * HOW TO MODIFY: retune the breakpoints/steps below.
 * --------------------------------------------------------------------------- */
export function niceRound(x: number): { value: number; decimals: number } {
  if (x < 10)   return { value: Math.ceil(x + 0.01) - 0.01,               decimals: 2 };
  if (x < 100)  return { value: Math.ceil((x + 0.01) / 5) * 5 - 0.01,     decimals: 2 };
  if (x < 1000) return { value: Math.ceil((x + 1) / 10) * 10 - 1,         decimals: 0 };
  return           { value: Math.ceil((x + 1) / 100) * 100 - 1,           decimals: 0 };
}


type CurrencyCtx = {
  currency: Currency;
  setCurrencyCode: (code: string) => void;
  currencies: Currency[];
  /** Convert an INR amount to the selected currency + format with symbol. */
  format: (inr: number) => string;
  /** True once live FX rates have loaded (INR always renders even before). */
  ready: boolean;
};

const Ctx = createContext<CurrencyCtx | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<string>(STORAGE_DEFAULT);
  const [rates, setRates] = useState<Record<string, number> | null>(null);

  // Hydrate saved choice from localStorage (client-only).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && CURRENCIES.some((c) => c.code === saved)) setCode(saved);
    } catch {
      /* ignore storage errors (private mode, etc.) */
    }
  }, []);

  // Fetch live FX rates once on mount.
  useEffect(() => {
    let cancelled = false;
    getFxRates()
      .then((res) => {
        if (!cancelled) setRates(res.rates);
      })
      .catch((err) => {
        // Non-fatal, INR keeps working, other currencies just wait/retry.
        console.warn("FX rates failed to load", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setCurrencyCode = (next: string) => {
    if (!CURRENCIES.some((c) => c.code === next)) return;
    setCode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const value = useMemo<CurrencyCtx>(() => {
    const currency = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
    const rate = code === "INR" ? 1 : rates?.[code] ?? null;

    const format = (inr: number) => {
      if (rate == null) {
        // Rates not loaded yet for non-INR → fall back to INR display.
        return `${CURRENCIES[0].symbol}${new Intl.NumberFormat("en-IN", {
          maximumFractionDigits: 0,
        }).format(Math.round(inr))}`;
      }
      const { value: converted, decimals } = niceRound(inr * rate);
      const nf = new Intl.NumberFormat(currency.locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      return `${currency.symbol}${nf.format(converted)}`;

    };

    return {
      currency,
      setCurrencyCode,
      currencies: CURRENCIES,
      format,
      ready: code === "INR" || rates != null,
    };
  }, [code, rates]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCurrency() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCurrency must be used inside <CurrencyProvider>");
  return ctx;
}
