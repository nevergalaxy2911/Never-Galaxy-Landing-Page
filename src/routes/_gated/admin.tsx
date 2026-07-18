/**
 * /admin, main content editor.
 * Tabs: Site Settings, Pricing, Portfolio.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  listSettings,
  upsertSetting,
  deleteSetting,
  listPricing,
  upsertPricing,
  deletePricing,
  resetPricingToDefaults,
  listPortfolio,
  upsertPortfolio,
  deletePortfolio,
  getCategories,
  saveCategories,
} from "@/lib/admin-data.functions";
import {
  DEFAULT_CATEGORIES,
  ICON_CHOICES,
  type PortfolioCategory,
} from "@/lib/portfolio-config";

export const Route = createFileRoute("/_gated/admin")({
  component: AdminPage,
});

type Tab = "settings" | "pricing" | "portfolio" | "filters";

function AdminPage() {
  const [tab, setTab] = useState<Tab>("settings");
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <h1 className="text-2xl font-semibold flex-1 min-w-full sm:min-w-0">Site Editor</h1>
        <TabBtn active={tab === "settings"} onClick={() => setTab("settings")}>
          Site Settings
        </TabBtn>
        <TabBtn active={tab === "pricing"} onClick={() => setTab("pricing")}>
          Pricing
        </TabBtn>
        <TabBtn active={tab === "portfolio"} onClick={() => setTab("portfolio")}>
          Portfolio
        </TabBtn>
        <TabBtn active={tab === "filters"} onClick={() => setTab("filters")}>
          Filters
        </TabBtn>
      </div>
      {tab === "settings" && <SettingsEditor />}
      {tab === "pricing" && <PricingEditor />}
      {tab === "portfolio" && <PortfolioEditor />}
      {tab === "filters" && <FiltersEditor />}
    </div>
  );
}

function TabBtn({
  active,
  children,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={active ? "nav-pill nav-pill-active" : "nav-pill border border-white/10"}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* SETTINGS                                                                   */
/* -------------------------------------------------------------------------- */

const SETTING_TEMPLATES: Record<string, string> = {
  "brand.name": '"Never Galaxy"',
  "brand.tagline": '"Cosmic-grade creative studio for video, motion, and design."',
  "contact.email": '"nevergalaxy2911@gmail.com"',
  "socials.instagram": '"https://www.instagram.com/nevergalaxystudio/"',
  "socials.youtube": '""',
  "hero.headline": '"Cosmic-grade creative studio."',
  "hero.subhead": '"Cinematic video, motion, and design for brands that want to feel bigger."',
};

