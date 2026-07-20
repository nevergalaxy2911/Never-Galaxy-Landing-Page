/**
 * /api-panel, feature flags, contact submissions log, system health.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import {
  listFlags, upsertFlag, deleteFlag,
  listSubmissions, markSubmissionRead, deleteSubmission,
  bulkMarkSubmissionsRead, deleteReadSubmissions, purgeOldPageViews,
  resetPricingToDefaults,
  getHealth,
} from "@/lib/admin-data.functions";

export const Route = createFileRoute("/_gated/api-panel")({
  component: ApiPanelPage,
});

function ApiPanelPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">API Panel</h1>
      <HealthSection />
      <MaintenanceSection />
      <AnnouncementSection />
      <FlagsSection />
      <QuickActionsSection />
      <SubmissionsSection />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MAINTENANCE (with custom title + message)                                  */
/* -------------------------------------------------------------------------- */

function MaintenanceSection() {
  const load = useServerFn(listFlags);
  const upsert = useServerFn(upsertFlag);
  const [on, setOn] = useState<boolean | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"info" | "warn" | "promo">("info");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<null | "ok" | "err">(null);

  const refresh = useCallback(async () => {
    const r = await load();
    const row = r.rows.find((x: any) => x.key === "maintenance_mode");
    setOn(row ? !!row.enabled : false);
    const v = (row?.value ?? {}) as { title?: string; message?: string; tone?: any; until?: string };
    setTitle(v.title ?? "");
    setMessage(v.message ?? "");
    setTone((v.tone === "warn" || v.tone === "promo") ? v.tone : "info");
    setUntil(v.until ?? "");
  }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function save(nextOn?: boolean) {
    if (on === null) return;
    setBusy(true); setSaved(null);
    try {
      const enabled = typeof nextOn === "boolean" ? nextOn : on;
      await upsert({ data: {
        key: "maintenance_mode",
        enabled,
        value: {
          title: title.trim(),
          message: message.trim(),
          tone,
          until: until.trim() || undefined,
        },
      } });
      setOn(enabled);
      setSaved("ok");
      setTimeout(() => setSaved(null), 1800);
    } catch { setSaved("err"); } finally { setBusy(false); }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Maintenance Mode</h2>
      <div className={`rounded-2xl border p-5 space-y-4 ${
        on ? "border-fuchsia-500/50 bg-fuchsia-500/10" : "border-white/10 bg-white/5"
      }`}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <div className="font-semibold text-base">
              {on ? "Site is under maintenance" : "Site is live"}
            </div>
            <div className="text-sm text-white/60 mt-1">
              When ON, visitors see the message below. Admin routes stay reachable.
            </div>
          </div>
          <Switch
            tone="promo"
            checked={!!on}
            disabled={busy || on === null}
            onCheckedChange={(v) => void save(v)}
            aria-label="Toggle maintenance mode"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-white/60 space-y-1">
            <span>Headline</span>
            <input className="input w-full" placeholder="We'll be back shortly."
              value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </label>
          <label className="text-xs text-white/60 space-y-1">
            <span>Message (visitors see this)</span>
            <textarea className="input w-full min-h-[68px]" placeholder="Briefly offline for updates…"
              value={message} onChange={(e) => setMessage(e.target.value)} maxLength={400} />
          </label>
          <label className="text-xs text-white/60 space-y-1">
            <span>Tone</span>
            <select className="input w-full" value={tone}
              onChange={(e) => setTone(e.target.value as any)}>
              <option value="info">Info (cyan)</option>
              <option value="promo">Promo (fuchsia)</option>
              <option value="warn">Warning (amber)</option>
            </select>
          </label>
          <label className="text-xs text-white/60 space-y-1">
            <span>Back online at (optional — shows countdown)</span>
            <input type="datetime-local" className="input w-full"
              value={until} onChange={(e) => setUntil(e.target.value)} />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={() => save()} disabled={busy}>
            Save message
          </button>
          {saved === "ok"  && <span className="text-xs text-emerald-300">Saved ✓</span>}
          {saved === "err" && <span className="text-xs text-red-300">Save failed</span>}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* ANNOUNCEMENT BAR (site-wide banner)                                        */
/* -------------------------------------------------------------------------- */

function AnnouncementSection() {
  const load = useServerFn(listFlags);
  const upsert = useServerFn(upsertFlag);
  const [on, setOn] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [href, setHref] = useState("");
  const [tone, setTone] = useState<"info" | "warn" | "promo">("info");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<null | "ok" | "err">(null);

  const refresh = useCallback(async () => {
    const r = await load();
    const row = r.rows.find((x: any) => x.key === "announcement_bar");
    setOn(row ? !!row.enabled : false);
    const v = (row?.value ?? {}) as { text?: string; href?: string; tone?: any };
    setText(v.text ?? "");
    setHref(v.href ?? "");
    setTone((v.tone === "warn" || v.tone === "promo") ? v.tone : "info");
  }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function save(nextOn?: boolean) {
    setBusy(true); setSaved(null);
    try {
      const enabled = typeof nextOn === "boolean" ? nextOn : !!on;
      await upsert({ data: {
        key: "announcement_bar", enabled,
        value: { text: text.trim(), href: href.trim() || undefined, tone },
      } });
      setOn(enabled);
      setSaved("ok"); setTimeout(() => setSaved(null), 1800);
    } catch { setSaved("err"); } finally { setBusy(false); }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Announcement Bar</h2>
      <div className={`rounded-2xl border p-5 space-y-4 ${
        on ? "border-cyan-400/50 bg-cyan-500/10" : "border-white/10 bg-white/5"
      }`}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <div className="font-semibold text-base">
              {on ? "Banner is showing on the site" : "Banner is off"}
            </div>
            <div className="text-sm text-white/60 mt-1">
              Thin sticky banner at the top of every public page. Each visitor
              can dismiss it once; changing the text re-shows it to everyone.
            </div>
          </div>
          <Switch
            tone="primary"
            checked={!!on}
            disabled={busy || on === null}
            onCheckedChange={(v) => void save(v)}
            aria-label="Toggle announcement bar"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-white/60 space-y-1 md:col-span-2">
            <span>Message</span>
            <input className="input w-full" placeholder="🚀 Booking November slots — reply within 24h."
              value={text} onChange={(e) => setText(e.target.value)} maxLength={200} />
          </label>
          <label className="text-xs text-white/60 space-y-1">
            <span>Link (optional)</span>
            <input className="input w-full" placeholder="https://…"
              value={href} onChange={(e) => setHref(e.target.value)} maxLength={300} />
          </label>
          <label className="text-xs text-white/60 space-y-1">
            <span>Tone</span>
            <select className="input w-full" value={tone}
              onChange={(e) => setTone(e.target.value as any)}>
              <option value="info">Info (cyan)</option>
              <option value="promo">Promo (fuchsia)</option>
              <option value="warn">Warning (amber)</option>
            </select>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={() => save()} disabled={busy}>
            Save banner
          </button>
          {saved === "ok"  && <span className="text-xs text-emerald-300">Saved ✓</span>}
          {saved === "err" && <span className="text-xs text-red-300">Save failed</span>}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* QUICK ACTIONS (bulk maintenance)                                           */
/* -------------------------------------------------------------------------- */

function QuickActionsSection() {
  const markAll = useServerFn(bulkMarkSubmissionsRead);
  const delRead = useServerFn(deleteReadSubmissions);
  const purge   = useServerFn(purgeOldPageViews);
  const reset   = useServerFn(resetPricingToDefaults);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(null), 2500); }
  async function run(id: string, fn: () => Promise<any>, label: (r: any) => string) {
    setBusy(id);
    try { const r = await fn(); flash(label(r)); }
    catch (e: any) { flash(`Failed: ${e?.message ?? "error"}`); }
    finally { setBusy(null); }
  }

  const Btn = ({ id, children, className, onClick }: any) => (
    <button className={`${className} disabled:opacity-50`}
      disabled={busy !== null} onClick={onClick}>
      {busy === id ? "…" : children}
    </button>
  );

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Btn id="mark" className="btn-secondary text-sm"
            onClick={() => run("mark", () => markAll(), (r) => `Marked ${r.updated} as read`)}>
            Mark all messages as read
          </Btn>
          <Btn id="delr" className="btn-secondary text-sm"
            onClick={() => {
              if (!confirm("Delete all READ contact submissions? (Unread stay safe.)")) return;
              return run("delr", () => delRead(), (r) => `Deleted ${r.deleted} read messages`);
            }}>
            Delete all read messages
          </Btn>
          <Btn id="purge" className="btn-secondary text-sm"
            onClick={() => {
              if (!confirm("Purge page views older than 90 days?")) return;
              return run("purge", () => purge({ data: { olderThanDays: 90 } }),
                (r) => `Purged ${r.deleted} page views`);
            }}>
            Purge page views &gt; 90 days
          </Btn>
          <Btn id="reset" className="btn-danger text-sm"
            onClick={() => {
              if (!confirm("Reset pricing plans to the code defaults? Wipes current rows.")) return;
              return run("reset", () => reset(), (r) => `Reset — ${r.count} plans reinstalled`);
            }}>
            Reset pricing to defaults
          </Btn>
        </div>
        {msg && <p className="text-xs text-emerald-300">{msg}</p>}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* HEALTH                                                                     */
/* -------------------------------------------------------------------------- */

function HealthSection() {
  const load = useServerFn(getHealth);
  const [h, setH] = useState<any>(null);
  useEffect(() => { load().then(setH).catch(() => {}); }, [load]);

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">System Health</h2>
      {!h && <p className="text-white/50 text-sm">Loading…</p>}
      {h && !h.ok && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
          {h.reason}
        </div>
      )}
      {h?.ok && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Stat label="Settings" value={h.counts.settings} />
          <Stat label="Pricing plans" value={h.counts.pricing} />
          <Stat label="Portfolio" value={h.counts.portfolio} />
          <Stat label="Feature flags" value={h.counts.flags} />
          <Stat label="Page views" value={h.counts.pageViews} />
          <Stat label="Admins" value={h.counts.admins} />
          <Stat label="Unread messages" value={h.counts.unreadSubmissions} accent />
        </div>
      )}
      {h?.env && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {Object.entries(h.env).map(([k, v]) => (
            <div key={k} className={`px-3 py-1.5 rounded-md border ${
              v ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/5"
                : "border-red-500/40 text-red-300 bg-red-500/5"
            }`}>
              {v ? "✓" : "✗"} {k}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, accent }: any) {
  return (
    <div className={`rounded-xl border p-4 ${
      accent ? "border-fuchsia-500/40 bg-fuchsia-500/10" : "border-white/10 bg-white/5"
    }`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-white/60 mt-1">{label}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* FEATURE FLAGS                                                              */
/* -------------------------------------------------------------------------- */

const FLAG_TEMPLATES = [
  { key: "adblock_gate_enabled", enabled: true },
  { key: "cursor_trail_default_on", enabled: true },
  { key: "theme_default_dark", enabled: true },
  { key: "maintenance_mode", enabled: false },
  { key: "announcement_bar", enabled: false },
];

function FlagsSection() {
  const load = useServerFn(listFlags);
  const upsert = useServerFn(upsertFlag);
  const del = useServerFn(deleteFlag);
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await load(); setRows(r.rows); setErr(r.error);
  }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function toggle(row: any) {
    await upsert({ data: { key: row.key, enabled: !row.enabled, value: row.value } });
    await refresh();
  }
  const [newKey, setNewKey] = useState("");
  async function add(k: string) {
    if (!k) return;
    await upsert({ data: { key: k, enabled: false } });
    setNewKey("");
    await refresh();
  }
  async function remove(k: string) {
    if (!confirm(`Delete flag "${k}"?`)) return;
    await del({ data: { key: k } });
    await refresh();
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Feature Flags</h2>
      {err && (
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
          {err}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/10">
        {rows.map((r) => (
          <div
            key={r.key}
            className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-2 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="font-mono text-xs sm:text-sm text-fuchsia-300 break-all">
                {r.key}
              </div>
              {r.updated_at && (
                <div className="text-[10px] text-white/40 mt-0.5">
                  Updated {new Date(r.updated_at).toLocaleString()}
                </div>
              )}
            </div>
            <Switch
              tone="success"
              checked={!!r.enabled}
              onCheckedChange={() => void toggle(r)}
              aria-label={`Toggle flag ${r.key}`}
            />
            <button
              className="btn-danger text-xs shrink-0"
              onClick={() => remove(r.key)}
              aria-label={`Delete flag ${r.key}`}
            >
              Delete
            </button>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="px-4 py-6 text-white/50 text-sm text-center">No flags yet.</p>
        )}
      </div>

      <div className="mt-4 flex gap-2 items-center">
        <input
          list="flag-templates"
          className="input flex-1"
          placeholder="cursor_trail_default_on"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
        />
        <datalist id="flag-templates">
          {FLAG_TEMPLATES.map((t) => <option key={t.key} value={t.key} />)}
        </datalist>
        <button className="btn-primary" onClick={() => add(newKey)}>+ Add flag</button>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* CONTACT SUBMISSIONS                                                        */
/* -------------------------------------------------------------------------- */

function SubmissionsSection() {
  const load = useServerFn(listSubmissions);
  const markRead = useServerFn(markSubmissionRead);
  const del = useServerFn(deleteSubmission);
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [showRead, setShowRead] = useState(false);

  const refresh = useCallback(async () => {
    const r = await load(); setRows(r.rows); setErr(r.error);
  }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = showRead ? rows : rows.filter((r) => !r.read);

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-semibold flex-1">
          Contact Submissions ({filtered.length})
        </h2>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={showRead}
            onChange={(e) => setShowRead(e.target.checked)} /> Show read
        </label>
      </div>
      {err && (
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
          {err}
        </div>
      )}
      <div className="space-y-3">
        {filtered.map((r) => (
          <div key={r.id} className={`rounded-xl border p-4 ${
            r.read ? "border-white/10 bg-white/5" : "border-fuchsia-500/40 bg-fuchsia-500/5"
          }`}>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold">{r.name}</span>
              <a href={`mailto:${r.email}`} className="text-fuchsia-300 text-sm underline">
                {r.email}
              </a>
              <span className="text-white/40 text-xs ml-auto">
                {new Date(r.created_at).toLocaleString()}
              </span>
            </div>
            <p className="mt-2 text-sm text-white/80 whitespace-pre-wrap">{r.message}</p>
            <div className="mt-3 flex gap-2 text-xs">
              <button
                className="btn-secondary"
                onClick={async () => { await markRead({ data: { id: r.id, read: !r.read } }); await refresh(); }}
              >
                Mark {r.read ? "unread" : "read"}
              </button>
              <button
                className="btn-danger"
                onClick={async () => {
                  if (!confirm("Delete this submission?")) return;
                  await del({ data: { id: r.id } }); await refresh();
                }}
              >
                Delete
              </button>
              {r.ip && <span className="ml-auto text-white/40">IP: {r.ip}</span>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-white/50 text-sm">
            {showRead ? "No submissions yet." : "No unread submissions."}
          </p>
        )}
      </div>
    </section>
  );
}
