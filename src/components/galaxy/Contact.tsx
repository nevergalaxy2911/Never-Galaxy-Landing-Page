import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Mail, Send, Instagram, Youtube, Globe, ChevronDown, Video, Sparkles, Image as ImageIcon, Globe2, Layers, Check } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";
import { CONTACT, SOCIALS, MAIL_HREF } from "@/config/site";

/* -----------------------------------------------------------------------------
 * CONTACT — bento split: form + info tiles.
 * HOW TO MODIFY:
 * • Change contact email, Web3Forms key, or any social URL →
 *     edit `src/config/site.ts` (CONTACT / SOCIALS blocks). No changes here.
 * • Wire the form → send `form` state to your backend or a form service.
 * • Recolor → change `sec-cyan` on the <section>.
 * --------------------------------------------------------------------------- */
const EMAIL = CONTACT.email;

/* Gmail web-compose URL — opens Gmail directly in a new tab with the To field
 * pre-filled. Sourced from `src/config/site.ts` (MAIL_HREF) so the email is
 * only defined in ONE place. Kept exported here as a local re-name so the
 * rest of the file reads unchanged. */

/* Socials list — icon + label live here, href comes from `src/config/site.ts`.
 * An empty href renders the link as a disabled "coming soon" pill. */
const SOCIALS_UI = [
  { icon: Instagram, label: "Instagram", href: SOCIALS.instagram },
  { icon: Youtube,   label: "YouTube",   href: SOCIALS.youtube },
  { icon: Globe,     label: "Behance",   href: SOCIALS.behance },
];

/* Scope options for the custom dropdown. HOW TO MODIFY: add/remove entries;
 * `icon` accepts any lucide-react component. `value` is what gets stored. */
const SCOPES = [
  { value: "video",      label: "Video editing",         icon: Video },
  { value: "motion",     label: "Motion graphics",       icon: Sparkles },
  { value: "thumbnails", label: "Thumbnail design",      icon: ImageIcon },
  { value: "web",        label: "Custom web (waitlist)", icon: Globe2 },
  { value: "mix",        label: "A mix of the above",    icon: Layers },
];

/* ---------------------------------------------------------------------------
 * EMAIL DELIVERY (Web3Forms)
 *
 * The contact form posts to https://web3forms.com, a free relay that emails
 * every submission to the inbox tied to the access key below.
 *
 * ▶ HOW TO CHANGE THE RECIPIENT EMAIL (currently: nevergalaxy2911@gmail.com)
 *   Web3Forms binds the destination inbox to the access key — you cannot set
 *   the "To:" address from the code. To change who receives inquiries:
 *     1. Go to https://web3forms.com and sign up / log in using the email
 *        you want inquiries delivered to (e.g. nevergalaxy2911@gmail.com).
 *     2. Copy the new Access Key from the dashboard.
 *     3. Paste it below as `WEB3FORMS_KEY`.
 *   Save the file → the very next submission lands in that inbox.
 *
 * ▶ CATEGORIZATION
 *   Every email arrives with a category tag in the subject line, e.g.:
 *     [NeverGalaxy · Video editing] Ada Lovelace — new inquiry
 *   That makes it trivial to filter/label in Gmail (Filters → "Subject
 *   contains: [NeverGalaxy · Video editing]" → apply label "Video").
 *   The email body also lists Category, Name, Reply-To email, and Message
 *   as clearly labeled sections.
 * ------------------------------------------------------------------------- */
const WEB3FORMS_KEY = CONTACT.web3FormsKey;

/* ---------------------------------------------------------------------------
 * CLIENT-SIDE VALIDATION
 * HOW TO MODIFY:
 *  • Adjust rules → edit the constants + `validate()` below.
 *  • Add fields → add a key to `FieldErrors` and a check in `validate()`.
 *  • Change limits → tweak MAX_NAME / MAX_EMAIL / MAX_MESSAGE / MIN_MESSAGE.
 * Keeps the form honest before we hit Web3Forms: trims whitespace, requires
 * name + message, validates email format, and enforces sane length caps so
 * nobody can paste a novel or a script into the inputs. Server-side, Web3Forms
 * also filters + rate-limits, but front-end checks catch typos instantly. */
