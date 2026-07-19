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

      {/* 14-day bar chart */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Visits, last 14 days</h2>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-end gap-2 h-40">
            {daily.map((d) => {
              const h = (d.total / maxDaily) * 100;
              const bh = d.total > 0 ? (d.blocked / d.total) * h : 0;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.total} visits, ${d.blocked} blocked`}>
                  <div className="w-full relative bg-white/10 rounded-t" style={{ height: `${h}%`, minHeight: d.total > 0 ? 2 : 0 }}>
                    <div className="absolute bottom-0 left-0 right-0 bg-red-500/70 rounded-t" style={{ height: `${(bh / h) * 100 || 0}%` }} />
                    <div className="absolute inset-0 bg-fuchsia-500/60 rounded-t" style={{ opacity: d.total > 0 ? 0.9 : 0 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-white/40">
            <span>{daily[0]?.date}</span>
            <span>{daily[daily.length - 1]?.date}</span>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-white/60">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-fuchsia-500/80 rounded-sm" /> Visits</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-500/70 rounded-sm" /> Blocked (adblock verdict)</span>
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