function SettingsEditor() {
  const load = useServerFn(listSettings);
  const upsert = useServerFn(upsertSetting);
  const del = useServerFn(deleteSetting);

  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const r = await load();
    setRows(r.rows);
    setErr(r.error);
  }, [load]);

  useEffect(() => { void refresh(); }, [refresh]);

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState('""');

  async function onSaveNew() {
    if (!newKey) return;
    setBusy(true);
    try {
      const parsed = JSON.parse(newValue);
      await upsert({ data: { key: newKey, value: parsed } });
      setNewKey(""); setNewValue('""');
      await refresh();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function onUpdateRow(key: string, value: string) {
    setBusy(true);
    try {
      const parsed = JSON.parse(value);
      await upsert({ data: { key, value: parsed } });
      await refresh();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function onDelete(key: string) {
    if (!confirm(`Delete "${key}"?`)) return;
    await del({ data: { key } });
    await refresh();
  }

  return (
    <section className="space-y-6">
      {err && <ErrorBanner msg={err} />}

      <Card>
        <h2 className="text-lg font-semibold mb-2">Add / update setting</h2>
        <p className="text-sm text-white/60 mb-4">
          Key is dot-notation (e.g. <code className="text-fuchsia-300">brand.name</code>).
          Value is JSON, quote strings.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2">
          <input
            list="setting-keys"
            className="input"
            placeholder="brand.name"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <datalist id="setting-keys">
            {Object.keys(SETTING_TEMPLATES).map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
          <input
            className="input font-mono text-sm"
            placeholder='"value" or 123 or {"foo":"bar"}'
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
          <button disabled={busy} onClick={onSaveNew} className="btn-primary">
            Save
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold mb-4">Existing settings ({rows.length})</h2>
        {rows.length === 0 && (
          <p className="text-white/50 text-sm">No settings yet. Add one above.</p>
        )}
        <div className="space-y-2">
          {rows.map((r) => (
            <SettingRow key={r.key} row={r} onSave={onUpdateRow} onDelete={onDelete} />
          ))}
        </div>
      </Card>
    </section>
  );
}

function SettingRow({
  row,
  onSave,
  onDelete,
}: {
  row: any;
  onSave: (k: string, v: string) => void;
  onDelete: (k: string) => void;
}) {
  const [v, setV] = useState(JSON.stringify(row.value));
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto_auto] gap-2 items-center">
      <div className="font-mono text-sm text-fuchsia-300">{row.key}</div>
      <input
        className="input font-mono text-sm"
        value={v}
        onChange={(e) => setV(e.target.value)}
      />
      <button className="btn-secondary" onClick={() => onSave(row.key, v)}>Save</button>
      <button className="btn-danger" onClick={() => onDelete(row.key)}>Delete</button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PRICING                                                                    */
/* -------------------------------------------------------------------------- */

const emptyPricing = () => ({
  position: 0,
  name: "New plan",
  price_inr: 0,
  custom_price: "",
  price_prefix: "From ",
  cadence: "per deliverable",
  body: "Describe this plan.",
  features: [] as string[],
  highlighted: false,
  published: true,
});

function PricingEditor() {
  const load = useServerFn(listPricing);
  const upsert = useServerFn(upsertPricing);
  const del = useServerFn(deletePricing);
  const reset = useServerFn(resetPricingToDefaults);
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const refresh = useCallback(async () => {
    const r = await load(); setRows(r.rows); setErr(r.error);
  }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function onSave(row: any) {
    try {
      const clean = {
        ...row,
        price_inr: row.price_inr === "" || row.price_inr == null ? null : Number(row.price_inr),
        features: Array.isArray(row.features)
          ? row.features
          : String(row.features || "").split("\n").map((s: string) => s.trim()).filter(Boolean),
      };
      await upsert({ data: clean });
      await refresh();
    } catch (e) { setErr((e as Error).message); }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete plan?")) return;
    await del({ data: { id } });
    await refresh();
  }

  async function onReset() {
    if (!confirm("Wipe all current plans and restore the 3 default plans from site.ts?")) return;
    setResetting(true);
    try { await reset(); await refresh(); }
    catch (e) { setErr((e as Error).message); }
    finally { setResetting(false); }
  }

  return (
    <section className="space-y-4">
      {err && <ErrorBanner msg={err} />}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => onSave(emptyPricing())}>
          + Add plan
        </button>
        <button
          className="btn-secondary"
          onClick={onReset}
          disabled={resetting}
        >
          {resetting ? "Resetting…" : "↺ Reset to defaults (3 plans)"}
        </button>
      </div>
      {rows.map((r) => (
        <PricingRow key={r.id} row={r} onSave={onSave} onDelete={onDelete} />
      ))}
      {rows.length === 0 && (
        <p className="text-white/50 text-sm">No pricing plans yet. Click "Add plan" or "Reset to defaults".</p>
      )}
    </section>
  );
}

function PricingRow({ row, onSave, onDelete }: any) {
  const [d, setD] = useState({
    ...row,
    features: (row.features ?? []).join("\n"),
  });
  const set = (k: string, v: any) => setD((prev: any) => ({ ...prev, [k]: v }));
  return (
    <Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Position (order)">
          <input type="number" className="input" value={d.position ?? 0}
            onChange={(e) => set("position", Number(e.target.value))} />
        </Field>
        <Field label="Name">
          <input className="input" value={d.name ?? ""}
            onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Price INR (blank = custom)">
          <input type="number" className="input" value={d.price_inr ?? ""}
            onChange={(e) => set("price_inr", e.target.value)} />
        </Field>
        <Field label="Custom price label (if no INR)">
          <input className="input" value={d.custom_price ?? ""}
            onChange={(e) => set("custom_price", e.target.value)} />
        </Field>
        <Field label='Price prefix (e.g. "From ")'>
          <input className="input" value={d.price_prefix ?? ""}
            onChange={(e) => set("price_prefix", e.target.value)} />
        </Field>
        <Field label="Cadence (e.g. / month)">
          <input className="input" value={d.cadence ?? ""}
            onChange={(e) => set("cadence", e.target.value)} />
        </Field>
        <Field label="Body" className="md:col-span-2">
          <textarea className="input min-h-[70px]" value={d.body ?? ""}
            onChange={(e) => set("body", e.target.value)} />
        </Field>
        <Field label="Features (one per line)" className="md:col-span-2">
          <textarea className="input min-h-[100px] font-mono text-sm"
            value={d.features} onChange={(e) => set("features", e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!d.highlighted}
            onChange={(e) => set("highlighted", e.target.checked)} /> Highlighted
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!d.published}
            onChange={(e) => set("published", e.target.checked)} /> Published
        </label>
      </div>
      <div className="flex gap-2 mt-4">
        <button className="btn-primary" onClick={() => onSave(d)}>Save</button>
        <button className="btn-danger" onClick={() => onDelete(row.id)}>Delete</button>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* PORTFOLIO                                                                  */
/* -------------------------------------------------------------------------- */

const emptyPortfolio = () => ({
  position: 0,
  category: "video",
  title: "New item",
  subtitle: "",
  url: "",
  badge: "Play",
  thumb_url: "",
  published: true,
});

function PortfolioEditor() {
  const load = useServerFn(listPortfolio);
  const loadCats = useServerFn(getCategories);
  const upsert = useServerFn(upsertPortfolio);
  const del = useServerFn(deletePortfolio);
  const [rows, setRows] = useState<any[]>([]);
  const [cats, setCats] = useState<PortfolioCategory[]>(DEFAULT_CATEGORIES);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [r, c] = await Promise.all([load(), loadCats()]);
    setRows(r.rows); setErr(r.error);
    setCats(c.categories);
  }, [load, loadCats]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function onSave(row: any) {
    try { await upsert({ data: row }); await refresh(); }
    catch (e) { setErr((e as Error).message); }
  }
  async function onDelete(id: string) {
    if (!confirm("Delete item?")) return;
    await del({ data: { id } }); await refresh();
  }

  return (
    <section className="space-y-4">
      {err && <ErrorBanner msg={err} />}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn-primary"
          onClick={() => onSave({ ...emptyPortfolio(), category: cats[0]?.id ?? "video" })}
        >
          + Add portfolio item
        </button>
        <span className="text-xs text-white/50">
          Filter tabs are managed in the <b>Filters</b> tab.
        </span>
      </div>
      {rows.map((r) => (
        <PortfolioRow key={r.id} row={r} cats={cats} onSave={onSave} onDelete={onDelete} />
      ))}
      {rows.length === 0 && (
        <p className="text-white/50 text-sm">No portfolio items yet.</p>
      )}
    </section>
  );
}

function PortfolioRow({
  row, cats, onSave, onDelete,
}: {
  row: any;
  cats: PortfolioCategory[];
  onSave: (r: any) => void;
  onDelete: (id: string) => void;
}) {
  const [d, setD] = useState({ ...row });
  const set = (k: string, v: any) => setD((prev: any) => ({ ...prev, [k]: v }));
  const activeCat = cats.find((c) => c.id === d.category);
  const isVideo = activeCat?.kind === "video";
  return (
    <Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Position">
          <input type="number" className="input" value={d.position ?? 0}
            onChange={(e) => set("position", Number(e.target.value))} />
        </Field>
        <Field label="Category (filter tab)">
          <select className="input" value={d.category ?? "video"}
            onChange={(e) => set("category", e.target.value)}>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.kind === "video" ? "YouTube" : "Image"})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title">
          <input className="input" value={d.title ?? ""}
            onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Subtitle (small caption)">
          <input className="input" value={d.subtitle ?? ""}
            onChange={(e) => set("subtitle", e.target.value)} />
        </Field>
        <Field
          label={isVideo ? "YouTube URL (video link)" : "Link / URL (optional)"}
          className="md:col-span-2"
        >
          <input
            className="input"
            value={d.url ?? ""}
            placeholder={
              isVideo
                ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                : "https://your-project-link.com (optional)"
            }
            onChange={(e) => set("url", e.target.value)}
          />
          <p className="text-[11px] text-white/45 mt-1">
            {isVideo
              ? "Paste any YouTube URL — the tile auto-shows the thumbnail + play button."
              : "For image tiles this is optional. Fill the Image URL below to show a picture."}
          </p>
        </Field>
        {!isVideo && (
          <Field label="Image URL (shown on the tile)" className="md:col-span-2">
            <input
              className="input"
              value={d.thumb_url ?? ""}
              placeholder="https://cdn.example.com/screenshot.jpg"
              onChange={(e) => set("thumb_url", e.target.value)}
            />
            <p className="text-[11px] text-white/45 mt-1">
              For a Website tile, use a screenshot. For a Graphic tile, use the artwork.
            </p>
          </Field>
        )}
        {isVideo && (
          <Field label="Custom thumbnail URL (optional — overrides YouTube's)" className="md:col-span-2">
            <input
              className="input"
              value={d.thumb_url ?? ""}
              placeholder="Leave empty to use YouTube's default thumbnail"
              onChange={(e) => set("thumb_url", e.target.value)}
            />
          </Field>
        )}
        <Field label="Badge (small corner label)">
          <input className="input" value={d.badge ?? ""}
            placeholder="Play / View / Soon"
            onChange={(e) => set("badge", e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!d.published}
            onChange={(e) => set("published", e.target.checked)} /> Published
        </label>
      </div>
      <div className="flex gap-2 mt-4">
        <button className="btn-primary" onClick={() => onSave(d)}>Save</button>
        <button className="btn-danger" onClick={() => onDelete(row.id)}>Delete</button>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* FILTERS (portfolio categories / tabs)                                      */
/* -------------------------------------------------------------------------- */

function FiltersEditor() {
  const load = useServerFn(getCategories);
  const save = useServerFn(saveCategories);
  const [cats, setCats] = useState<PortfolioCategory[]>(DEFAULT_CATEGORIES);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const refresh = useCallback(async () => {
    const r = await load();
    setCats(r.categories);
    setErr(r.error);
    setDirty(false);
  }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);

  function update(i: number, patch: Partial<PortfolioCategory>) {
    setCats((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
    setDirty(true);
  }
  function move(i: number, dir: -1 | 1) {
    setCats((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  }
  function remove(i: number) {
    if (!confirm(`Remove filter "${cats[i].label}"?`)) return;
    setCats((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  }
  function add() {
    setCats((prev) => [
      ...prev,
      { id: `new-${prev.length + 1}`, label: "New filter", icon: "ImageIcon", kind: "image", enabled: true },
    ]);
    setDirty(true);
  }
  async function persist() {
    setBusy(true);
    try {
      await save({ data: { categories: cats } });
      await refresh();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  async function reset() {
    if (!confirm("Reset filters to defaults (Video, Motion, Graphics, Website)?")) return;
    setBusy(true);
    try {
      await save({ data: { categories: DEFAULT_CATEGORIES } });
      await refresh();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section className="space-y-4">
      {err && <ErrorBanner msg={err} />}
      <Card>
        <p className="text-sm text-white/70">
          These are the filter tabs shown on the public Portfolio section
          (Video, Motion, Graphics, Website, …). Toggle enabled to hide a tab
          without deleting it. Set kind to <b>YouTube</b> for video tiles or
          <b> Image</b> for graphic/website tiles. Category <code>id</code>
          must match the Category dropdown on each portfolio item.
        </p>
      </Card>

      <div className="space-y-3">
        {cats.map((c, i) => (
          <Card key={i}>
            <div className="grid grid-cols-1 md:grid-cols-[80px_1fr_1fr_140px_140px_auto] gap-3 items-end">
              <Field label="Order">
                <div className="flex gap-1">
                  <button className="btn-secondary px-2" onClick={() => move(i, -1)} aria-label="Up">↑</button>
                  <button className="btn-secondary px-2" onClick={() => move(i, +1)} aria-label="Down">↓</button>
                </div>
              </Field>
              <Field label="ID (machine key)">
                <input
                  className="input font-mono text-sm"
                  value={c.id}
                  onChange={(e) => update(i, { id: e.target.value })}
                />
              </Field>
              <Field label="Label (shown on tab)">
                <input
                  className="input"
                  value={c.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                />
              </Field>
              <Field label="Icon">
                <select
                  className="input"
                  value={c.icon}
                  onChange={(e) => update(i, { icon: e.target.value })}
                >
                  {ICON_CHOICES.map((ic) => (
                    <option key={ic} value={ic}>{ic}</option>
                  ))}
                </select>
              </Field>
              <Field label="Kind">
                <select
                  className="input"
                  value={c.kind}
                  onChange={(e) => update(i, { kind: e.target.value as "video" | "image" })}
                >
                  <option value="video">YouTube (video)</option>
                  <option value="image">Image (graphic/web)</option>
                </select>
              </Field>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    onChange={(e) => update(i, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>
                <button className="btn-danger" onClick={() => remove(i)}>Remove</button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <button className="btn-secondary" onClick={add}>+ Add filter</button>
        <button className="btn-primary" onClick={persist} disabled={busy || !dirty}>
          {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
        <button className="btn-secondary" onClick={reset} disabled={busy}>
          ↺ Reset to defaults
        </button>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* SHARED PRIMITIVES                                                          */
/* -------------------------------------------------------------------------- */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">{children}</div>
  );
}
function Field({
  label, children, className = "",
}: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs uppercase tracking-wider text-white/50 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
      {msg}
    </div>
  );
}
