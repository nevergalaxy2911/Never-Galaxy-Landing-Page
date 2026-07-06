import { Menu, Orbit, X } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";

// Nav shortcut list — edit here to add/remove nav items.
const links = [
  { label: "Services", href: "#services",     num: "01" },
  { label: "Work",     href: "#portfolio",    num: "02" },
  { label: "Process",  href: "#process",      num: "03" },
  { label: "Pricing",  href: "#pricing",      num: "04" },
  { label: "FAQ",      href: "#faq",          num: "05" },
  { label: "Contact",  href: "#contact",      num: "06" },
];

function smoothScrollTo(href: string) {
  const id = href.replace("#", "");
  const el = id === "top" ? document.body : document.getElementById(id);
  if (!el) return;
  const lenis = window.__lenis;
  if (lenis) {
    lenis.scrollTo(el as HTMLElement, { offset: -70, duration: 1.4 });
  } else {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  history.replaceState(null, "", href);
}

function handleNavClick(e: MouseEvent<HTMLAnchorElement>, href: string) {
  if (!href.startsWith("#")) return;
  e.preventDefault();
  smoothScrollTo(href);
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // hidden = navbar slides out of view when the user scrolls down past its
  // own height, and returns the moment they scroll up. To tune the hide
  // threshold, change HIDE_AFTER (pixels scrolled before hide kicks in).
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const HIDE_AFTER = 80; // ~= navbar height; hide only after user is past it
    let lastY = window.scrollY;
    // RAF-coalesce scroll updates so we do at most one setState per frame,
    // even on high-frequency trackpads. Avoids stacking React renders during
    // fast momentum scroll.
    let ticking = false;
    const compute = () => {
      ticking = false;
      const y = window.scrollY;
      setScrolled(y > 40);
      const goingDown = y > lastY;
      if (y > HIDE_AFTER && goingDown) setHidden(true);
      else if (!goingDown) setHidden(false);
      lastY = y;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    // Keep the drawer stable on phones: no body scroll fighting the open menu,
    // and close it cleanly with Escape or when the user rotates/resizes wider.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [mobileOpen]);

  const handleMobileLink = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    setMobileOpen(false);
    handleNavClick(e, href);
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        hidden && !mobileOpen ? "-translate-y-full" : "translate-y-0"
      } ${
        scrolled || mobileOpen
          ? "backdrop-blur-xl bg-background/60 border-b border-border/50"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:flex lg:justify-between">
        <a
          href="#top"
          onClick={(e) => handleMobileLink(e, "#top")}
          className="group flex min-w-0 items-center gap-2.5"
        >
          <span
            className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full"
            style={{
              background:
                "radial-gradient(circle, var(--sec-a) 0%, black 75%)",
              boxShadow: "0 0 20px color-mix(in oklab, var(--sec-a) 65%, transparent)",
            }}
          >
            <Orbit className="h-4.5 w-4.5 text-white" />
          </span>
          <span className="hidden min-w-0 truncate font-display text-[14px] font-semibold leading-none tracking-tight min-[380px]:block sm:text-[15px]">
            Never<span className="text-gradient-nebula">Galaxy</span>
            <span className="label-mono mt-1 hidden text-[9px] opacity-70 sm:block">
              creative studio · est. 2025
            </span>
          </span>
        </a>

        <ul className="hidden items-center gap-1 rounded-full border border-border/40 bg-background/30 px-2 py-1.5 text-sm backdrop-blur lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={(e) => handleNavClick(e, l.href)}
                className="nav-link flex items-center gap-1.5 px-3 py-1.5 rounded-full text-muted-foreground transition-colors"
              >
                <span className="nav-num label-mono text-[9px] opacity-60">{l.num}</span>
                <span className="nav-label">{l.label}</span>
              </a>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Currency dropdown — lives at the beginning of the page inside the
              nav's right cluster; visible on every section, hides with the
              nav on scroll down and reappears on scroll up. */}
          <CurrencySwitcher />
          <ThemeToggle />
          <a
            href="#contact"
            onClick={(e) => handleNavClick(e, "#contact")}
            className="btn-glow hidden rounded-full px-5 py-2.5 font-display text-xs uppercase tracking-widest transition-all lg:inline-flex"
          >
            Launch project →
          </a>
          <button
            type="button"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border/50 bg-background/45 text-foreground backdrop-blur transition-colors hover:bg-background/70 lg:hidden"
          >
            {mobileOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="lg:hidden" aria-hidden={!mobileOpen}>
          <div className="mx-4 mb-4 rounded-2xl border border-border/50 bg-background/85 p-2 shadow-[0_24px_80px_-30px_color-mix(in_oklab,var(--sec-a)_70%,transparent)] backdrop-blur-2xl sm:mx-6">
            <ul className="grid gap-1">
              {links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={(e) => handleMobileLink(e, l.href)}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                  >
                    <span className="label-mono text-[9px] opacity-60">{l.num}</span>
                    <span className="truncate">{l.label}</span>
                  </a>
                </li>
              ))}
            </ul>
            <a
              href="#contact"
              onClick={(e) => handleMobileLink(e, "#contact")}
              className="btn-glow mt-2 flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-3 text-center font-display text-[11px] uppercase tracking-widest"
            >
              Launch project →
            </a>
          </div>
        </div>
      )}

    </header>
  );
}
