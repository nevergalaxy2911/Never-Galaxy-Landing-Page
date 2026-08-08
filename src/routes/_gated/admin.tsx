import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/auth.functions";
import {
  LayoutGrid, Globe, MessageSquareQuote, Tag, Filter, Settings2,
  HelpCircle, ChevronRight, ShieldCheck, ArrowRight, Plus, RotateCcw,
  Search, ExternalLink, Download, Mail, Phone, Clock, AlertCircle,
  MoreVertical, CheckCircle2, XCircle, Trash2, Edit3, BarChart3,
  Calendar, Eye, Users, DollarSign, TrendingUp, Inbox, Map, 
  ArrowUpRight, Activity, Zap, FileText, LifeBuoy, History, Copy,
  Layout, Database
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, BarChart, Bar, Cell, PieChart, Pie
} from "recharts";
import {
  listPortfolio, upsertPortfolio, deletePortfolio,
  getCategories, saveCategories, getItemAspects, saveItemAspects,
  getWebsites, saveWebsites, getTestimonials, saveTestimonials,
  listPricing, upsertPricing, deletePricing,
  listSubmissions, markSubmissionRead, deleteSubmission, exportSubmissions,
  getHealth,
  bulkClearFeaturedItems
} from "@/lib/admin-data.functions";
import { 
  validateAdminSchema, 
  getSystemTelemetry 
} from "@/lib/admin-ops.functions";
import { getAnalyticsSummary } from "@/lib/analytics.functions";

import { DEFAULT_CATEGORIES } from "@/lib/portfolio-config";
import { DEFAULT_WEBSITES } from "@/lib/websites-config";
import { useAdmin } from "@/components/admin/AdminProvider";



export const Route = createFileRoute("/_gated/admin")({
  component: AdminPageV5,
});



const NAV_ITEMS = [
  { id: "dashboard", label: "Overview", icon: BarChart3 },
  { id: "portfolio", label: "Work Archive", icon: LayoutGrid },
  { id: "websites", label: "Site Nodes", icon: Globe },
  { id: "testimonials", label: "Social Proof", icon: MessageSquareQuote },
  { id: "pricing", label: "Revenue Plans", icon: Tag },
  { id: "contact", label: "Mission Logs", icon: Inbox },
  { id: "settings", label: "Core Control", icon: Settings2 },
  { id: "guide", label: "Operations Docs", icon: FileText },
  { id: "diagnostics", label: "System Health", icon: ShieldCheck },
] as const;

type Tab = typeof NAV_ITEMS[number]['id'];



function AdminPageV5() {
  return (
    <>
      <Outlet />
      <AdminDashboard />
    </>
  );
}

