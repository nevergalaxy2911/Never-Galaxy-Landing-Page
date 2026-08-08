import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/auth.functions";
import { useAdmin } from "@/components/admin/AdminProvider";
import { ShieldCheck, AlertCircle, CheckCircle2, Layout, Database } from "lucide-react";

export const Route = createFileRoute("/_gated/admin/diagnostics")({
  component: DiagnosticsPage,
});

function DiagnosticsPage() {
  const navigate = useNavigate();
  const adminContext = (() => {
    try {
      return useAdmin();
    } catch (e) {
      return null;
    }
  })();

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

  return (
    <div className="p-10 space-y-8 bg-[#07070c] min-h-screen text-white">
      <div className="flex items-center gap-4 mb-8">
        <div className="h-12 w-12 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-400">
          <ShieldCheck size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest">Admin Diagnostics</h1>
          <p className="text-xs text-white/40 uppercase tracking-tighter">System Health & Auth Verification</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="console-chart-card p-8 space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Layout size={18} className="text-[#4CE4F8]" />
            Provider Status
          </h3>
          
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
             <span className="text-sm font-medium">AdminProvider Mounted</span>
             {adminContext ? (
               <div className="flex items-center gap-2 text-emerald-400">
                 <CheckCircle2 size={16} />
                 <span className="text-xs font-bold uppercase">Active</span>
               </div>
             ) : (
               <div className="flex items-center gap-2 text-red-400">
                 <AlertCircle size={16} />
                 <span className="text-xs font-bold uppercase">Missing</span>
               </div>
             )}
          </div>
          
          {!adminContext && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs leading-relaxed">
              <strong>CRITICAL:</strong> useAdmin is being called outside of an AdminProvider. 
              The Editor and Dashboard features will fail until this is resolved in the gated layout.
            </div>
          )}
        </div>

        <div className="console-chart-card p-8 space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Database size={18} className="text-[#A15CFD]" />
            Auth Context
          </h3>
          
          <div className="space-y-4">
             <div className="flex justify-between text-xs py-2 border-b border-white/5">
                <span className="text-white/40 uppercase">Session Status</span>
                <span className={session ? "text-emerald-400" : "text-red-400"}>{session ? "Active" : "None"}</span>
             </div>
             <div className="flex justify-between text-xs py-2 border-b border-white/5">
                <span className="text-white/40 uppercase">User Email</span>
                <span className="text-white/80">{session?.user?.email ?? "N/A"}</span>
             </div>
             <div className="flex justify-between text-xs py-2 border-b border-white/5">
                <span className="text-white/40 uppercase">Server Verified Admin</span>
                <span className={role?.admin ? "text-emerald-400" : "text-red-400"}>{role?.admin ? "YES" : "NO"}</span>
             </div>
          </div>
        </div>
      </div>

      <button onClick={() => navigate({ to: '/admin' })} className="console-btn-primary">
        Return to Console
      </button>
    </div>
  );
}
