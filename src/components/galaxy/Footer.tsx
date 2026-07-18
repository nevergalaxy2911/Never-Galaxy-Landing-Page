import { Orbit } from "lucide-react";

/* -----------------------------------------------------------------------------
 * FOOTER, minimal cosmic footer.
 * HOW TO MODIFY:
 * • Update year / copy → edit the JSX below.
 * • Add a link column → duplicate a <div> inside the middle grid.
 * --------------------------------------------------------------------------- */
export function Footer() {
  return (
    <footer className="sec-violet relative border-t border-white/5 py-14">
      <div className="mx-auto max-w-7xl px-6 flex flex-col gap-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-3">
            <span
              className="grid place-items-center h-9 w-9 rounded-full"
              style={{
                background: "radial-gradient(circle, var(--sec-a) 0%, black 75%)",
                boxShadow: "0 0 24px color-mix(in oklab, var(--sec-a) 60%, transparent)",
              }}
            >
              <Orbit className="h-4 w-4 text-white" />
            </span>
            <div>
              <div className="font-display uppercase text-sm">Never Galaxy</div>
              <div className="label-mono text-[9px] mt-1 opacity-70">creative studio · est. 2025</div>
            </div>
          </div>
          <nav className="flex flex-wrap gap-4 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            <a href="#services" className="hover:text-white transition-colors">Services</a>
            <a href="#portfolio" className="hover:text-white transition-colors">Work</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
            <a href="/terms" className="hover:text-white transition-colors">Terms</a>
          </nav>
        </div>

        <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-[11px] text-muted-foreground">
          <p>
            © {new Date().getFullYear()} Never Galaxy. All rights reserved. All
            content, designs, code, and media on this site are protected by
            copyright and may not be copied, reproduced, or redistributed without
            written permission.
          </p>
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <a href="/terms" className="hover:text-white transition-colors">Terms & Copyright</a>
            <span className="opacity-40">·</span>
            <span>Built with care in orbit.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
