/**
 * AnnouncementBar — thin sticky banner at the top of the public site, driven
 * by the `announcement_bar` feature flag. Flag shape:
 *   enabled: boolean
 *   value:   { text: string, href?: string, tone?: "info" | "warn" | "promo" }
 *
 * Toggled from /api-panel → Announcement Bar. Dismissible per-visitor via
 * localStorage (`ng-ann-dismissed` = flag updated_at hash), so editing the
 * text re-shows it to everyone.
 */
import { useEffect, useState } from "react";
import { getPublicFlag } from "@/lib/public-flags.functions";

type AnnValue = { text?: string; href?: string; tone?: "info" | "warn" | "promo" };

const DISMISS_KEY = "ng-ann-dismissed";

export function AnnouncementBar() {
  const [state, setState] = useState<{ text: string; href?: string; tone: string; sig: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        const r = await getPublicFlag({ data: { key: "announcement_bar" } });
        if (cancelled || r.enabled !== true) return;
        const v = (r.value ?? {}) as AnnValue;
        const text = (v.text ?? "").trim();
        if (!text) return;
        const sig = String(text.length) + ":" + text.slice(0, 24);
        try {
          if (localStorage.getItem(DISMISS_KEY) === sig) return;
        } catch { /* ignore */ }
        setState({ text, href: v.href, tone: v.tone ?? "info", sig });
      } catch { /* fail-silent */ }
    };
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(() => void boot(), { timeout: 1500 });
    else setTimeout(() => void boot(), 400);
    return () => { cancelled = true; };
  }, []);

  if (!state) return null;

  const toneClass =
    state.tone === "warn"  ? "from-amber-500/25 to-red-500/25 border-amber-400/30" :
    state.tone === "promo" ? "from-fuchsia-500/25 to-purple-500/25 border-fuchsia-400/30" :
                              "from-cyan-500/20 to-blue-500/20 border-cyan-400/30";

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, state.sig); } catch { /* ignore */ }
    setState(null);
  };

  const inner = (
    <span className="text-sm text-white/90">
      {state.text}
      {state.href && <span className="ml-2 underline text-white">Learn more →</span>}
    </span>
  );

  return (
    <div className={`sticky top-0 z-[80] w-full border-b bg-gradient-to-r ${toneClass} backdrop-blur-md`}>
      <div className="max-w-6xl mx-auto flex items-center gap-4 px-4 py-2">
        <div className="flex-1 text-center">
          {state.href
            ? <a href={state.href} target="_blank" rel="noopener noreferrer">{inner}</a>
            : inner}
        </div>
        <button
          onClick={dismiss}
          className="text-white/60 hover:text-white text-lg leading-none px-1"
          aria-label="Dismiss announcement"
        >×</button>
      </div>
    </div>
  );
}
