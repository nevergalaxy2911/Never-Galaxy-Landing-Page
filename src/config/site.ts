/* =============================================================================
 * SITE CONFIG, one file to change every price, link, email, and handle.
 * -----------------------------------------------------------------------------
 * This is the single source of truth for anything a NON-CODER might want to
 * update on the live site without touching component code:
 *
 *   • PRICING  , the three plans shown on the Pricing section
 *   • CONTACT  , the destination email + form service key
 *   • SOCIALS  , Instagram / YouTube / Behance / etc. shown on the site
 *   • BRAND    , canonical URL, brand name, tagline used in <head> tags
 *
 * HOW TO EDIT (ELI10):
 *   1. Open this file.
 *   2. Find the section you want to change (e.g. PRICING).
 *   3. Change the value inside the quotes / numbers.
 *   4. Save. The site updates on the next reload, no build needed in dev.
 *
 * Keep this file dependency-free (no React, no CSS) so it can be imported
 * from ANY component, server function, or test without pulling in extras.
 * ========================================================================== */


/* -----------------------------------------------------------------------------
 * BRAND
 * ---------------------------------------------------------------------------
 * Basic identity strings. Change once here; they flow into <title>, og tags,
 * JSON-LD schema, and copyright lines.
 * --------------------------------------------------------------------------- */
export const BRAND = {
  /** Public brand name, appears in title bars, og:site_name, footer. */
  name: "Never Galaxy",

  /** One-liner used as the fallback site description in <head>. */
  tagline: "Cosmic-grade creative studio for video, motion, and design.",

  /** Absolute production URL, used for canonical + og:url. Update when the
   *  real domain is live (e.g. "https://nevergalaxy.com/"). Keep the trailing "/". */
  canonicalUrl: "https://nevergalaxy.vercel.app/",
} as const;


/* -----------------------------------------------------------------------------
 * CONTACT
 * ---------------------------------------------------------------------------
 * Everything the "Contact" section uses to reach you.
 * --------------------------------------------------------------------------- */
export const CONTACT = {
  /** The email inbox that receives form submissions and Gmail-compose clicks.
   *  IMPORTANT: changing this here does NOT change where Web3Forms delivers
   *  mail, Web3Forms binds the destination inbox to the ACCESS KEY below.
   *  See CONTACT.web3FormsKey for how to rotate the inbox. */
  email: "nevergalaxy2911@gmail.com",

  /** Web3Forms access key, controls which inbox receives the form.
   *  ▶ To send inquiries to a different email:
   *      1. Sign up at https://web3forms.com using the NEW email.
   *      2. Copy the access key from the Web3Forms dashboard.
   *      3. Paste it here (replacing the string below).
   *      4. Update CONTACT.email above so the on-page label matches. */
  web3FormsKey: "1a63413d-4aa7-4814-8f44-50ae980d17c7",
} as const;


/* -----------------------------------------------------------------------------
 * ADMIN ALLOWLIST
 * ---------------------------------------------------------------------------
 * Extra defense layer for the /admin console. Even if someone gets a valid
 * Supabase session (stolen password, sneaky signup, etc.), the server will
 * reject them unless their email (lowercased) appears in this array.
 *
 * HOW TO EDIT:
 *   • Add a new admin: append their email (lowercase) as a new string.
 *   • Revoke an admin: delete their line here AND delete their row in
 *     public.user_roles in Supabase SQL editor.
 *   • Keep this list SHORT. One or two people max is safest.
 *
 * This works with, not instead of, the user_roles admin check. Both must pass.
 * --------------------------------------------------------------------------- */
export const ADMIN_ALLOWLIST: readonly string[] = [
  "nevergalaxy2911@gmail.com",
] as const;


/* -----------------------------------------------------------------------------
 * PORTFOLIO
 * ---------------------------------------------------------------------------
 * Behaviour knobs for the portfolio section.
 *
 *   previewBreakpointPx
 *     Minimum viewport width (in CSS pixels) at which clicking a WEBSITE tile
 *     opens the in-page iframe PREVIEW MODAL. Below this width the tile just
 *     opens the live site in a new tab (iframes are cramped on phones and
 *     many target sites block embedding on small viewports).
 *
 *     Set higher (e.g. 1280) to keep tablets on the "new tab" path.
 *     Set lower (e.g. 768)  to enable the modal on tablets too.
 * --------------------------------------------------------------------------- */
