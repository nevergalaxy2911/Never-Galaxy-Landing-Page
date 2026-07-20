import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/**
 * Web adaptation of the requested compact switch style.
 * Tuned for the admin panel — small, tidy, dark-mode aware.
 * data-tone controls checked colour: primary (default), success, warn, promo.
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
    tone?: "primary" | "success" | "warn" | "promo";
  }
>(({ className, tone = "primary", ...props }, ref) => {
  const toneChecked =
    tone === "success" ? "data-[state=checked]:bg-emerald-500"
    : tone === "warn" ? "data-[state=checked]:bg-amber-500"
    : tone === "promo" ? "data-[state=checked]:bg-fuchsia-500"
    : "data-[state=checked]:bg-cyan-500";
  return (
    <SwitchPrimitives.Root
      ref={ref}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-sm shadow-black/5 outline-none transition-all",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=unchecked]:bg-white/15 dark:data-[state=unchecked]:bg-white/10",
        toneChecked,
        className,
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform",
          "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5",
        )}
      />
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
