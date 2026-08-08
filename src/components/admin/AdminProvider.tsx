import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useServerFn } from "@tanstack/react-start";
import { toast } from 'sonner';
import { 
  listSettings, 
  listPricing, 
  listPortfolio, 
  listFlags,
  upsertSetting,
  upsertPricing,
  upsertFlag,
  upsertPortfolio
} from "@/lib/admin-data.functions";

type AdminContextType = {
  createRestorePoint: () => Promise<void>;
  restoreFromPoint: () => Promise<void>;
  isProcessing: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  dateRange: { start: string; end: string };
  setDateRange: (range: { start: string; end: string }) => void;
};

const AdminContext = createContext<AdminContextType | null>(null);

export const AdminProvider = ({ children }: { children: ReactNode }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const getSettings = useServerFn(listSettings);
  const getPricing = useServerFn(listPricing);
  const getPortfolio = useServerFn(listPortfolio);
  const getFlags = useServerFn(listFlags);

  const saveSetting = useServerFn(upsertSetting);
  const savePricing = useServerFn(upsertPricing);
  const saveFlag = useServerFn(upsertFlag);
  const saveItem = useServerFn(upsertPortfolio);

  const createRestorePoint = useCallback(async () => {
    setIsProcessing(true);
    try {
      const [settings, pricing, portfolio, flags] = await Promise.all([
        getSettings(),
        getPricing(),
        getPortfolio(),
        getFlags()
      ]);

      const snapshot = {
        timestamp: new Date().toISOString(),
        data: {
          settings: settings.rows,
          pricing: pricing.rows,
          portfolio: portfolio.rows,
          flags: flags.rows
        }
      };

      localStorage.setItem('admin-restore-snapshot', JSON.stringify(snapshot));
      toast.success("System Restore Point Created Successfully");
    } catch (err) {
      console.error("Failed to create restore point:", err);
      toast.error("Failed to create restore point");
    } finally {
      setIsProcessing(false);
    }
  }, [getSettings, getPricing, getPortfolio, getFlags]);

  const restoreFromPoint = useCallback(async () => {
    const saved = localStorage.getItem('admin-restore-snapshot');
    if (!saved) {
      toast.error("No Restore Point Found");
      return;
    }

    if (!confirm("Are you sure? This will overwrite all current settings, pricing, portfolio items, and feature flags with the saved snapshot.")) {
      return;
    }

    setIsProcessing(true);
    try {
      const snapshot = JSON.parse(saved);
      const { settings, pricing, portfolio, flags } = snapshot.data;

      // Restore settings
      if (settings) {
        await Promise.all(settings.map((s: any) => saveSetting({ data: { key: s.key, value: s.value } })));
      }

      // Restore pricing
      if (pricing) {
        await Promise.all(pricing.map((p: any) => savePricing({ data: p })));
      }

      // Restore flags
      if (flags) {
        await Promise.all(flags.map((f: any) => saveFlag({ data: { key: f.key, enabled: f.enabled, value: f.value } })));
      }

      // Restore portfolio
      if (portfolio) {
        await Promise.all(portfolio.map((p: any) => saveItem({ data: p })));
      }

      toast.success("System Restored Successfully");
      window.location.reload(); 
    } catch (err) {
      console.error("Restore failed:", err);
      toast.error("Restore failed: " + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }, [saveSetting, savePricing, saveFlag, saveItem]);

  return (
    <AdminContext.Provider value={{ 
      createRestorePoint, 
      restoreFromPoint, 
      isProcessing,
      searchQuery,
      setSearchQuery,
      dateRange,
      setDateRange
    }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    console.error("useAdmin must be used within an AdminProvider");
    // During development, we'll throw to identify the root cause, 
    // but we add a safety fallback for the hook's return signature if caught.
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
};

