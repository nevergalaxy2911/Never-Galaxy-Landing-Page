/* -----------------------------------------------------------------------------
 * deviceTier — one honest answer to "should we spend extra work on this device?"
 *
 * Used to gate *background* work (idle screenshot warm-up, ambient-track
 * pre-download). Those are pure nice-to-haves: on a low-end phone or a metered
 * connection they cost battery and data for no visible benefit, so we skip them
 * entirely rather than degrade them.
 *
 * SIGNALS
 *   • navigator.deviceMemory        — RAM in GB (Chromium)
 *   • navigator.hardwareConcurrency — logical CPU cores
 *   • navigator.connection          — saveData flag + effective network type
 *   • coarse pointer + small screen — a phone, essentially always
 *
 * HOW TO MODIFY: loosen/tighten the thresholds below. Anything that returns
 * true here loses only background prefetching, never actual content.
 * --------------------------------------------------------------------------- */

type NavWithHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
};

/** True when the visitor asked to save data, or is on a slow connection. */
export function prefersDataSaving(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as NavWithHints).connection;
  if (!c) return false;
  if (c.saveData) return true;
  return c.effectiveType === "slow-2g" || c.effectiveType === "2g";
}

/** True for phones and memory/CPU-constrained machines. */
export function isLowEndDevice(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const nav = navigator as NavWithHints;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) return true;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) return true;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return coarse && window.innerWidth < 768;
}

/** Background prefetching is only worth it on capable, un-metered devices. */
export function shouldPrefetchHeavyAssets(): boolean {
  return !prefersDataSaving() && !isLowEndDevice();
}

/* -----------------------------------------------------------------------------
 * ADAPTIVE SCREENSHOT SCALING
 *
 * WHAT: decides which portfolio screenshot resolution a device deserves.
 *   • "low"  — Data Saver, slow network, or a weak GPU/CPU: we serve the small
 *              mobile shot (≈480px) even on a big screen. It upscales slightly
 *              but paints many times faster and costs a fraction of the data.
 *   • "high" — everything else: the full-resolution desktop shot.
 *
 * WHY: on low-end GPUs the cost is not just download, it's decode + upload of a
 * large bitmap to the GPU — that is what makes tiles pop in late and drop frames.
 *
 * HOW TO MODIFY: loosen the checks below (e.g. drop the deviceMemory clause) to
 * give more devices the full-resolution shot.
 * --------------------------------------------------------------------------- */
export type ScreenshotTier = "low" | "high";

export function screenshotTier(): ScreenshotTier {
  if (typeof window === "undefined") return "high";
  if (prefersDataSaving()) return "low";
  const nav = navigator as NavWithHints;
  if (nav.connection?.effectiveType === "3g") return "low";
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) return "low";
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) return "low";
  // Very dense screens on small devices: the mobile shot is already retina there.
  if (window.innerWidth < 640) return "low";
  return "high";
}

/* -----------------------------------------------------------------------------
 * HUMAN-READABLE TIER REPORT (feeds the diagnostics panel)
 *
 * WHAT: explains, in plain words, WHY this device is being treated the way it
 * is and WHICH settings are therefore hard-forced (not user-controllable).
 *
 * WHY: the Experience menu deliberately hides its tuning knobs on weak devices.
 * Without this report that looks like a bug — now the diagnostics panel can say
 * "forced because: 4GB RAM, Data Saver on".
 *
 * HOW TO MODIFY: add a signal to `reasons`, or a row to `forced`.
 * --------------------------------------------------------------------------- */
export type TierReport = {
  lowEnd: boolean;
  dataSaver: boolean;
  screenshot: ScreenshotTier;
  deviceMemoryGb: number | null;
  cores: number | null;
  effectiveType: string | null;
  coarsePointer: boolean;
  viewportWidth: number | null;
  reasons: string[];
  /** Settings the runtime pins on this device, with the rule behind each. */
  forced: Array<{ setting: string; value: string; why: string }>;
};

export function describeDeviceTier(): TierReport {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      lowEnd: false, dataSaver: false, screenshot: "high",
      deviceMemoryGb: null, cores: null, effectiveType: null,
      coarsePointer: false, viewportWidth: null, reasons: [], forced: [],
    };
  }
  const nav = navigator as NavWithHints;
  const mem = typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;
  const cores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null;
  const effectiveType = nav.connection?.effectiveType ?? null;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const width = window.innerWidth;
  const lowEnd = isLowEndDevice();
  const dataSaver = prefersDataSaving();

  const reasons: string[] = [];
  if (mem !== null && mem <= 4) reasons.push(`RAM ≤ 4GB (${mem}GB)`);
  if (cores !== null && cores <= 4) reasons.push(`CPU ≤ 4 cores (${cores})`);
  if (nav.connection?.saveData) reasons.push("Data Saver is on");
  if (effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g")
    reasons.push(`Slow network (${effectiveType})`);
  if (coarse && width < 768) reasons.push(`Touch device under 768px (${width}px)`);
  if (width < 640) reasons.push(`Narrow viewport (${width}px)`);

  const forced: TierReport["forced"] = [];
  if (lowEnd || dataSaver) {
    forced.push({ setting: "Progressive previews", value: "always on", why: "cheapest first paint" });
    forced.push({ setting: "Preview quality cap", value: "locked to small shot", why: "avoids large GPU uploads" });
    forced.push({ setting: "Tab-switch fade", value: "fixed default", why: "no per-device tuning needed" });
    forced.push({ setting: "Idle asset warm-up", value: "disabled", why: "saves battery + data" });
  }
  if (coarse) {
    forced.push({ setting: "Scroll wind", value: "unavailable", why: "no fine pointer / battery cost" });
    forced.push({ setting: "UI click sounds", value: "hidden", why: "touch UI keeps only ambience" });
  }
  if (screenshotTier() === "low") {
    forced.push({ setting: "Screenshot resolution", value: "small (≈480px)", why: "decode speed over sharpness" });
  }

  return {
    lowEnd, dataSaver, screenshot: screenshotTier(),
    deviceMemoryGb: mem, cores, effectiveType,
    coarsePointer: coarse, viewportWidth: width,
    reasons, forced,
  };
}