const MAX_NAME = 100;
const MAX_EMAIL = 255;
const MAX_MESSAGE = 2000;
const MIN_MESSAGE = 10;
// Simple, permissive email regex — good enough to catch typos like
// "you@studio" or "you@@studio.com". The real source of truth is the mail
// server on the receiving end.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = Partial<Record<"name" | "email" | "message", string>>;

function validate(form: { name: string; email: string; message: string }): FieldErrors {
  const errors: FieldErrors = {};
  const name = form.name.trim();
  const email = form.email.trim();
  const message = form.message.trim();

  if (!name) errors.name = "Please enter your name.";
  else if (name.length > MAX_NAME) errors.name = `Name must be under ${MAX_NAME} characters.`;

  if (!email) errors.email = "Please enter your email.";
  else if (email.length > MAX_EMAIL) errors.email = `Email must be under ${MAX_EMAIL} characters.`;
  else if (!EMAIL_RE.test(email)) errors.email = "That doesn't look like a valid email.";

  if (!message) errors.message = "Please describe your project.";
  else if (message.length < MIN_MESSAGE) errors.message = `Message must be at least ${MIN_MESSAGE} characters.`;
  else if (message.length > MAX_MESSAGE) errors.message = `Message must be under ${MAX_MESSAGE} characters.`;

  return errors;
}