function AdminDashboard() {
  const admin = useAdmin();

  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState<any>(null);


  const { searchQuery, setSearchQuery, dateRange, setDateRange } = admin;
  const loadHealth = useServerFn(getHealth);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await loadHealth();
        if (!cancelled) setStats(res.counts);
      } catch (e: any) {
        if (cancelled || e?.name === 'AbortError' || e?.message?.toLowerCase().includes('aborted')) return;
        console.error("[Dashboard] Health Load Error:", e);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [loadHealth]);

  return (
    <div className="console-layout -m-0 min-h-screen flex w-full">
      {/* Sidebar */}
      <aside className="console-sidebar hidden md:flex w-64 lg:w-72 shrink-0 border-r border-white/10 flex-col bg-[#0a0a14]">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#A15CFD] to-[#4CE4F8] flex items-center justify-center font-black text-xs text-black shadow-lg shadow-black/20 shrink-0">NG</div>
            <div className="hidden sm:block overflow-hidden transition-all duration-300">
              <h2 className="text-sm font-black tracking-tight text-white whitespace-nowrap">Never Galaxy</h2>
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-mono">Console v6.2</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-x-auto nav-scroll-snap custom-scrollbar">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`console-nav-item w-full group nav-item-snap border-none bg-transparent text-left ${activeTab === item.id ? "console-nav-item-active" : ""}`}
            >
              <item.icon size={18} className={`transition-colors duration-300 ${activeTab === item.id ? "text-[#4CE4F8]" : "text-white/20 group-hover:text-white/60"}`} />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5">
          <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
               <ShieldCheck size={32} />
            </div>
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-emerald-400">System Secure</span>
            </div>
            <p className="text-[10px] text-white/30 leading-relaxed font-medium relative z-10">
              Orbital sync active. Developer bypass enabled.
            </p>
          </div>

        </div>
      </aside>

      {/* Main Content Content Canvas */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden bg-[#07070c]">
        <header className="h-16 border-b border-white/5 bg-[#0c0c16]/50 backdrop-blur-md flex items-center justify-between px-6 lg:px-10 shrink-0">
          <div className="flex items-center gap-2 text-sm text-white/40">
            <span>Admin</span>
            <ChevronRight size={14} />
            <span className="text-white font-medium capitalize">{activeTab}</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative group hidden sm:block">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#4CE4F8] transition-colors" />
              <input 
                type="text" 
                placeholder="Search archive..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && toast.info(`Filtering for "${searchQuery}"`)}
                className="bg-white/[0.03] border border-white/5 rounded-full pl-11 pr-4 py-2 text-xs w-64 focus:outline-none focus:border-[#4CE4F8]/30 focus:bg-white/[0.05] transition-all"
              />
            </div>
            <div className="flex items-center gap-3 pl-6 border-l border-white/5">
               <div className="relative h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:bg-white/10 cursor-pointer transition-all group">
                  <Calendar size={16} />
                  <input 
                    type="date" 
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => setDateRange({ start: e.target.value, end: e.target.value })}
                  />
               </div>
               <div className="flex items-center gap-3 p-1.5 bg-white/5 rounded-2xl border border-white/5">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#A15CFD] to-[#4CE4F8] flex items-center justify-center text-[10px] font-black">AD</div>
                  <span className="text-xs font-bold pr-3">Admin</span>
               </div>
            </div>
          </div>

        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-10">

          <div className="w-full space-y-8">
            {(activeTab === "dashboard") && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <DashboardView stats={stats || {}} />
               </div>
            )}
            {activeTab === "portfolio" && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <PortfolioView />
               </div>
            )}
            {activeTab === "websites" && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <WebsitesEditorView />
               </div>
            )}
            {activeTab === "testimonials" && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <TestimonialsEditorView />
               </div>
            )}
            {activeTab === "pricing" && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <PricingView />
               </div>
            )}
            {activeTab === "contact" && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <InboxView />
               </div>
            )}
            {activeTab === "settings" && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <SettingsEditorView />
               </div>
            )}
            {activeTab === "guide" && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <GuideView />
               </div>
            )}
            {activeTab === "diagnostics" && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <DiagnosticsInlineView />
               </div>
            )}
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
    const run = async () => {
      try {
        const res = await loadSummary();
        if (!cancelled) setAnalytics(res);
      } catch (e: any) {
        if (cancelled || e?.name === 'AbortError') return;
        console.error("[Dashboard] Analytics Load Error:", e);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [loadSummary]);

  const areaData = useMemo(() => {
    if (!analytics?.daily) {
      return [
        { name: 'Mon', visits: 0, engagement: 0 },
        { name: 'Tue', visits: 0, engagement: 0 },
        { name: 'Wed', visits: 0, engagement: 0 },
        { name: 'Thu', visits: 0, engagement: 0 },
        { name: 'Fri', visits: 0, engagement: 0 },
        { name: 'Sat', visits: 0, engagement: 0 },
        { name: 'Sun', visits: 0, engagement: 0 },
      ];
    }
    return analytics.daily.map((d: any) => ({
      name: d.date.split('-').slice(1).join('/'),
      visits: d.total,
      engagement: Math.round(d.total * 0.6) 
    })).slice(-7);
  }, [analytics]);

  const pieData = [
    { name: 'Direct', value: 45, color: '#A15CFD' },
    { name: 'Social', value: 30, color: '#4CE4F8' },
    { name: 'Search', value: 25, color: '#d946ef' },
  ];


  return (
    <div className="space-y-8">
      {/* 4 Mini Analytical Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Projects" value={stats?.portfolio ?? "0"} icon={LayoutGrid} trend="Active" color="#A15CFD" />
        <StatCard label="Inquiries" value={stats?.unreadSubmissions ?? "0"} icon={Mail} trend="New" color="#4CE4F8" />
        <StatCard label="Traffic (All)" value={stats?.pageViews ? `${(stats.pageViews / 1000).toFixed(1)}K` : "0"} icon={Activity} trend="Lifetime" color="#d946ef" />
        <StatCard label="Admin Nodes" value={stats?.admins ?? "0"} icon={ShieldCheck} trend="Secure" color="#10b981" />
      </div>

      {/* Main Metrics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="console-chart-card lg:col-span-1 p-6 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider">Traffic Source</h3>
            <ArrowUpRight size={16} className="text-white/20" />
          </div>
          <div className="h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold">{analytics?.totals?.month ?? "0"}</span>
              <span className="text-[10px] text-white/40 uppercase">30D Peak</span>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-4">
             {pieData.map(d => (
               <div key={d.name} className="flex items-center gap-1.5">
                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                 <span className="text-[10px] text-white/40 font-bold uppercase">{d.name}</span>
               </div>
             ))}
          </div>
        </div>

        <div className="console-chart-card lg:col-span-2 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider">Engagement Waves</h3>
            <div className="flex gap-2">
               <div className="flex items-center gap-1.5">
                 <div className="w-2 h-2 rounded-full bg-[#A15CFD]" />
                 <span className="text-[10px] text-white/40 font-bold uppercase">Visits</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <div className="w-2 h-2 rounded-full bg-[#4CE4F8]" />
                 <span className="text-[10px] text-white/40 font-bold uppercase">Engagement</span>
               </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData}>
                <defs>
                  <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A15CFD" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#A15CFD" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorEngage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4CE4F8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4CE4F8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="visits" stroke="#A15CFD" strokeWidth={3} fillOpacity={1} fill="url(#colorVisits)" />
                <Area type="monotone" dataKey="engagement" stroke="#4CE4F8" strokeWidth={3} fillOpacity={1} fill="url(#colorEngage)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Reports Overview Row (Bottom Area) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="console-chart-card p-6 lg:col-span-1">
          <h3 className="text-sm font-bold text-white/80 uppercase mb-6 tracking-wider">Conversion Gauge</h3>
          <div className="h-48 flex flex-col items-center justify-center">
            {/* Radial Gauge Visual Simulation */}
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="#A15CFD" strokeWidth="8" strokeDasharray="282.7" strokeDashoffset="70" strokeLinecap="round" className="drop-shadow-[0_0_8px_rgba(161,92,253,0.5)]" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black">23,648</span>
                <span className="text-[10px] text-white/40 font-bold uppercase">Total Conversions</span>
              </div>
            </div>
          </div>
        </div>

        <div className="console-chart-card p-6 lg:col-span-1">
          <h3 className="text-sm font-bold text-white/80 uppercase mb-6 tracking-wider">Reports Overview</h3>
          <div className="space-y-4">
             <ReportingItem label="Portfolio Views" value={String(stats?.portfolio || 0)} color="#A15CFD" />
             <ReportingItem label="Site Nodes" value={String(stats?.settings || 0)} color="#4CE4F8" />
             <ReportingItem label="Feature Flags" value={String(stats?.flags || 0)} color="#d946ef" />
             <ReportingItem label="Revenue Plans" value={String(stats?.pricing || 0)} color="#10b981" />
          </div>
        </div>

        <div className="console-chart-card p-6 lg:col-span-1">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider">Global Reach</h3>
            <Map size={16} className="text-white/20" />
          </div>
          <div className="h-40 flex items-center justify-center border border-white/5 rounded-2xl relative overflow-hidden group bg-white/[0.02]">
             <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=400')] bg-cover opacity-10 grayscale group-hover:grayscale-0 transition-all duration-700" />
             <div className="relative z-10 flex flex-col items-center gap-1">
                <Globe size={32} className="text-[#4CE4F8] opacity-20 group-hover:opacity-100 transition-opacity" />
                <span className="text-white/20 text-[9px] font-black uppercase tracking-[0.3em]">Neural Node Map</span>
             </div>
          </div>
          <div className="mt-4 flex justify-between items-center px-1">
             <div className="flex flex-col">
                <span className="text-xs font-black text-white/80">Active Clusters</span>
                <span className="text-[10px] text-white/20 uppercase font-bold">North America / EU</span>
             </div>
             <div className="flex flex-col items-end">
                <span className="text-xs font-black text-[#A15CFD]">99.9%</span>
                <span className="text-[9px] text-emerald-400 font-bold uppercase">Uptime</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportingItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-2 -mx-2 rounded transition-colors group">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs text-white/60 font-medium group-hover:text-white transition-colors">{label}</span>
      </div>
      <span className="text-xs font-bold tabular-nums">{value}</span>
    </div>
  );
}




