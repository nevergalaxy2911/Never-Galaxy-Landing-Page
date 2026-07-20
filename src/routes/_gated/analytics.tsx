/**
 * /analytics, admin-only analytics dashboard.
 * Visits totals, 14-day sparkline, top paths, recent system events.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getAnalyticsSummary } from "@/lib/analytics.functions";

export const Route = createFileRoute("/_gated/analytics")({
  component: AnalyticsPage,
});

type Summary = Awaited<ReturnType<typeof getAnalyticsSummary>>;

function AnalyticsPage() {
  const load = useServerFn(getAnalyticsSummary);
  const [s, setS] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    load().then((r) => {
      if (!r.ok) setErr(r.reason ?? "Failed to load analytics");
      setS(r);
    }).catch((e) => setErr((e as Error).message));
  }, [load]);

  if (err) return <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200 text-sm">{err}</div>;
  if (!s) return <p className="text-white/50 text-sm">Loading analytics…</p>;
  if (!s.ok) return <p className="text-white/50 text-sm">{s.reason}</p>;

  const { totals, daily, topPaths, events } = s;
  const maxDaily = Math.max(1, ...daily.map((d) => d.total));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      {/* Totals */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Visits (24h)" value={totals.day} />
        <Stat label="Visits (7d)" value={totals.week} />
        <Stat label="Visits (30d)" value={totals.month} accent />
        <Stat label="Blocked (30d)" value={totals.blocked} />
        <Stat label="Block rate" value={`${totals.blockRate}%`} />
      </section>

      {/* 14-day chart — smooth area line + subtle grid + hover tooltips.
          Uses SVG for crisp scaling and precise proportions. */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-semibold">Visits, last 14 days</h2>
          <span className="text-xs text-white/50 tabular-nums">
            Peak {maxDaily} · Avg {Math.round(daily.reduce((a, d) => a + d.total, 0) / Math.max(1, daily.length))}
          </span>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <VisitsChart daily={daily} maxDaily={maxDaily} />
          <div className="flex justify-between mt-2 text-[10px] text-white/40 tabular-nums">
            <span>{daily[0]?.date}</span>
            <span>{daily[Math.floor(daily.length / 2)]?.date}</span>
            <span>{daily[daily.length - 1]?.date}</span>
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-white/60">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gradient-to-b from-fuchsia-400 to-fuchsia-600" /> Visits</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500/70" /> Blocked</span>
          </div>
        </div>
      </section>

      {/* Top paths */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Top paths (30d)</h2>
        <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/10">
          {topPaths.length === 0 && <p className="px-4 py-6 text-white/50 text-sm text-center">No visits recorded yet.</p>}
          {topPaths.map((p) => (
            <div key={p.path} className="flex items-center px-4 py-2.5 text-sm">
              <code className="text-fuchsia-300 flex-1 truncate">{p.path}</code>
              <span className="text-white/60 tabular-nums">{p.count}</span>
            </div>
          ))}
        </div>
      </section>

      {/* System events */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recent activity</h2>
        <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/10 max-h-96 overflow-auto">
          {events.length === 0 && <p className="px-4 py-6 text-white/50 text-sm text-center">No events yet.</p>}
          {events.map((e, i) => (
            <div key={i} className="px-4 py-2 text-xs flex items-center gap-3">
              <span className="text-fuchsia-300 font-mono">{e.kind}</span>
              <span className="text-white/40 flex-1 truncate">{JSON.stringify(e.payload)}</span>
              <span className="text-white/40 tabular-nums">{new Date(e.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-fuchsia-500/40 bg-fuchsia-500/10" : "border-white/10 bg-white/5"}`}>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-white/60 mt-1">{label}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * VisitsChart — SVG area+line for smooth reading, plus stacked "blocked"
 * markers. Uses viewBox for crisp scaling on any width; horizontal grid
 * lines quantise the eye; hover shows date + counts via native <title>.
 * ------------------------------------------------------------------------- */
function VisitsChart({ daily, maxDaily }: { daily: { date: string; total: number; blocked: number }[]; maxDaily: number }) {
  const W = 700, H = 180, PAD_L = 32, PAD_R = 8, PAD_T = 10, PAD_B = 20;
  const iw = W - PAD_L - PAD_R;
  const ih = H - PAD_T - PAD_B;
  const n = Math.max(1, daily.length);
  const step = iw / Math.max(1, n - 1);
  const y = (v: number) => PAD_T + ih - (v / maxDaily) * ih;
  const x = (i: number) => PAD_L + i * step;

  const pts = daily.map((d, i) => `${x(i)},${y(d.total)}`).join(" ");
  const area = `${PAD_L},${PAD_T + ih} ${pts} ${x(n - 1)},${PAD_T + ih}`;

  // 4 gridlines including baseline
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxDaily * f));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44" role="img" aria-label="Daily visits and blocked visits, last 14 days">
      <defs>
        <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="rgb(232 121 249)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="rgb(232 121 249)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Gridlines + Y labels */}
      {gridVals.map((v, i) => {
        const gy = y(v);
        return (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={gy} y2={gy} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <text x={PAD_L - 6} y={gy + 3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.4)" className="tabular-nums">{v}</text>
          </g>
        );
      })}

      {/* Filled area under the visits line */}
      <polygon points={area} fill="url(#visitsFill)" />

      {/* Visits polyline */}
      <polyline points={pts} fill="none" stroke="rgb(232 121 249)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {/* Blocked markers (small red dots stacked at the same x) */}
      {daily.map((d, i) => d.blocked > 0 ? (
        <circle key={`b-${i}`} cx={x(i)} cy={y(d.blocked)} r={3} fill="rgb(239 68 68)" opacity={0.85}>
          <title>{`${d.date}: ${d.blocked} blocked`}</title>
        </circle>
      ) : null)}

      {/* Visit points + hover targets */}
      {daily.map((d, i) => (
        <g key={`p-${i}`}>
          <circle cx={x(i)} cy={y(d.total)} r={2.5} fill="rgb(232 121 249)" />
          {/* Wide invisible target for hover tooltips */}
          <rect x={x(i) - step / 2} y={PAD_T} width={step} height={ih} fill="transparent">
            <title>{`${d.date}\n${d.total} visits · ${d.blocked} blocked`}</title>
          </rect>
        </g>
      ))}
    </svg>
  );
}
