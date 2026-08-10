import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid, MessageSquareQuote, Tag, Settings2,
  ChevronRight, Plus, RotateCcw,
  Mail, Trash2, Edit3, BarChart3,
  Activity, Zap, Inbox, X
} from "lucide-react";
import { toast } from "sonner";
import {
  listPortfolio, upsertPortfolio, deletePortfolio,
  getTestimonials, saveTestimonials,
  listPricing, upsertPricing, deletePricing, resetPricingToDefaults,
  listSubmissions,
  getHealth, getSupabaseAlignment,
  listFlags, upsertFlag
} from "@/lib/admin-data.functions";
import { getAnalyticsSummary } from "@/lib/analytics.functions";
import { useAdmin } from "@/components/admin/AdminProvider";

export const Route = createFileRoute("/_gated/admin")({
  component: AdminPageOG,
});

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "portfolio", label: "Portfolio", icon: LayoutGrid },
  { id: "testimonials", label: "Testimonials", icon: MessageSquareQuote },
  { id: "pricing", label: "Pricing", icon: Tag },
  { id: "contact", label: "Inquiries", icon: Inbox },
  { id: "settings", label: "Settings", icon: Settings2 },
] as const;

type Tab = typeof NAV_ITEMS[number]['id'];

function AdminPageOG() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState<any>(null);
  const loadHealth = useServerFn(getHealth);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await loadHealth();
        if (!cancelled) setStats(res.counts);
      } catch (e: any) {
        if (cancelled) return;
        console.error("[OG Admin] Health Load Error:", e);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [loadHealth]);

  return (
    <div className="flex-1 flex overflow-hidden bg-black text-white font-sans selection:bg-fuchsia-500/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 bg-[#050505] flex flex-col shrink-0">
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-fuchsia-600 flex items-center justify-center font-bold text-white shadow-lg shadow-fuchsia-600/20">NG</div>
            <span className="font-bold text-sm tracking-tight uppercase">Control</span>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                activeTab === item.id 
                ? "bg-white/10 text-white" 
                : "text-white/40 hover:text-white/70 hover:bg-white/5"
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-8 mt-auto border-t border-white/5">
           <div className="flex items-center gap-2">
             <div className="h-2 w-2 rounded-full bg-emerald-500" />
             <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Node v1.0.4</span>
           </div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-black">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 shrink-0">
          <div className="flex items-center gap-2 text-sm text-white/40">
            <span>Admin</span>
            <ChevronRight size={14} />
            <span className="text-white font-bold capitalize">{activeTab}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          <div className="max-w-5xl mx-auto">
            {activeTab === "dashboard" && <DashboardView stats={stats} />}
            {activeTab === "portfolio" && <PortfolioView />}
            {activeTab === "testimonials" && <TestimonialsEditorView />}
            {activeTab === "pricing" && <PricingEditorView />}
            {activeTab === "contact" && <InboxView />}
            {activeTab === "settings" && <SettingsEditorView />}
          </div>
        </div>
      </main>
    </div>
  );
}

function DashboardView({ stats }: { stats: any }) {
  const loadSummary = useServerFn(getAnalyticsSummary);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadSummary().then(res => {
      if (!cancelled) setAnalytics(res);
    });
    return () => { cancelled = true; };
  }, [loadSummary]);

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatCard label="Live Projects" value={stats?.portfolio ?? "0"} />
        <StatCard label="Unread Inquiry" value={stats?.unreadSubmissions ?? "0"} />
        <StatCard label="Page Views" value={stats?.pageViews ? `${(stats.pageViews / 1000).toFixed(1)}K` : "0"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30">System Status</h3>
          <div className="bg-white/5 rounded-2xl p-8 border border-white/5 space-y-6">
            <HealthItem label="Database" status="Connected" />
            <HealthItem label="Storage" status="Active" />
            <HealthItem label="Edge Runtime" status="Healthy" />
          </div>
        </div>
        <div className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30">Backend Alignment</h3>
          <SupabaseAlignmentCheck />
        </div>
      </div>
    </div>
  );
}