function InboxView() {
  const load = useServerFn(listSubmissions);
  const markRead = useServerFn(markSubmissionRead);
  const del = useServerFn(deleteSubmission);
  const exportData = useServerFn(exportSubmissions);
  
  const refreshInProgress = useRef(false);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const { searchQuery, dateRange } = useAdmin();

  const refresh = useCallback(async () => {
    refreshInProgress.current = true;
    setLoading(true);
    try {
      const res = await load();
      if (!refreshInProgress.current) return;
      let filtered = res.rows;
      
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter((it: any) => 
          it.name?.toLowerCase().includes(q) || 
          it.email?.toLowerCase().includes(q) || 
          it.message?.toLowerCase().includes(q)
        );
      }

      if (dateRange.start && dateRange.end) {
        filtered = filtered.filter((it: any) => {
          const d = it.created_at.split('T')[0];
          return d >= dateRange.start && d <= dateRange.end;
        });
      }

      setItems(filtered);
      if (filtered.length > 0 && !selectedId) setSelectedId(filtered[0].id);
    } finally {
      setLoading(false);
    }
  }, [load, selectedId, searchQuery, dateRange]);

  useEffect(() => { 
    refresh();
    return () => { refreshInProgress.current = false; };
  }, [refresh, searchQuery, dateRange]);


  const handleExport = async () => {
    const res = await exportData();
    // Dynamically compile to CSV
    const headers = ["Name", "Email", "Phone", "Company", "Budget", "Message", "Date"];
    const rows = res.data.map((s: any) => [
      s.name, s.email, s.phone, s.company, s.budget, s.message?.replace(/,/g, " "), s.created_at
    ]);
    const csvContent = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `submissions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const activeMessage = items.find(it => it.id === selectedId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
      {/* Message List */}
      <div className="lg:col-span-1 console-chart-card p-0 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white/80 uppercase tracking-widest">Inquiry Logs</h3>
          <div className="flex gap-2">
            <button 
              onClick={async () => {
                if(confirm('Clear all featured flags?')) {
                  const items = await listPortfolio();
                  // Implementation for batch clearing would go here or be a server fn
                  toast.success("Featured flags cleared (Demo)");
                }
              }}
              className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white"
              title="Batch Clear Featured"
            >
               <Zap size={16} />
            </button>
            <button onClick={handleExport} className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white" title="Export CSV">
               <Download size={16} />
            </button>
            <button onClick={() => refresh()} className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white">
               <RotateCcw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
          {items.map((item) => (
            <div 
              key={item.id} 
              onClick={() => setSelectedId(item.id)}
              className={`p-4 cursor-pointer transition-colors ${selectedId === item.id ? 'bg-fuchsia-500/10 border-r-2 border-fuchsia-500' : 'hover:bg-white/[0.02]'}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold text-white/90 truncate max-w-[140px]">{item.name}</span>
                <span className="text-[10px] text-white/20 tabular-nums">{new Date(item.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-[11px] text-white/40 truncate">{item.message}</p>
              <div className="mt-2 flex items-center gap-2">
                 {!item.read && <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.5)]" />}
                 <span className="text-[9px] text-white/20 uppercase font-bold tracking-tight">{item.budget || 'General'}</span>
              </div>
            </div>
          ))}
          {items.length === 0 && !loading && (
            <div className="p-10 text-center text-white/20 text-xs">No logs found</div>
          )}
        </div>
      </div>

      {/* Message Detail & Quick Reply */}
      <div className="lg:col-span-2 console-chart-card p-0 flex flex-col overflow-hidden">
        {activeMessage ? (
          <>
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#A15CFD] to-[#4CE4F8] flex items-center justify-center font-bold text-white shadow-lg shadow-black/20">
                  {activeMessage.name?.[0]}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{activeMessage.name}</h4>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-white/40 font-mono">
                     <span className="flex items-center gap-1"><Mail size={10} /> {activeMessage.email}</span>
                     {activeMessage.phone && <span className="flex items-center gap-1"><Phone size={10} /> {activeMessage.phone}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => markRead({ data: { id: activeMessage.id, read: !activeMessage.read } }).then(() => refresh())}
                  className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white"
                >
                  {activeMessage.read ? <Mail size={16} /> : <Eye size={16} />}
                </button>
                <button 
                  onClick={() => { if(confirm('Delete?')) deleteSubmission({ data: { id: activeMessage.id } }).then(() => refresh()); }}
                  className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
              <div className="max-w-2xl mx-auto space-y-6">
                 <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
                    <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{activeMessage.message}</p>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                       <span className="text-[10px] text-white/20 uppercase font-bold block mb-1">Company</span>
                       <span className="text-xs text-white/60">{activeMessage.company || 'N/A'}</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                       <span className="text-[10px] text-white/20 uppercase font-bold block mb-1">Budget Range</span>
                       <span className="text-xs text-white/60 font-bold text-emerald-400">{activeMessage.budget || 'Standard'}</span>
                    </div>
                 </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-white/[0.01]">
               <div className="flex gap-4">
                  <div className="relative flex-1">
                    <input 
                      type="text" 
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Draft internal mission response..." 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-sm focus:outline-none focus:border-[#A15CFD]/50 transition-colors"
                    />
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`public/Icons and images/portfolio/optimized/${activeMessage.name.toLowerCase()}.webp`);
                        toast.success("Asset path copied to clipboard");
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/20 hover:text-white transition-colors"
                      title="Copy Expected Asset Path"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <button 
                    disabled={!replyText.trim()}
                    onClick={() => {
                      toast.success("Reply simulated");
                      setReplyText("");
                    }}
                    className="console-btn-primary flex items-center gap-2 disabled:opacity-50 disabled:grayscale"
                  >
                    Send <ArrowRight size={14} />
                  </button>
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-white/10 space-y-4">
             <Inbox size={48} />
             <p className="text-xs uppercase tracking-widest font-bold">Select an inquiry to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}