export function Contact() {
  const [form, setForm] = useState({ name: "", email: "", scope: "video", message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-field validation errors — shown under each input when non-empty.
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const head = useReveal<HTMLDivElement>(0);
  const grid = useReveal<HTMLDivElement>(120);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Front-end validation gate — must pass before we spend a Web3Forms
    // submission or show the network as "sending".
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSending(true);
    try {
      const scopeLabel = SCOPES.find((s) => s.value === form.scope)?.label ?? form.scope;
      // Category tag lives at the start of the subject so Gmail filters can
      // match on "Subject contains: [NeverGalaxy · <category>]".
      const categoryTag = `[NeverGalaxy · ${scopeLabel}]`;
      const subject = `${categoryTag} ${form.name.trim()} — new inquiry`;

      // Structured, labeled body — Web3Forms will render each key/value pair
      // as a row in the delivered email, so the recipient sees clean sections
      // instead of a wall of text.
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject,
          from_name: `NeverGalaxy · ${scopeLabel}`,
          replyto: form.email.trim(),
          // Labeled sections rendered in the delivered email:
          "Category": scopeLabel,
          "Name": form.name.trim(),
          "Reply-To Email": form.email.trim(),
          "Message": form.message.trim(),
          // Honeypot field is empty — Web3Forms auto-filters bot submissions.
          botcheck: "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || "Send failed");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  }

  // Small helper — updates a field and clears its inline error as the user types,
  // so errors disappear the moment they start correcting the input.
  function updateField<K extends "name" | "email" | "message">(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  return (
    <section id="contact" className="sec-cyan nebula-wash relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div ref={head} className="reveal max-w-3xl">
          <span className="label-chip">06 · Contact</span>
          <h2 className="mt-6 font-display uppercase text-[clamp(2rem,5vw,4rem)]">
            Let's build <span className="text-gradient-nebula">your galaxy</span>.
          </h2>
          <p className="mt-5 text-muted-foreground text-lg">
            Tell us about the project. We reply within one working day with scope,
            timeline, and price.
          </p>
        </div>

        <div ref={grid} className="reveal mt-14 grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[minmax(120px,auto)]">
          {/* Form — spans 4 columns. `noValidate` disables the browser's built-in
           * tooltips so our own inline error messages are the single source of
           * truth (avoids double-messaging the user). */}
          <form onSubmit={onSubmit} noValidate className="bento p-8 md:col-span-4 md:row-span-2 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Your name" error={fieldErrors.name}>
                <input
                  required
                  maxLength={MAX_NAME}
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  aria-invalid={!!fieldErrors.name}
                  className="input-cosmic"
                  placeholder="Ada Lovelace"
                />
              </Field>
              <Field label="Email" error={fieldErrors.email}>
                <input
                  required
                  type="email"
                  maxLength={MAX_EMAIL}
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  aria-invalid={!!fieldErrors.email}
                  className="input-cosmic"
                  placeholder="you@studio.com"
                />
              </Field>
            </div>
            <Field label="What do you need?">
              <ScopeSelect
                value={form.scope}
                onChange={(v) => setForm({ ...form, scope: v })}
              />
            </Field>
            <Field label="Project brief" error={fieldErrors.message}>
              <textarea
                required
                rows={5}
                maxLength={MAX_MESSAGE}
                value={form.message}
                onChange={(e) => updateField("message", e.target.value)}
                aria-invalid={!!fieldErrors.message}
                className="input-cosmic resize-none"
                placeholder="Format, deadline, references, links to raw footage…"
              />
            </Field>

            <button
              type="submit"
              disabled={sending || sent}
              className="btn-glow inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 font-display text-sm uppercase tracking-widest mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {sent
                ? "Received — we'll reply soon"
                : sending
                  ? "Transmitting…"
                  : (<>Send transmission <Send className="h-4 w-4" /></>)}
            </button>
            {error && (
              <p className="text-sm text-red-400 mt-1" role="alert">{error}</p>
            )}
          </form>

          {/* Email tile — opens Gmail's web compose in a new tab (see MAIL_HREF
           * comment at top for why we don't use `mailto:` here). */}
          <a
            href={MAIL_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="bento p-7 md:col-span-2 flex flex-col justify-between group"
          >
            <span className="label-mono">Email</span>
            <div>
              <Mail className="h-6 w-6 mb-3" style={{ color: "color-mix(in oklab, var(--sec-a) 90%, white)" }} />
              <div className="font-display uppercase text-base break-all">{EMAIL}</div>
              <p className="text-muted-foreground text-sm mt-2 group-hover:text-white transition-colors">Open in Gmail →</p>
            </div>
          </a>

          {/* Socials tile */}
          <div className="bento p-7 md:col-span-2 flex flex-col justify-between">
            <span className="label-mono">Follow</span>
            <div className="flex gap-2 flex-wrap mt-4">
              {SOCIALS_UI.filter((s) => s.href).map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost-glow inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-mono uppercase tracking-widest"
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Local styles for form inputs — kept scoped with a plain <style> tag.
         * IMPORTANT: `!important` on light-mode overrides forces them to win
         * against any parent (.light .bento *) color cascades that might
         * otherwise tint the field gray. */}
        <style>{`
          .input-cosmic {
            width: 100%;
            border-radius: 0.75rem;
            border: 1px solid color-mix(in oklab, var(--sec-a) 25%, transparent);
            background: color-mix(in oklab, black 60%, transparent);
            padding: 0.75rem 1rem;
            font-family: var(--font-body);
            color: var(--color-foreground);
            outline: none;
            transition: border-color .3s, box-shadow .3s;
          }
          .input-cosmic::placeholder { color: color-mix(in oklab, white 40%, var(--sec-a)); opacity: 0.5; }
          .input-cosmic:focus {
            border-color: color-mix(in oklab, var(--sec-a) 80%, transparent);
            box-shadow: 0 0 0 4px color-mix(in oklab, var(--sec-a) 15%, transparent),
                        0 0 30px color-mix(in oklab, var(--sec-c) 30%, transparent);
          }
          /* Invalid-input styling — red ring when aria-invalid is true. */
          .input-cosmic[aria-invalid="true"] {
            border-color: color-mix(in oklab, #ef4444 80%, transparent);
            box-shadow: 0 0 0 3px color-mix(in oklab, #ef4444 25%, transparent);
          }
          /* --- LIGHT MODE — solid white fields with dark ink ----------------- */
          .light .input-cosmic {
            background: #ffffff !important;
            color: #0b1220 !important;
            border-color: color-mix(in oklab, var(--sec-a) 45%, #cbd5e1) !important;
          }
          .light .input-cosmic::placeholder {
            color: color-mix(in oklab, #0b1220 45%, transparent) !important;
            opacity: 1;
          }
          .light .input-cosmic:focus {
            border-color: color-mix(in oklab, var(--sec-a) 90%, black) !important;
            box-shadow: 0 0 0 4px color-mix(in oklab, var(--sec-a) 22%, transparent) !important;
          }
          .light .input-cosmic[aria-invalid="true"] {
            border-color: #dc2626 !important;
            box-shadow: 0 0 0 3px color-mix(in oklab, #dc2626 25%, transparent) !important;
          }

          /* ------------------------------------------------------------------
           * CHARMING SCOPE SELECT — custom dropdown replacing native <select>.
           * HOW TO MODIFY:
           *  • Add/remove options → edit SCOPES array at top of file.
           *  • Change trigger height/padding → .scope-trigger.
           *  • Change menu look → .scope-menu / .scope-option.
           * ------------------------------------------------------------------ */
          .scope-wrap { position: relative; }
          .scope-trigger {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            border-radius: 0.75rem;
            border: 1px solid color-mix(in oklab, var(--sec-a) 25%, transparent);
            background: color-mix(in oklab, black 60%, transparent);
            padding: 0.75rem 1rem;
            font-family: var(--font-body);
            color: var(--color-foreground);
            cursor: pointer;
            text-align: left;
            transition: border-color .3s, box-shadow .3s, background .3s;
          }
          .scope-trigger:hover {
            border-color: color-mix(in oklab, var(--sec-a) 55%, transparent);
            box-shadow: 0 0 24px color-mix(in oklab, var(--sec-a) 20%, transparent);
          }
          .scope-trigger[data-open="true"] {
            border-color: color-mix(in oklab, var(--sec-a) 80%, transparent);
            box-shadow: 0 0 0 4px color-mix(in oklab, var(--sec-a) 15%, transparent);
          }
          .scope-trigger .chev { margin-left: auto; transition: transform .3s cubic-bezier(.2,.7,.2,1); }
          .scope-trigger[data-open="true"] .chev { transform: rotate(180deg); }
          .scope-icon-chip {
            display: inline-flex; align-items: center; justify-content: center;
            width: 1.75rem; height: 1.75rem; border-radius: 0.5rem;
            background: linear-gradient(135deg,
              color-mix(in oklab, var(--sec-a) 40%, transparent),
              color-mix(in oklab, var(--sec-c) 40%, transparent));
            color: color-mix(in oklab, white 95%, var(--sec-a));
            flex-shrink: 0;
          }
          .scope-menu {
            position: absolute;
            top: calc(100% + 0.5rem);
            left: 0; right: 0;
            z-index: 40;
            border-radius: 0.9rem;
            border: 1px solid color-mix(in oklab, var(--sec-a) 40%, transparent);
            background: color-mix(in oklab, #0a0812 92%, black);
            padding: 0.4rem;
            box-shadow:
              0 24px 60px -20px color-mix(in oklab, var(--sec-a) 60%, transparent),
              0 0 0 1px color-mix(in oklab, var(--sec-a) 20%, transparent) inset;
            backdrop-filter: blur(12px);
            animation: scopeMenuIn .18s cubic-bezier(.2,.7,.2,1);
          }
          @keyframes scopeMenuIn {
            from { opacity: 0; transform: translateY(-6px) scale(.98); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          .scope-option {
            width: 100%;
            display: flex; align-items: center; gap: 0.75rem;
            padding: 0.6rem 0.75rem;
            border-radius: 0.6rem;
            font-family: var(--font-body);
            color: var(--color-foreground);
            background: transparent;
            border: none;
            cursor: pointer;
            text-align: left;
            transition: background .15s ease, color .15s ease;
          }
          .scope-option:hover,
          .scope-option[data-active="true"] {
            background: color-mix(in oklab, var(--sec-a) 18%, transparent);
            color: color-mix(in oklab, white 98%, var(--sec-a));
          }
          .scope-option .check { margin-left: auto; opacity: 0; transition: opacity .2s ease; }
          .scope-option[data-selected="true"] .check { opacity: 1; }

          /* --- LIGHT MODE scope trigger + menu — white surface, dark ink --- */
          .light .scope-trigger {
            background: #ffffff !important;
            color: #0b1220 !important;
            border-color: color-mix(in oklab, var(--sec-a) 45%, #cbd5e1) !important;
          }
          .light .scope-icon-chip {
            background: linear-gradient(135deg,
              color-mix(in oklab, var(--sec-a) 85%, white),
              color-mix(in oklab, var(--sec-b) 85%, white));
            color: white;
          }
          .light .scope-menu {
            background: #ffffff !important;
            border-color: color-mix(in oklab, var(--sec-a) 40%, #cbd5e1) !important;
            box-shadow: 0 20px 50px -18px color-mix(in oklab, var(--sec-a) 55%, transparent);
          }
          .light .scope-option { color: #0b1220 !important; }
          .light .scope-option:hover,
          .light .scope-option[data-active="true"] {
            background: color-mix(in oklab, var(--sec-a) 12%, white) !important;
            color: color-mix(in oklab, var(--sec-a) 95%, black) !important;
          }
        `}</style>
      </div>
    </section>
  );
}

/* Field wrapper — renders label + child input + optional inline error.
 * HOW TO MODIFY: change error styling in the <span> below. */
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-mono block mb-2">{label}</span>
      {children}
      {error && (
        <span className="block mt-1.5 text-xs text-red-400" role="alert">{error}</span>
      )}
    </label>
  );
}

/* ---------------------------------------------------------------------------
 * ScopeSelect — accessible custom dropdown replacing the plain <select>.
 * Keyboard: Enter/Space to open, Esc to close, click-outside to dismiss.
 * Visual polish: icon chip per option, animated chevron, checkmark on active.
 * ------------------------------------------------------------------------- */
function ScopeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Fixed-position menu geometry — recalculated each open + on scroll/resize,
  // so the dropdown escapes the parent .bento's `overflow: hidden` clipping.
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const current = SCOPES.find((s) => s.value === value) ?? SCOPES[0];
  const CurrentIcon = current.icon;

  // Position + reposition the fixed menu relative to the trigger.
  useEffect(() => {
    if (!open) { setMenuPos(null); return; }
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      setMenuPos({ top: r.bottom + 8, left: r.left, width: r.width });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="scope-wrap">
      <button
        ref={triggerRef}
        type="button"
        className="scope-trigger"
        data-open={open}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="scope-icon-chip"><CurrentIcon className="h-4 w-4" /></span>
        <span className="flex-1">{current.label}</span>
        <ChevronDown className="chev h-4 w-4 opacity-70" />
      </button>

      {open && menuPos && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="scope-menu btn-tilt"
          role="listbox"
          style={{ position: "fixed", top: menuPos.top, left: menuPos.left, width: menuPos.width }}
        >
          {SCOPES.map((s) => {
            const Icon = s.icon;
            const selected = s.value === value;
            return (
              <button
                key={s.value}
                type="button"
                role="option"
                aria-selected={selected}
                data-selected={selected}
                className="scope-option"
                onClick={() => { onChange(s.value); setOpen(false); }}
              >
                <span className="scope-icon-chip"><Icon className="h-4 w-4" /></span>
                <span>{s.label}</span>
                <Check className="check h-4 w-4" />
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
