/**
 * /api-panel, feature flags, contact submissions log, system health.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  listFlags, upsertFlag, deleteFlag,
  listSubmissions, markSubmissionRead, deleteSubmission,
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
      <FlagsSection />
      <SubmissionsSection />
    </div>
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Settings" value={h.counts.settings} />
          <Stat label="Pricing plans" value={h.counts.pricing} />
          <Stat label="Portfolio" value={h.counts.portfolio} />
          <Stat label="Feature flags" value={h.counts.flags} />
          <Stat label="Unread messages" value={h.counts.unreadSubmissions} accent />
        </div>
      )}
      {h?.env && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          {Object.entries(h.env).map(([k, v]) => (
            <div key={k} className={`px-3 py-1.5 rounded border ${
              v ? "border-emerald-500/40 text-emerald-300" : "border-red-500/40 text-red-300"
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
  { key: "cursor_trail_default_on", enabled: true },
  { key: "adblock_gate_strict", enabled: false },
  { key: "theme_default_dark", enabled: true },
  { key: "maintenance_mode", enabled: false },
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
          <div key={r.key} className="flex items-center gap-3 px-4 py-3">
            <div className="font-mono text-sm text-fuchsia-300 flex-1">{r.key}</div>
            <button
              onClick={() => toggle(r)}
              className={`w-14 h-7 rounded-full transition-colors relative ${
                r.enabled ? "bg-emerald-500" : "bg-white/20"
              }`}
              aria-label="Toggle flag"
            >
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                r.enabled ? "translate-x-8" : "translate-x-1"
              }`} />
            </button>
            <button className="btn-danger text-xs" onClick={() => remove(r.key)}>Delete</button>
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