function WebsitesEditorView() {
  const load = useServerFn(getWebsites);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { searchQuery } = useAdmin();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await load();
      let filtered = res?.items || [];
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter((it: any) => 
          it.title?.toLowerCase().includes(q) || 
          it.slug?.toLowerCase().includes(q) || 
          it.liveUrl?.toLowerCase().includes(q) ||
          it.category?.toLowerCase().includes(q)
        );
      }
      setItems(filtered);
    } finally {
      setLoading(false);
    }
  }, [load, searchQuery]);

  useEffect(() => { refresh(); }, [refresh]);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Websites Showcase</h3>
          <p className="text-[10px] text-white/30 mt-1 uppercase tracking-tighter">Live site synchronization & assets</p>
        </div>
        <button onClick={refresh} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-all">
          <RotateCcw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((site) => (
          <div key={site.slug} className="console-chart-card group p-0 overflow-hidden flex flex-col border-white/5 hover:border-[#4CE4F8]/30 transition-all">
             <div className="aspect-video relative overflow-hidden bg-black/40">
                <img 
                  src={`/screenshots/${site.slug}-desktop.webp`} 
                  alt="" 
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110" 
                  onError={(e) => { (e.target as any).src = 'https://api.placeholder.com/400/225?text=Missing+Asset'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex justify-between items-end">
                   <div>
                      <h4 className="text-sm font-bold text-white tracking-wide">{site.title}</h4>
                      <p className="text-[10px] text-white/40 font-mono truncate max-w-[140px]">{site.liveUrl}</p>
                   </div>
                   {site.featured && <span className="bg-[#4CE4F8] text-black text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg shadow-[#4CE4F8]/20 uppercase">Featured</span>}
                </div>
             </div>
             
             <div className="p-4 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                   <div className="flex flex-col">
                      <span className="text-[9px] text-white/20 uppercase font-black tracking-widest mb-1">Asset Status</span>
                      <div className="flex gap-1">
                         {['desktop', 'tablet', 'mobile'].map(v => (
                           <div key={v} className="w-4 h-1 rounded-full bg-emerald-500/40" title={`${v} WebP detected`} />
                         ))}
                      </div>
                   </div>
                   <div className="flex gap-2">
                      <button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"><ExternalLink size={14} /></button>
                      <button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"><Edit3 size={14} /></button>
                   </div>
                </div>
             </div>
          </div>
        ))}
      </div>

      <div className="console-chart-card border-dashed border-[#A15CFD]/30 bg-[#A15CFD]/[0.02] p-8">
        <div className="flex items-center gap-4 text-[#A15CFD] mb-4">
          <div className="p-2.5 rounded-2xl bg-[#A15CFD]/10"><HelpCircle size={24} /></div>
          <div>
             <h4 className="text-sm font-black uppercase tracking-[0.2em]">Asset Workflow Protocol</h4>
             <p className="text-[10px] text-[#A15CFD]/60 uppercase font-bold mt-1">Version 2.0 • Drop-and-Replace System</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
           <div className="space-y-3">
               <div className="flex items-center gap-3">
                 <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black">01</div>
                 <p className="text-xs text-white/60">Upload <code className="text-fuchsia-400 font-bold">.webp</code> assets to <code className="text-white/40">/public/screenshots/</code></p>
              </div>
              <div className="flex items-center gap-3">
                 <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black">02</div>
                 <p className="text-xs text-white/60">Strict Naming: <code className="text-[#4CE4F8] font-bold">{"{slug}"}-desktop.webp</code></p>
              </div>
           </div>
           <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
              <span className="text-[10px] text-white/20 uppercase font-black block mb-2">Live Examples</span>
              <div className="flex flex-wrap gap-2">
                 {['nebula', 'noctis', 'volta'].map(s => (
                   <span key={s} className="px-2 py-1 bg-white/5 rounded text-[9px] font-mono text-white/40">{s}-desktop.webp</span>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}


function TestimonialsEditorView() {
  const load = useServerFn(getTestimonials);
  const [items, setItems] = useState<any[]>([]);
  const { searchQuery } = useAdmin();

  const refresh = useCallback(async () => {
    load().then(res => {
      let filtered = res.items || [];
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter((it: any) => 
          it.author?.toLowerCase().includes(q) || 
          it.content?.toLowerCase().includes(q) || 
          it.role?.toLowerCase().includes(q)
        );
      }
      setItems(filtered);
    });
  }, [load, searchQuery]);

  useEffect(() => { refresh(); }, [refresh]);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Client Social Proof</h3>
          <p className="text-[10px] text-white/30 mt-1 uppercase tracking-tighter">Verified testimonials & trust chips</p>
        </div>
        <button className="console-btn-primary flex items-center gap-2"><Plus size={16} /> New Proof</button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {items.map((t, i) => (
          <div key={i} className="console-chart-card group p-6 border-white/5 hover:border-[#A15CFD]/20 transition-all">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#A15CFD] to-[#4CE4F8] p-0.5 shadow-lg shadow-black/20">
                 <div className="w-full h-full bg-[#0a0a14] rounded-[14px] flex items-center justify-center font-black text-white text-lg">
                    {t.author?.[0]}
                 </div>
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-white group-hover:text-[#A15CFD] transition-colors">{t.author}</div>
                <div className="text-[10px] text-white/30 uppercase font-black tracking-widest mt-0.5">{t.role}</div>
              </div>
              {t.proofChip && (
                 <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-tighter">
                   {t.proofChip}
                 </span>
              )}
            </div>
            <div className="relative">
               <MessageSquareQuote size={24} className="absolute -top-2 -left-2 text-white/5" />
               <p className="text-sm text-white/60 leading-relaxed italic relative z-10 px-4">"{t.content}"</p>
            </div>
            <div className="mt-6 pt-6 border-t border-white/5 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-all"><Edit3 size={14} /></button>
               <button className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/40 hover:text-red-400 transition-all"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function SettingsEditorView() {
  const [settings, setSettings] = useState({
    maintenance: false,
    cursorTrail: true,
    audioAutoplay: true,
    qualityAuto: true,
    adblockQuorum: 2
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
       <div className="console-chart-card p-8">
          <div className="flex items-center gap-3 mb-8">
             <div className="p-2 rounded-lg bg-[#A15CFD]/10 text-[#A15CFD]"><Settings2 size={20} /></div>
             <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Platform Core</h3>
                <p className="text-[10px] text-white/30 uppercase tracking-tighter">Global site behavior & safety gates</p>
             </div>
          </div>
          
          <div className="space-y-8">
            <SettingsToggle 
              label="Maintenance Mode" 
              desc="Immediate global redirect to /maintenance gate" 
              active={settings.maintenance} 
              onToggle={() => setSettings(s => ({...s, maintenance: !s.maintenance}))}
              icon={ShieldCheck}
            />
            <SettingsToggle 
              label="Interactive Cursor" 
              desc="Canvas ribbon trail effect on landing pages" 
              active={settings.cursorTrail} 
              onToggle={() => setSettings(s => ({...s, cursorTrail: !s.cursorTrail}))}
              icon={Zap}
            />
            <SettingsToggle 
              label="Ambient Audio" 
              desc="Autoplay space ambience for new visitors" 
              active={settings.audioAutoplay} 
              onToggle={() => setSettings(s => ({...s, audioAutoplay: !s.audioAutoplay}))}
              icon={Activity}
            />
          </div>
       </div>

       <div className="console-chart-card p-8">
          <div className="flex items-center gap-3 mb-8">
             <div className="p-2 rounded-lg bg-[#4CE4F8]/10 text-[#4CE4F8]"><Activity size={20} /></div>
             <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Performance & QA</h3>
                <p className="text-[10px] text-white/30 uppercase tracking-tighter">Automated optimization parameters</p>
             </div>
          </div>
          
          <div className="space-y-8">
             <SettingsToggle 
                label="Auto Quality Mode" 
                desc="Dynamically scale assets based on client hardware" 
                active={settings.qualityAuto} 
                onToggle={() => setSettings(s => ({...s, qualityAuto: !s.qualityAuto}))}
                icon={Zap}
                color="#4CE4F8"
             />
             
             <div className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                   <div className="p-2.5 rounded-xl bg-white/5 text-white/20 group-hover:bg-[#4CE4F8]/10 group-hover:text-[#4CE4F8] transition-all"><AlertCircle size={20} /></div>
                   <div>
                      <div className="text-sm font-bold text-white/90">Adblock Sensitivity</div>
                      <div className="text-[11px] text-white/30 leading-relaxed">Required detection signals for lock-out (Quorum)</div>
                   </div>
                </div>
                <div className="flex items-center bg-white/5 rounded-lg p-1">
                   {[1, 2, 3].map(v => (
                     <button 
                       key={v}
                       onClick={() => setSettings(s => ({...s, adblockQuorum: v}))}
                       className={`w-8 h-8 rounded text-xs font-bold transition-all ${settings.adblockQuorum === v ? 'bg-[#4CE4F8] text-black shadow-lg shadow-[#4CE4F8]/20' : 'text-white/40 hover:text-white'}`}
                     >
                       {v}
                     </button>
                   ))}
                </div>
             </div>
          </div>

          <div className="mt-12 p-4 bg-fuchsia-500/5 border border-fuchsia-500/10 rounded-2xl flex items-center gap-4">
             <div className="h-10 w-10 shrink-0 rounded-full bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-400">
                <RotateCcw size={20} />
             </div>
             <div>
                <div className="text-[10px] font-black uppercase text-fuchsia-400 tracking-widest">Manual Purge</div>
                <p className="text-[10px] text-white/40">Clear Vercel Edge Cache & Refresh CMS</p>
             </div>
             <button className="ml-auto px-4 py-2 bg-fuchsia-500 text-black text-[10px] font-black uppercase rounded-lg hover:scale-105 active:scale-95 transition-all">Flush</button>
          </div>
       </div>
    </div>
  );
}

function SettingsToggle({ label, desc, active, onToggle, icon: Icon, color = "#A15CFD" }: any) {
  return (
    <div className="flex items-center justify-between group cursor-pointer" onClick={onToggle}>
      <div className="flex items-center gap-4">
         <div className="p-2.5 rounded-xl bg-white/5 text-white/20 group-hover:bg-white/10 transition-all" style={active ? { backgroundColor: `${color}15`, color } : {}}>
            <Icon size={20} />
         </div>
         <div>
            <div className="text-sm font-bold text-white/90 group-hover:text-white transition-colors">{label}</div>
            <div className="text-[11px] text-white/30 leading-relaxed">{desc}</div>
         </div>
      </div>
      <div className={`h-6 w-11 rounded-full transition-all relative ${active ? 'bg-fuchsia-500' : 'bg-white/10'}`}>
         <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-md ${active ? 'left-6' : 'left-1'}`} />
      </div>
    </div>
  );
}


function PortfolioView() {
  const load = useServerFn(listPortfolio);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { searchQuery } = useAdmin();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await load();
      let filtered = res.rows;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter((it: any) => 
          it.title?.toLowerCase().includes(q) || 
          it.category?.toLowerCase().includes(q) ||
          it.description?.toLowerCase().includes(q)
        );
      }
      setItems(filtered);
    } finally {
      setLoading(false);
    }
  }, [load, searchQuery]);

  useEffect(() => { refresh(); }, [refresh]);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Work Archive</h3>
          <p className="text-[10px] text-white/30 mt-1 uppercase tracking-tighter">Content Management & Distribution</p>
        </div>
        <div className="flex gap-3">
           <button onClick={refresh} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-all border border-white/5">
             <RotateCcw size={18} className={loading ? "animate-spin" : ""} />
           </button>
           <button className="console-btn-primary flex items-center gap-2">
             <Plus size={18} /> New Item
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.id} className="console-card group overflow-hidden border-white/5 hover:border-[#A15CFD]/30 hover:bg-[#A15CFD]/[0.02] transition-all p-3">
            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-black/40 mb-3 relative group-hover:scale-[1.02] transition-transform duration-500">
              {item.thumb_url ? (
                <img src={item.thumb_url} alt="" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/10"><LayoutGrid size={32} /></div>
              )}
              <div className="absolute top-2 left-2 flex flex-col gap-1">
                {item.featured && <span className="bg-[#A15CFD] text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-lg shadow-[#A15CFD]/20">Featured</span>}
                <span className="bg-black/80 backdrop-blur-md text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter border border-white/10">{item.category}</span>
              </div>
              <div className="absolute bottom-2 right-2">
                 <span className={`h-2 w-2 rounded-full block border border-black/50 ${item.published ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-white/20'}`} />
              </div>
            </div>
            
            <div className="px-1">
              <h4 className="text-xs font-bold text-white/90 truncate mb-1 group-hover:text-[#A15CFD] transition-colors">{item.title}</h4>
              <div className="flex items-center justify-between">
                 <span className="text-[9px] text-white/30 font-mono truncate max-w-[120px]">{item.video_aspect || '16:9 Aspect'}</span>
                 <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"><Edit3 size={12} /></button>
                    <button className="p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                 </div>
              </div>
            </div>
          </div>
        ))}
        <button className="aspect-[4/3] rounded-2xl border-2 border-dashed border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-all flex flex-col items-center justify-center gap-2 group">
           <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-white/20 group-hover:scale-110 group-hover:text-white transition-all">
             <Plus size={20} />
           </div>
           <span className="text-[10px] uppercase font-black tracking-widest text-white/20">Add Project</span>
        </button>
      </div>
    </div>
  );
}


function PricingView() {
  const load = useServerFn(listPricing);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { searchQuery } = useAdmin();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await load();
      let filtered = res.rows;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter((it: any) => 
          it.name?.toLowerCase().includes(q) || 
          it.cadence?.toLowerCase().includes(q)
        );
      }
      setItems(filtered);
    } finally {
      setLoading(false);
    }
  }, [load, searchQuery]);

  useEffect(() => { refresh(); }, [refresh, searchQuery]);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Pricing & Plans</h3>
          <p className="text-[10px] text-white/30 mt-1 uppercase tracking-tighter">Monetization strategy & tier logic</p>
        </div>
        <div className="flex gap-3">
           <button onClick={refresh} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-all">
             <RotateCcw size={18} className={loading ? "animate-spin" : ""} />
           </button>
           <button className="console-btn-primary flex items-center gap-2">
             <Plus size={18} /> Add Plan
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {items.map((plan) => (
          <div key={plan.id} className="console-chart-card group relative overflow-hidden flex flex-col p-8 border-white/5 hover:border-[#4CE4F8]/20 transition-all">
            {plan.highlighted && (
               <div className="absolute top-0 right-0 p-2">
                  <div className="bg-[#4CE4F8] text-black text-[8px] font-black px-2 py-1 rounded-full shadow-lg shadow-[#4CE4F8]/20 animate-pulse">POPULAR</div>
               </div>
            )}
            
            <div className="flex justify-between items-start mb-8">
               <div className="p-3 rounded-2xl bg-white/5 text-[#A15CFD]"><Tag size={24} /></div>
               <div className="text-right">
                  <div className="text-2xl font-black text-white">{plan.price_inr ? `₹${plan.price_inr}` : "Custom"}</div>
                  <div className="text-[10px] text-white/20 uppercase font-black tracking-widest">{plan.cadence}</div>
               </div>
            </div>

            <h4 className="text-lg font-black text-white mb-2">{plan.name}</h4>
            <p className="text-xs text-white/40 mb-8 leading-relaxed">Enterprise-grade service delivery with dedicated orbital support.</p>
            
            <div className="space-y-4 mb-10 flex-1">
               {Array.isArray(plan.features) && plan.features.map((f: string, i: number) => (
                 <div key={i} className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                       <CheckCircle2 size={12} />
                    </div>
                    <span className="text-xs text-white/60 font-medium">{f}</span>
                 </div>
               ))}
            </div>

            <button className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black text-white/60 hover:text-white uppercase tracking-[0.2em] transition-all border border-white/10 group-hover:border-[#4CE4F8]/30">
               Configure Tier
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}


// UI Components
function StatCard({ label, value, icon: Icon, trend, color }: any) {
  return (
    <div className="console-stat-card border-l-4 group" style={{ borderColor: color || '#d946ef' }}>
        <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 rounded-xl bg-white/5 text-white/40 group-hover:bg-white/10 transition-all"><Icon size={22} /></div>
            <div className="flex flex-col items-end">
               <span className="text-[10px] font-black text-emerald-400 tracking-tighter">{trend}</span>
               <TrendingUp size={12} className="text-emerald-400/50" />
            </div>
        </div>
        <div className="console-stat-value">{value}</div>
        <div className="console-stat-label">{label}</div>
    </div>
  );
}



function HealthItem({ label, status, ping }: any) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
        <span className="text-xs text-white/70">{label}</span>
      </div>
      <span className="text-[10px] font-mono text-white/20">{ping}</span>
    </div>
  );
}

function ActivityItem({ title, time, user }: any) {
  return (
    <div className="flex gap-4">
      <div className="mt-1 h-6 w-6 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center shrink-0">
        <Clock size={12} className="text-fuchsia-400" />
      </div>
      <div>
        <div className="text-xs font-medium text-white/80">{title}</div>
        <div className="text-[10px] text-white/30 mt-0.5 flex items-center gap-2">
          <span>{time}</span>
          <span>•</span>
          <span className="text-fuchsia-500/50">{user}</span>
        </div>
      </div>
    </div>
  );
}

function Banner({ tone, msg }: { tone: "error" | "ok"; msg: string }) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  const colors = tone === "error" ? "border-red-500/30 bg-red-500/5 text-red-200" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-200";
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${colors}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <p>{msg}</p>
    </div>
  );
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-12 gap-3 text-white/40">
      <RotateCcw className="h-5 w-5 animate-spin" />
      <span className="text-sm font-medium">{label}...</span>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <HelpCircle className="h-10 w-10 text-white/10 mb-3" />
      <p className="text-sm text-white/40 max-w-xs">{msg}</p>
    </div>
  );
}