export const PORTFOLIO = {
  previewBreakpointPx: 1024,
} as const;



/* -----------------------------------------------------------------------------
 * SOCIALS
 * ---------------------------------------------------------------------------
 * External profile URLs. Set a URL to "" (empty string) to visually mark the
 * link as "coming soon" (components can check for empty and disable the link).
 * The label is what shows on hover / for accessibility.
 * --------------------------------------------------------------------------- */
export const SOCIALS = {
  instagram: "https://www.instagram.com/nevergalaxystudio/",
  youtube: "",   // e.g. "https://youtube.com/@nevergalaxy"
  behance: "",   // e.g. "https://www.behance.net/nevergalaxy"
  twitter: "",   // e.g. "https://x.com/nevergalaxy"
  linkedin: "",  // e.g. "https://www.linkedin.com/company/nevergalaxy"
  discord: "",   // e.g. "https://discord.gg/xxxx"
} as const;


/* -----------------------------------------------------------------------------
 * PRICING
 * ---------------------------------------------------------------------------
 * The three plans shown on the Pricing section.
 *
 * PRICE UNITS:
 *   • `priceInr` is the base price in INDIAN RUPEES (₹). The header currency
 *     switcher converts it live for viewers using useCurrency().format(inr).
 *   • Set `priceInr: null` for a "quote-only" tier, then `customPrice`
 *     (e.g. "Custom") is shown instead.
 *   • `pricePrefix` prepends something like "From " to the price string.
 *
 * FLAGS:
 *   • `highlighted: true` on ONE plan gives it the glow + "Most popular" ribbon.
 *     Set it on multiple plans → all of them get the ribbon (looks odd, avoid).
 * --------------------------------------------------------------------------- */
export type PricingPlan = {
  /** Display name, e.g. "Single project". */
  name: string;
  /** Base price in INR. Use `null` for a custom / "quote-only" tier. */
  priceInr: number | null;
  /** Label used when priceInr is null (e.g. "Custom", "Let's chat"). */
  customPrice?: string;
  /** Prepended to the formatted price, e.g. "From " → "From ₹24,999". */
  pricePrefix?: string;
  /** Cadence line under the price, e.g. "per deliverable" or "/ month". */
  cadence: string;
  /** One-paragraph pitch for this tier. */
  body: string;
  /** Bullet list, order matters, top three read first. */
  features: string[];
  /** If true: adds glow + "Most popular" ribbon. Pick ONE plan. */
  highlighted: boolean;
};

export const PRICING: PricingPlan[] = [
  {
    name: "Single project",
    priceInr: 24999,
    pricePrefix: "From ",
    cadence: "per deliverable",
    body: "Perfect for a one-off video, thumbnail set, or motion piece.",
    features: [
      "One deliverable",
      "48h first draft",
      "Unlimited revisions",
      "1080p / 4K masters",
    ],
    highlighted: false,
  },
  {
    name: "Creator monthly",
    priceInr: 124999,
    pricePrefix: "From ",
    cadence: "/ month",
    body: "For creators publishing weekly. Predictable output, fixed rate.",
    features: [
      "4 long-forms / month",
      "8 thumbnails / month",
      "Shorts add-on available",
      "Priority queue",
    ],
    highlighted: true,
  },
  {
    name: "Brand studio",
    priceInr: null,
    customPrice: "Custom",
    cadence: "quote in 24h",
    body: "For brands and businesses, bespoke scope with a dedicated team.",
    features: [
      "Discovery + brief",
      "Motion identity system",
      "Ongoing content engine",
      "Direct Slack line",
    ],
    highlighted: false,
  },
];


/* -----------------------------------------------------------------------------
 * DERIVED HELPERS, do not hand-edit; these compose the values above.
 * --------------------------------------------------------------------------- */

/** Gmail web-compose URL prefilled with the CONTACT.email address.
 *  Used by the "Email" tile instead of `mailto:` because `mailto:` does
 *  nothing on machines without a registered mail handler (kiosks, most
 *  Windows/Chrome setups). Gmail always opens in-browser. */
export const MAIL_HREF =
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT.email)}`;
