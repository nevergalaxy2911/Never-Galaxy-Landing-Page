/**
 * /analytics, admin-only analytics dashboard.
 * Visits totals, 14-day sparkline, per-day drilldown (hourly chart + visit log
 * with exact times), top paths, portfolio clicks, recent system events.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, AlertCircle, Zap, Globe, MousePointer2, History, ArrowRight } from "lucide-react";
import { getAnalyticsSummary, getDayAnalytics } from "@/lib/analytics.functions";
import { getPortfolioClickStats } from "@/lib/portfolio-clicks.functions";

export const Route = createFileRoute("/_gated/analytics")({
  component: AnalyticsPage,
});

type Summary = Awaited<ReturnType<typeof getAnalyticsSummary>>;
type ClickStats = Awaited<ReturnType<typeof getPortfolioClickStats>>;

function AnalyticsPage() {
  const load = useServerFn(getAnalyticsSummary);
  const loadClicks = useServerFn(getPortfolioClickStats);
  const [s, setS] = useState<Summary | null>(null);
  const [clicks, setClicks] = useState<ClickStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    
    const run = async () => {
      try {
        const [sum, clickData] = await Promise.all([load(), loadClicks()]);
        if (cancelled) return;
        setS(sum);
        setClicks(clickData);
      } catch (e: any) {
        if (cancelled || e?.name === 'AbortError' || e?.message?.toLowerCase().includes('aborted')) return;
        setErr(e.message || "Failed to load neural analytics data.");
        console.error("[Analytics] Fetch Error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [load, loadClicks]);

  if (err) return (
    <div className="p-10">
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
        <h2 className="text-lg font-black uppercase text-white mb-2">Telemetry Failure</h2>
        <p className="text-sm text-white/40 mb-6">{err}</p>
        <button onClick={() => window.location.reload()} className="console-btn-primary">Reconnect Node</button>
      </div>
    </div>
  );

  if (loading || !s) return (
    <div className="p-10 space-y-8 animate-pulse">
      <div className="h-8 w-48 bg-white/5 rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({length: 5}).map((_, i) => <div key={i} className="h-24 bg-white/5 rounded-2xl" />)}
      </div>
      <div className="h-64 bg-white/5 rounded-2xl" />
    </div>
  );

  const { totals, daily, topPaths, events } = s;
  const maxDaily = Math.max(1, ...(daily || []).map((d) => d.total));

  return (
    <div className="w-full p-6 lg:p-10 space-y-10 animate-in fade-in duration-700">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-[#4CE4F8]/10 flex items-center justify-center text-[#4CE4F8] shadow-lg shadow-[#4CE4F8]/10">
          <BarChart3 size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest text-white">Neural Analytics</h1>
          <p className="text-[10px] text-white/30 uppercase tracking-tighter mt-1">Global Traffic & Interaction Intelligence</p>
        </div>
      </div>

      {/* Totals Grid */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Visits (24h)" value={totals?.day ?? 0} color="#A15CFD" />
        <Stat label="Visits (7d)" value={totals?.week ?? 0} color="#4CE4F8" />
        <Stat label="Visits (30d)" value={totals?.month ?? 0} accent color="#d946ef" />
        <Stat label="Blocked (30d)" value={totals?.blocked ?? 0} color="#f43f5e" />
        <Stat label="Block Rate" value={`${totals?.blockRate ?? 0}%`} color="#f59e0b" />
      </section>

      {/* 14-day chart */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-black uppercase tracking-widest">Visits, last 14 days</h2>
          <span className="text-[10px] text-white/30 font-black uppercase tracking-widest tabular-nums">
            Peak {maxDaily} · Avg {Math.round((daily || []).reduce((a, d) => a + d.total, 0) / Math.max(1, daily?.length ?? 0))}
          </span>
        </div>
        <div className="console-chart-card p-6 bg-white/[0.02]">
          <VisitsChart daily={daily || []} maxDaily={maxDaily} />
          <div className="flex justify-between mt-4 text-[10px] text-white/20 font-black uppercase tracking-widest tabular-nums px-2">
            <span>{daily?.[0]?.date}</span>
            <span>{daily?.[Math.floor((daily?.length ?? 0) / 2)]?.date}</span>
            <span>{daily?.[(daily?.length ?? 0) - 1]?.date}</span>
          </div>
          <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-white/5 px-2">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40">
              <span className="w-2 h-2 rounded-full bg-[#A15CFD] shadow-[0_0_8px_rgba(161,92,253,0.5)]" /> 
              Neural Visits
            </span>
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40">
              <span className="w-2 h-2 rounded-full bg-[#f43f5e] shadow-[0_0_8px_rgba(244,63,94,0.5)]" /> 
              Signal Blocked
            </span>
          </div>
        </div>
      </section>

      {/* Per-day drilldown */}
      <DayDrilldown />

      {/* Data Panels */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-[#4CE4F8]/10 text-[#4CE4F8]"><Globe size={18} /></div>
            <h2 className="text-sm font-black uppercase tracking-widest">Global Entry Points</h2>
          </div>
          <div className="console-chart-card p-0 overflow-hidden divide-y divide-white/5">
            {(!topPaths || topPaths.length === 0) && <p className="p-10 text-white/20 text-xs text-center uppercase tracking-widest font-black">No neural data</p>}
            {topPaths?.map((p) => (
              <div key={p.path} className="flex items-center px-6 py-4 hover:bg-white/[0.02] transition-colors group">
                <code className="text-[#4CE4F8] text-xs font-mono flex-1 truncate group-hover:text-white transition-colors">{p.path}</code>
                <span className="text-white/60 tabular-nums font-black text-xs">{p.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio outbound clicks (30d) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#A15CFD]/10 text-[#A15CFD]"><MousePointer2 size={18} /></div>
              <h2 className="text-sm font-black uppercase tracking-widest">Interactions (30d)</h2>
            </div>
            <span className="text-[10px] text-white/20 font-black uppercase tabular-nums">
              Total {clicks?.ok ? clicks.total30 : 0}
            </span>
          </div>
          <div className="console-chart-card p-0 overflow-hidden">
            {!clicks && <p className="p-10 text-white/20 text-xs text-center animate-pulse uppercase tracking-widest font-black">Scanning Node...</p>}
            {clicks && !clicks.ok && <p className="p-10 text-red-400/60 text-xs text-center font-black">{clicks.reason}</p>}
            {clicks && clicks.ok && clicks.byItem.length === 0 && (
              <p className="p-10 text-white/20 text-xs text-center uppercase tracking-widest font-black">No clicks detected</p>
            )}
            {clicks && clicks.ok && clicks.byItem.length > 0 && (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="console-table-header">
                    <tr>
                      <th className="px-6 py-4">Site</th>
                      <th className="px-4 py-4 text-center">Visits</th>
                      <th className="px-6 py-4 text-right">Last Peak</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {clicks.byItem.map((it) => (
                      <tr key={it.slug} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-4">
                          <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-white/80 hover:text-[#A15CFD] transition-colors">
                            {it.title || it.slug}
                          </a>
                        </td>
                        <td className="px-4 py-4 text-center tabular-nums text-xs font-black text-[#4CE4F8]">
                          {it.total}
                        </td>
                        <td className="px-6 py-4 text-right tabular-nums text-[10px] text-white/20 uppercase font-black">
                          {new Date(it.lastAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* System events */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><History size={18} /></div>
          <h2 className="text-sm font-black uppercase tracking-widest">Neural Activity Stream</h2>
        </div>
        <div className="console-chart-card p-0 overflow-hidden max-h-96 custom-scrollbar overflow-y-auto divide-y divide-white/5">
          {(!events || events.length === 0) && <p className="p-10 text-white/20 text-xs text-center uppercase tracking-widest font-black">No recent events</p>}
          {events?.map((e, i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-4 group hover:bg-white/[0.01] transition-colors">
              <span className="text-[#A15CFD] text-[10px] font-black uppercase tracking-widest min-w-[100px]">{e.kind.replace(/_/g, ' ')}</span>
              <span className="text-white/40 text-[10px] flex-1 truncate font-mono">{JSON.stringify(e.payload)}</span>
              <span className="text-white/20 tabular-nums text-[10px] font-black uppercase">{new Date(e.created_at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent, color }: { label: string; value: number | string; accent?: boolean; color?: string }) {
  return (
    <div className={`console-stat-card border-none group relative overflow-hidden ${accent ? "bg-[#A15CFD]/5" : "bg-white/[0.02]"}`}>
      {accent && <div className="absolute top-0 right-0 p-2"><Zap size={10} className="text-[#A15CFD] animate-pulse" /></div>}
      <div className="text-2xl font-black tabular-nums" style={{ color: color || '#ffffff' }}>{value}</div>
      <div className="text-[10px] text-white/20 font-black uppercase tracking-widest mt-1 group-hover:text-white/40 transition-colors">{label}</div>
    </div>
  );
}

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
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxDaily * f));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44" role="img" aria-label="Daily visits and blocked visits">
      <defs>
        <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#A15CFD" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#A15CFD" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridVals.map((v, i) => {
        const gy = y(v);
        return (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={gy} y2={gy} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <text x={PAD_L - 6} y={gy + 3} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.2)" className="tabular-nums font-black">{v}</text>
          </g>
        );
      })}
      <polygon points={area} fill="url(#visitsFill)" />
      <polyline points={pts} fill="none" stroke="#A15CFD" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {daily.map((d, i) => d.blocked > 0 ? (
        <circle key={`b-${i}`} cx={x(i)} cy={y(d.blocked)} r={3} fill="#f43f5e" opacity={0.6}>
          <title>{`${d.date}: ${d.blocked} blocked`}</title>
        </circle>
      ) : null)}
      {daily.map((d, i) => (
        <g key={`p-${i}`}>
          <circle cx={x(i)} cy={y(d.total)} r={2} fill="#A15CFD" />
          <rect x={x(i) - step / 2} y={PAD_T} width={step} height={ih} fill="transparent" className="cursor-crosshair">
            <title>{`${d.date}\n${d.total} visits · ${d.blocked} blocked`}</title>
          </rect>
        </g>
      ))}
    </svg>
  );
}

type DayData = Awaited<ReturnType<typeof getDayAnalytics>>;

function todayLocalISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function DayDrilldown() {
  const loadDay = useServerFn(getDayAnalytics);
  const [date, setDate] = useState(todayLocalISO);
  const [day, setDay] = useState<DayData | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setBusy(true);
      setErr(null);
      try {
        const r = await loadDay({ data: { date, tzOffsetMinutes: new Date().getTimezoneOffset() } });
        if (!cancelled) setDay(r);
      } catch (e: any) {
        if (cancelled || e?.name === 'AbortError') return;
        setErr(e.message || "Temporal scan failed.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [date, loadDay]);

  const shift = (days: number) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + days);
    setDate(new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10));
  };

  const maxHour = day?.ok ? Math.max(1, ...day.hourly.map((h) => h.count)) : 1;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#d946ef]/10 text-[#d946ef]"><Zap size={18} /></div>
          <h2 className="text-sm font-black uppercase tracking-widest">Temporal Drilldown</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs hover:bg-white/10 transition-colors text-white/40"
          >
            ‹
          </button>
          <input
            type="date"
            value={date}
            max={todayLocalISO()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2 text-[10px] font-black uppercase tracking-widest [color-scheme:dark] outline-none focus:border-[#A15CFD] transition-colors"
          />
          <button
            type="button"
            onClick={() => shift(1)}
            disabled={date >= todayLocalISO()}
            className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs hover:bg-white/10 transition-colors text-white/40 disabled:opacity-20"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => setDate(todayLocalISO())}
            className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors text-white/60 ml-2"
          >
            Sync Now
          </button>
        </div>
      </div>

      <div className="console-chart-card p-8 space-y-10">
        {busy && !day && <p className="p-10 text-white/20 text-xs text-center animate-pulse uppercase tracking-widest font-black">Scanning Chrono-Node...</p>}
        {day && !day.ok && <p className="text-red-400 text-xs font-black uppercase tracking-widest">{day.reason}</p>}

        {day?.ok && (
          <>
            <div className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
              <div className="flex flex-col">
                <span className="text-3xl font-black tabular-nums text-[#A15CFD]">{day.total}</span>
                <span className="text-[10px] text-white/20 font-black uppercase tracking-widest mt-1">Daily Signals</span>
              </div>
              <div className="flex flex-col">
                <span className="text-3xl font-black tabular-nums text-white/80">{day.peakHour !== null ? `${String(day.peakHour).padStart(2, "0")}:00` : '--:--'}</span>
                <span className="text-[10px] text-white/20 font-black uppercase tracking-widest mt-1">Peak Intensity</span>
              </div>
              {day.truncated && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <AlertCircle size={12} />
                  <span className="text-[9px] font-black uppercase">Capped @ 2000</span>
                </div>
              )}
            </div>

            {/* Hourly chart */}
            <div>
              <div className="flex items-end gap-[3px] h-32 px-2">
                {day.hourly.map((h) => (
                  <div key={h.hour} className="flex-1 flex items-end h-full group" title={`${String(h.hour).padStart(2, "0")}:00 · ${h.count} visits`}>
                    <div
                      className="w-full rounded-t-sm bg-gradient-to-t from-[#A15CFD]/20 to-[#A15CFD] group-hover:to-[#4CE4F8] transition-all duration-300"
                      style={{ height: `${Math.max(h.count > 0 ? 4 : 1, (h.count / maxHour) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-4 px-2 text-[9px] text-white/10 font-black uppercase tracking-[0.2em] tabular-nums">
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:59</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <MiniList title="Entry Nodes" rows={day.topPaths} empty="No signals" />
              <MiniList title="Source Origins" rows={day.topReferrers} empty="No origins" />
            </div>

            {/* Visit log */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ArrowRight size={14} className="text-[#A15CFD]" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">Neural Signal Log</h3>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/20 divide-y divide-white/5 max-h-96 overflow-auto custom-scrollbar">
                {day.visits.length === 0 && (
                  <p className="p-10 text-white/10 text-xs text-center uppercase tracking-widest font-black">Null Stream</p>
                )}
                {day.visits.map((v, i) => (
                  <div key={i} className="flex items-center gap-6 px-6 py-3 hover:bg-white/[0.01] transition-colors">
                    <span className="tabular-nums text-[10px] font-black text-white/20 w-20 shrink-0 uppercase">{fmtTime(v.at)}</span>
                    <code className="text-[#4CE4F8] text-[10px] font-mono flex-1 truncate">{v.path}</code>
                    <span className="text-white/20 text-[9px] font-black uppercase truncate max-w-[12rem]">{v.referrer ?? "DIRECT_LINK"}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function MiniList({ title, rows, empty }: { title: string; rows: { key: string; count: number }[]; empty: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/20 overflow-hidden">
      <div className="px-6 py-3 border-b border-white/5 bg-white/[0.01] text-[9px] font-black uppercase tracking-widest text-white/40">{title}</div>
      <div className="divide-y divide-white/5">
        {(!rows || rows.length === 0) && <p className="p-8 text-white/10 text-[10px] text-center uppercase tracking-widest font-black">{empty}</p>}
        {rows?.map((r) => (
          <div key={r.key} className="flex items-center px-6 py-3 hover:bg-white/[0.01] transition-colors">
            <span className="flex-1 truncate text-[10px] font-black text-white/60 uppercase tracking-tighter">{r.key}</span>
            <span className="tabular-nums text-[10px] font-black text-[#A15CFD]">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