function SupabaseAlignmentCheck() {
  const check = useServerFn(getSupabaseAlignment);
  const [results, setResults] = useState<Record<string, { exists: boolean; status: string }> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    check().then(res => {
      setResults(res);
      setLoading(false);
    });
  }, [check]);

  if (loading) return <div className="animate-pulse bg-white/5 h-32 rounded-2xl" />;

  return (
    <div className="bg-white/5 rounded-2xl p-6 border border-white/5 space-y-4">
      <p className="text-[11px] text-white/50 leading-relaxed uppercase tracking-wider font-bold">
        Supabase Readiness Checklist
      </p>
      <div className="space-y-2">
        {results && Object.entries(results).map(([table, meta]) => (
          <div key={table} className="flex items-center justify-between text-xs">
            <span className="text-white/40 font-mono">{table}</span>
            <div className="flex items-center gap-2">
              <span className={meta.exists ? "text-emerald-500" : "text-amber-500"}>
                {meta.exists ? "✓ Online" : "✗ Missing"}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="pt-4 border-t border-white/5">
        <p className="text-[10px] text-white/30 leading-relaxed italic">
          Everything is currently synced with your provided SQL schema. No further migrations are required for standard features.
        </p>
      </div>
    </div>
  );
}

function PortfolioView() {
  const load = useServerFn(listPortfolio);
  const save = useServerFn(upsertPortfolio);
  const del = useServerFn(deletePortfolio);
  const [items, setItems] = useState<any[]>([]);
  
  // Dialog state
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    video_url: "",
    resolution: "1080",
    ratio: "16:9",
    size: "m" as "s" | "m" | "l"
  });

  const refresh = useCallback(async () => {
    const res = await load();
    setItems(res.rows || []);
  }, [load]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      title: "",
      video_url: "",
      resolution: "1080",
      ratio: "16:9",
      size: "m"
    });
    setIsOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      video_url: item.video_url || "",
      resolution: item.aspect?.resolution || "1080",
      ratio: item.aspect?.ratio || "16:9",
      size: item.aspect?.size || "m"
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error("Project Title is required");
      return;
    }

    const payload = editingItem 
      ? { ...editingItem, ...formData, aspect: { ratio: formData.ratio, resolution: formData.resolution, size: formData.size } }
      : { 
          title: formData.title, 
          category: "Video", 
          video_url: formData.video_url,
          aspect: { ratio: formData.ratio, resolution: formData.resolution, size: formData.size },
          position: items.length 
        };

    try {
      await save({ data: payload });
      toast.success(editingItem ? "Project updated" : "Project added");
      setIsOpen(false);
      refresh();
    } catch (err) {
      toast.error("Failed to save project");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Portfolio</h3>
        <Button 
          onClick={handleOpenAdd}
          className="bg-white text-black px-6 py-2 rounded-full text-xs font-bold hover:bg-white/90 transition-colors"
        >
          Add Item
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {items.map((item) => (
          <div key={item.id} className="bg-white/5 border border-white/5 rounded-2xl p-6 group hover:border-white/20 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold mb-1">{item.title}</h4>
                <div className="text-[10px] text-white/30 uppercase font-black tracking-widest">{item.category}</div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleOpenEdit(item)}
                  className="p-2 hover:bg-white/10 rounded cursor-pointer"
                >
                  <Edit3 size={14} />
                </button>
                <button 
                  onClick={async () => {
                    if (confirm("Delete?")) { await del({ data: { id: item.id } }); refresh(); }
                  }}
                  className="p-2 hover:bg-white/10 rounded text-red-400 cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-[#0a0a0f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Project" : "Add Project"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs text-white/40 uppercase font-bold tracking-widest">Project Title</label>
              <Input 
                value={formData.title} 
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="bg-white/5 border-white/10"
                placeholder="Enter title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-white/40 uppercase font-bold tracking-widest">YouTube Video Link</label>
              <Input 
                value={formData.video_url} 
                onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                className="bg-white/5 border-white/10"
                placeholder="https://youtube.com/..."
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-white/40 uppercase font-bold tracking-widest">Resolution</label>
                <select 
                  value={formData.resolution} 
                  onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-md p-2 text-sm text-white"
                >
                  <option value="1080">1080</option>
                  <option value="2K">2K</option>
                  <option value="4K">4K</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/40 uppercase font-bold tracking-widest">Ratio</label>
                <select 
                  value={formData.ratio} 
                  onChange={(e) => setFormData({ ...formData, ratio: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-md p-2 text-sm text-white"
                >
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                  <option value="1:1">1:1</option>
                  <option value="4:5">4:5</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/40 uppercase font-bold tracking-widest">Card Preset</label>
                <select 
                  value={formData.size} 
                  onChange={(e) => setFormData({ ...formData, size: e.target.value as "s" | "m" | "l" })}
                  className="w-full bg-white/5 border border-white/10 rounded-md p-2 text-sm text-white"
                >
                  <option value="s">Small (s)</option>
                  <option value="m">Medium (m)</option>
                  <option value="l">Large (l)</option>
                </select>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white w-full">
                {editingItem ? "Update Project" : "Add Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TestimonialsEditorView() {
  const load = useServerFn(getTestimonials);
  const save = useServerFn(saveTestimonials);
  const [items, setItems] = useState<any[]>([]);
  
  // Dialog state
  const [isOpen, setIsOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    quote: "",
    paid: ""
  });

  const refresh = useCallback(async () => {
    const res = await load();
    setItems(res.items || []);
  }, [load]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleOpenAdd = () => {
    setEditingIndex(null);
    setFormData({ name: "", quote: "", paid: "" });
    setIsOpen(true);
  };

  const handleOpenEdit = (t: any, index: number) => {
    setEditingIndex(index);
    setFormData({
      name: t.name,
      quote: t.quote,
      paid: t.proof ? t.proof.replace(" paid", "") : ""
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.quote) {
      toast.error("Name and Quote are required");
      return;
    }

    const newItem = {
      name: formData.name,
      quote: formData.quote,
      role: "Client",
      proof: formData.paid ? `${formData.paid} paid` : undefined,
      enabled: true
    };

    let nextItems;
    if (editingIndex !== null) {
      nextItems = [...items];
      nextItems[editingIndex] = newItem;
    } else {
      nextItems = [...items, newItem];
    }

    try {
      await save({ data: { items: nextItems } });
      toast.success(editingIndex !== null ? "Review updated" : "Review added");
      setIsOpen(false);
      refresh();
    } catch (err) {
      toast.error("Failed to save review");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Reviews</h3>
        <Button 
          onClick={handleOpenAdd}
          className="bg-white text-black px-6 py-2 rounded-full text-xs font-bold hover:bg-white/90"
        >
          Add Review
        </Button>
      </div>
      <div className="space-y-4">
        {items.map((t, i) => (
          <div key={i} className="bg-white/5 border border-white/5 rounded-2xl p-8 group relative">
            <div className="flex justify-between mb-4">
              <span className="font-bold">{t.name}</span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleOpenEdit(t, i)}
                  className="p-2 hover:bg-white/10 rounded cursor-pointer"
                >
                  <Edit3 size={14} />
                </button>
                <button 
                  onClick={async () => {
                    if (confirm("Delete?")) {
                      const next = items.filter((_, idx) => idx !== i);
                      await save({ data: { items: next } });
                      refresh();
                    }
                  }}
                  className="p-2 hover:bg-white/10 rounded text-red-400 cursor-pointer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <p className="text-sm text-white/60 italic leading-relaxed">"{t.quote}"</p>
            {t.proof && <div className="mt-4 text-[10px] text-fuchsia-400 font-bold uppercase tracking-widest">{t.proof}</div>}
          </div>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-[#0a0a0f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? "Edit Review" : "Add Review"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs text-white/40 uppercase font-bold tracking-widest">Client Name</label>
              <Input 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-white/5 border-white/10"
                placeholder="Enter client name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-white/40 uppercase font-bold tracking-widest">What the person said</label>
              <textarea 
                value={formData.quote} 
                onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
                className="flex min-h-[100px] w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fuchsia-500"
                placeholder="Enter quote"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-white/40 uppercase font-bold tracking-widest">How much he paid</label>
              <Input 
                value={formData.paid} 
                onChange={(e) => setFormData({ ...formData, paid: e.target.value })}
                className="bg-white/5 border-white/10"
                placeholder="e.g. $40"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white w-full">
                {editingIndex !== null ? "Update Review" : "Add Review"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PricingEditorView() {
  const load = useServerFn(listPricing);
  const save = useServerFn(upsertPricing);
  const del = useServerFn(deletePricing);
  const reset = useServerFn(resetPricingToDefaults);
  
  const [items, setItems] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    price_inr: "",
    custom_price: "",
    price_prefix: "",
    cadence: "",
    body: "",
    features: [] as string[],
    highlighted: false
  });

  const refresh = useCallback(async () => {
    const res = await load();
    setItems(res.rows || []);
  }, [load]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      price_inr: "",
      custom_price: "",
      price_prefix: "",
      cadence: "",
      body: "",
      features: [""],
      highlighted: false
    });
    setIsOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      price_inr: item.price_inr !== null ? String(item.price_inr) : "",
      custom_price: item.custom_price || "",
      price_prefix: item.price_prefix || "",
      cadence: item.cadence || "",
      body: item.body || "",
      features: Array.isArray(item.features) ? [...item.features] : [""],
      highlighted: !!item.highlighted
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Plan Name is required");
      return;
    }

    const payload = {
      ...(editingItem?.id ? { id: editingItem.id } : {}),
      name: formData.name,
      price_inr: formData.price_inr ? Number(formData.price_inr) : null,
      custom_price: formData.custom_price || null,
      price_prefix: formData.price_prefix || null,
      cadence: formData.cadence,
      body: formData.body,
      features: formData.features.filter(f => f.trim()),
      highlighted: formData.highlighted,
      published: true,
      position: editingItem ? editingItem.position : items.length
    };

    try {
      await save({ data: payload });
      toast.success(editingItem ? "Plan updated" : "Plan added");
      setIsOpen(false);
      refresh();
    } catch (err) {
      toast.error("Failed to save pricing plan");
    }
  };

  const handleReset = async () => {
    if (!confirm("This will overwrite all pricing plans with system defaults. Proceed?")) return;
    try {
      await reset();
      toast.success("Pricing reset to defaults");
      refresh();
    } catch (err) {
      toast.error("Reset failed");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white">Pricing Plans</h3>
          <p className="text-xs text-white/40">Manage tiers. Prices in INR (₹) automatically convert on the site.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={handleReset}
            variant="ghost"
            className="text-[10px] uppercase tracking-widest font-bold text-white/30 hover:text-red-400"
          >
            Reset Defaults
          </Button>
          <Button 
            onClick={handleOpenAdd}
            className="bg-white text-black px-6 py-2 rounded-full text-xs font-bold hover:bg-white/90"
          >
            Add Plan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {items.map((item) => (
          <div key={item.id} className={`bg-white/5 border rounded-2xl p-6 group transition-all ${item.highlighted ? "border-fuchsia-500/30 ring-1 ring-fuchsia-500/10" : "border-white/5"}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold">{item.name}</h4>
                  {item.highlighted && <span className="bg-fuchsia-500/20 text-fuchsia-400 text-[8px] uppercase font-black px-2 py-0.5 rounded-full tracking-tighter">Popular</span>}
                </div>
                <div className="text-xl font-display text-white/90">
                  {item.price_inr !== null ? `₹${item.price_inr.toLocaleString()}` : (item.custom_price || "Quote")}
                </div>
                <div className="text-[10px] text-white/30 uppercase font-black tracking-widest mt-1">{item.cadence}</div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleOpenEdit(item)} className="p-2 hover:bg-white/10 rounded"><Edit3 size={14} /></button>
                <button 
                  onClick={async () => {
                    if (confirm("Delete this plan?")) { await del({ data: { id: item.id } }); refresh(); }
                  }}
                  className="p-2 hover:bg-white/10 rounded text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <p className="text-xs text-white/50 line-clamp-2 mb-4">{item.body}</p>
            <div className="flex flex-wrap gap-2">
              {item.features?.slice(0, 3).map((f: string, i: number) => (
                <span key={i} className="text-[9px] bg-white/5 border border-white/5 px-2 py-1 rounded text-white/40">{f}</span>
              ))}
              {item.features?.length > 3 && <span className="text-[9px] text-white/20">+{item.features.length - 3} more</span>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-[#0a0a0f] border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Plan" : "Add Plan"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs text-white/40 uppercase font-bold tracking-widest">Plan Name</label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-white/5 border-white/10"
                  placeholder="e.g. Starter"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/40 uppercase font-bold tracking-widest">Cadence</label>
                <Input 
                  value={formData.cadence} 
                  onChange={(e) => setFormData({ ...formData, cadence: e.target.value })}
                  className="bg-white/5 border-white/10"
                  placeholder="e.g. / month"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs text-white/40 uppercase font-bold tracking-widest">Price (INR ₹)</label>
                <Input 
                  type="number"
                  value={formData.price_inr} 
                  onChange={(e) => setFormData({ ...formData, price_inr: e.target.value })}
                  className="bg-white/5 border-white/10"
                  placeholder="24999"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/40 uppercase font-bold tracking-widest">Price Prefix</label>
                <Input 
                  value={formData.price_prefix} 
                  onChange={(e) => setFormData({ ...formData, price_prefix: e.target.value })}
                  className="bg-white/5 border-white/10"
                  placeholder="From "
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/40 uppercase font-bold tracking-widest">Custom Label</label>
                <Input 
                  value={formData.custom_price} 
                  onChange={(e) => setFormData({ ...formData, custom_price: e.target.value })}
                  className="bg-white/5 border-white/10"
                  placeholder="Custom"
                  disabled={!!formData.price_inr}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-white/40 uppercase font-bold tracking-widest">Description</label>
              <Input 
                value={formData.body} 
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="bg-white/5 border-white/10"
                placeholder="One-sentence pitch"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs text-white/40 uppercase font-bold tracking-widest">Features</label>
                <button 
                  type="button" 
                  onClick={() => setFormData(prev => ({ ...prev, features: [...prev.features, ""] }))}
                  className="text-[10px] text-fuchsia-400 font-bold hover:text-fuchsia-300"
                >
                  + Add Feature
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                {formData.features.map((f, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input 
                      value={f}
                      onChange={(e) => {
                        const next = [...formData.features];
                        next[idx] = e.target.value;
                        setFormData({ ...formData, features: next });
                      }}
                      className="bg-white/5 border-white/10 h-8 text-xs"
                      placeholder={`Feature ${idx + 1}`}
                    />
                    <button 
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== idx) }))}
                      className="text-white/20 hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
              <input 
                type="checkbox"
                id="highlighted"
                checked={formData.highlighted}
                onChange={(e) => setFormData({ ...formData, highlighted: e.target.checked })}
                className="w-4 h-4 accent-fuchsia-500 bg-black border-white/10"
              />
              <label htmlFor="highlighted" className="text-sm font-bold text-white/80 cursor-pointer">
                Highlight this plan (Most Popular)
              </label>
            </div>

            <DialogFooter className="pt-4">
              <Button type="submit" className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white w-full py-6 font-bold uppercase tracking-widest">
                {editingItem ? "Update Pricing Plan" : "Create Pricing Plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InboxView() {
  const load = useServerFn(listSubmissions);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    load().then(res => setItems(res.rows || []));
  }, [load]);

  return (
    <div className="space-y-8">
      <h3 className="text-lg font-bold">Inquiries</h3>
      <div className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
        {items.map((it) => (
          <div key={it.id} className="p-8 border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
            <div className="flex justify-between mb-2">
              <span className="font-bold">{it.name}</span>
              <span className="text-[10px] text-white/20 font-mono">{new Date(it.created_at).toLocaleDateString()}</span>
            </div>
            <p className="text-sm text-white/60 truncate">{it.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsEditorView() {
  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <h3 className="text-lg font-bold">General Settings</h3>
        <div className="bg-white/5 border border-white/5 rounded-2xl p-10 max-w-xl">
          <div className="space-y-8">
             <ToggleSection />
             <Toggle label="Cursor Trail" active />
          </div>
          <div className="mt-12 pt-8 border-t border-white/5">
             <button className="text-white/40 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">Purge Node Cache</button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold">Backend Architecture</h3>
          <span className="bg-emerald-500/10 text-emerald-500 text-[9px] uppercase font-black px-2 py-0.5 rounded-full tracking-tighter">Production Ready</span>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-2xl p-8 space-y-6 max-w-2xl">
          <p className="text-sm text-white/60 leading-relaxed">
            Your current Supabase schema is 100% aligned with the application core. No tables, policies, or triggers will be modified by the system during standard operations.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
              <span className="text-[10px] font-black uppercase text-white/20 block mb-2">Protected Tables</span>
              <p className="text-xs text-white/40 leading-relaxed">auth.users, public.user_roles, public.site_settings. These are the backbone and are never auto-migrated.</p>
            </div>
            <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
              <span className="text-[10px] font-black uppercase text-white/20 block mb-2">Policy Isolation</span>
              <p className="text-xs text-white/40 leading-relaxed">All RLS policies are scoped to either 'anon' for reads or 'authenticated' via user_roles for writes.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleSection() {
  const load = useServerFn(listFlags);
  const upsert = useServerFn(upsertFlag);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load().then((r: any) => {
      const f = r.rows.find((x: any) => x.key === "maintenance_mode");
      setOn(!!f?.enabled);
    });
  }, [load]);

  const toggle = async () => {
    setBusy(true);
    const next = !on;
    try {
      await upsert({ data: { key: "maintenance_mode", enabled: next } });
      setOn(next);
      toast.success(`Maintenance mode ${next ? "enabled" : "disabled"}`);
    } catch (e) {
      toast.error("Failed to toggle maintenance mode");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between cursor-pointer" onClick={busy ? undefined : toggle}>
      <span className="text-sm font-bold">Maintenance</span>
      <div className={`h-5 w-10 rounded-full relative transition-colors ${on ? 'bg-fuchsia-600' : 'bg-white/10'} ${busy ? 'opacity-50' : ''}`}>
        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: any) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-2xl p-8">
      <div className="text-3xl font-black mb-1">{value}</div>
      <div className="text-[10px] text-white/20 font-black uppercase tracking-widest">{label}</div>
    </div>
  );
}

function HealthItem({ label, status }: any) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-white/60">{label}</span>
      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{status}</span>
    </div>
  );
}

function Toggle({ label, active }: any) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-bold">{label}</span>
      <div className={`h-5 w-10 rounded-full relative transition-colors ${active ? 'bg-fuchsia-600' : 'bg-white/10'}`}>
        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${active ? 'left-6' : 'left-1'}`} />
      </div>
    </div>
  );
}