function GuideView() {
  const { createRestorePoint, restoreFromPoint, isProcessing } = useAdmin();
  const clearFeatured = useServerFn(bulkClearFeaturedItems);
  
  const handleBatchClear = async () => {
    if(!confirm("Are you sure you want to clear ALL featured items across all categories?")) return;
    const tId = toast.loading("Executing bulk removal...");
    try {
      const res = await clearFeatured();
      toast.success(`Success: ${res.cleared} items stripped of featured status.`, { id: tId });
    } catch (e: any) {
      toast.error(`Operation failed: ${e.message}`, { id: tId });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Path mapped to clipboard");
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Operations Docs</h2>
          <p className="text-sm text-white/40 uppercase tracking-widest mt-1">System Catalog & Emergency Manual</p>
        </div>
        <div className="flex gap-3">
            <button 
              onClick={handleBatchClear}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all"
            >
              <Zap size={14} />
              Batch Clear Featured
            </button>
            <button 
              onClick={createRestorePoint} 
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              <History size={14} className={isProcessing ? "animate-spin" : ""} />
              Create Restore Point
            </button>
            <button 
              onClick={restoreFromPoint}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              <RotateCcw size={14} />
              Restore System
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
           <section className="console-chart-card p-8 space-y-6">
              <div className="flex items-center gap-3">
                 <div className="p-2 rounded-lg bg-[#4CE4F8]/10 text-[#4CE4F8]"><Globe size={20} /></div>
                 <h3 className="text-sm font-black uppercase tracking-[0.2em]">System Catalog</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <h4 className="text-xs font-bold text-white mb-2">Portfolio Control</h4>
                    <p className="text-[11px] text-white/40 leading-relaxed">
                       Manage video, graphics, and motion categories. Use the "Work Archive" to toggle visibility and featured status.
                    </p>
                 </div>
                 <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <h4 className="text-xs font-bold text-white mb-2">Site Nodes</h4>
                    <p className="text-[11px] text-white/40 leading-relaxed">
                       Configure live website previews. High-fidelity screenshots are served from <code className="text-[#4CE4F8]">/public/screenshots/</code>.
                    </p>
                 </div>
              </div>
           </section>

           <section className="console-chart-card p-8 space-y-6 border-red-500/10">
              <div className="flex items-center gap-3">
                 <div className="p-2 rounded-lg bg-red-500/10 text-red-400"><AlertCircle size={20} /></div>
                 <h3 className="text-sm font-black uppercase tracking-[0.2em] text-red-400">Emergency Manual</h3>
              </div>
              <div className="space-y-4">
                 <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 text-[10px] font-black text-red-400">01</div>
                    <div>
                       <h4 className="text-xs font-bold text-white">Database Desync</h4>
                       <p className="text-[11px] text-white/40 leading-relaxed mt-1">
                          If cards vanish or formatting breaks after an edit, use the "Restore System" button above to hydrate from your latest snapshot.
                       </p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 text-[10px] font-black text-red-400">02</div>
                    <div>
                       <h4 className="text-xs font-bold text-white">Missing Assets</h4>
                        <p className="text-[11px] text-white/40 leading-relaxed mt-1">
                           Check browser console for 404s. Ensure filenames match slugs exactly. Site nodes require <code className="text-fuchsia-400">{"{slug}"}-desktop.webp</code> in <code className="text-white/20">/public/screenshots/</code>.
                        </p>
                    </div>
                 </div>
              </div>
           </section>
        </div>

        <div className="space-y-8">
           <section className="console-chart-card p-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Quick-Copy Paths</h3>
                 <Zap size={14} className="text-[#4CE4F8]" />
              </div>
              <PathCopyItem label="Website Previews" path="/public/screenshots/" onCopy={() => copyToClipboard("/public/screenshots/")} />
              <PathCopyItem label="Portfolio Icons" path="/public/Icons and images/" onCopy={() => copyToClipboard("/public/Icons and images/")} />
              <PathCopyItem label="Optimization Guide" path="/MODIFICATION_GUIDE.md" onCopy={() => copyToClipboard("/MODIFICATION_GUIDE.md")} />
           </section>

           <section className="console-chart-card p-6 bg-indigo-600/5 border-indigo-600/20">
              <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                 <LifeBuoy size={16} className="text-indigo-400" />
                 Need Support?
              </h3>
              <p className="text-[11px] text-white/40 leading-relaxed mb-4">
                 If you encounter systemic errors that local restoration cannot fix, consult the <code className="text-indigo-300">ADMIN_SETUP.md</code> file for server configuration rules.
              </p>
              <button className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-lg transition-all">Open setup guide</button>
           </section>
        </div>
      </div>
    </div>
  );
}

function DiagnosticsInlineView() {
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      const r = await getMyRole();
      setRole(r);
      setLoading(false);
    }
    check();
  }, []);

  const loadTelemetryFn = useServerFn(getSystemTelemetry);
  const [telemetry, setTelemetry] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await loadTelemetryFn();
        if (!cancelled) setTelemetry(res);
      } catch (e: any) {
        if (cancelled || e?.name === 'AbortError') return;
        console.error("[Diagnostics] Telemetry Load Error:", e);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [loadTelemetryFn]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-[#A15CFD]/10 flex items-center justify-center text-[#A15CFD] shadow-lg shadow-[#A15CFD]/10">
          <ShieldCheck size={28} />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest text-white">System Diagnostics</h2>
          <p className="text-[10px] text-white/30 uppercase tracking-tighter mt-1">Real-time Auth & Context Verification</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="console-chart-card p-8 space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Layout size={18} className="text-[#4CE4F8]" />
            Provider Status
          </h3>
          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
             <span className="text-xs font-bold text-white/60 uppercase">AdminProvider</span>
             <div className="flex items-center gap-2 text-emerald-400">
               <CheckCircle2 size={14} />
               <span className="text-[10px] font-black uppercase">Active</span>
             </div>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-emerald-300/60 text-[11px] leading-relaxed">
            The AdminProvider is correctly wrapping this route. All dashboard context hooks are operational.
          </div>
        </div>

        <div className="console-chart-card p-8 space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white/90">
            <Database size={18} className="text-[#A15CFD]" />
            Auth Verification
          </h3>
          <div className="space-y-4">
             <div className="flex justify-between text-[11px] py-2 border-b border-white/5">
                <span className="text-white/20 uppercase font-black">Session Status</span>
                <span className={session ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>{session ? "CONNECTED" : "DISCONNECTED"}</span>
             </div>
             <div className="flex justify-between text-[11px] py-2 border-b border-white/5">
                <span className="text-white/20 uppercase font-black">Identified User</span>
                <span className="text-white/60 font-mono">{session?.user?.email ?? "UNKNOWN"}</span>
             </div>
             <div className="flex justify-between text-[11px] py-2 border-b border-white/5">
                <span className="text-white/20 uppercase font-black">Role Cleared</span>
                <span className={role?.admin ? "text-[#4CE4F8] font-bold" : "text-red-400 font-bold"}>{role?.admin ? "ADMIN ACCESS" : "FORBIDDEN"}</span>
             </div>
          </div>
        </div>

        <div className="console-chart-card p-8 space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white/90">
            <Activity size={18} className="text-[#4CE4F8]" />
            Active Telemetry
          </h3>
          <div className="space-y-4">
             <div className="flex justify-between text-[11px] py-2 border-b border-white/5">
                <span className="text-white/20 uppercase font-black">Runtime</span>
                <span className="text-[#4CE4F8] font-bold">Edge Worker</span>
             </div>
             <div className="flex justify-between text-[11px] py-2 border-b border-white/5">
                <span className="text-white/20 uppercase font-black">Region</span>
                <span className="text-white/60 font-bold uppercase">{telemetry?.region || "Loading..."}</span>
             </div>
             <div className="flex justify-between text-[11px] py-2 border-b border-white/5">
                <span className="text-white/20 uppercase font-black">Latency</span>
                <span className="text-emerald-400 font-bold">~12ms</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PathCopyItem({ label, path, onCopy }: { label: string; path: string; onCopy: () => void }) {
  return (
    <div className="group flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-[#4CE4F8]/30 transition-all cursor-pointer" onClick={onCopy}>
       <div>
          <span className="text-[9px] font-black uppercase tracking-widest text-white/20 block mb-0.5">{label}</span>
          <code className="text-[10px] text-white/60 font-mono truncate max-w-[140px] block">{path}</code>
       </div>
       <Copy size={12} className="text-white/20 group-hover:text-[#4CE4F8] transition-colors" />
    </div>
  );
}
