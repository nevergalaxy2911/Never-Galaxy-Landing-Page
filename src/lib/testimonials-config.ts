/* =============================================================================
 * TESTIMONIALS CONFIG, shared client + server safe.
 * -----------------------------------------------------------------------------
 * Quotes shown in the public "Reviews" section are ADMIN-EDITABLE. They live in
 * one existing `site_settings` row:
 *     key   = "testimonials.items"
 *     value = Testimonial[]
 * No new table, no migration. When the row is missing or unreadable the site
 * falls back to DEFAULT_TESTIMONIALS below so the section never blanks out.
 *
 * FIELDS
 *   • name    — client name shown under the quote
 *   • role    — small caption, e.g. "Project client"
 *   • proof   — social-proof chip, e.g. "$40 paid". Empty shows "Verified client"
 *   • quote   — the review text itself
 *   • enabled — false hides the card without deleting it
 *
 * HOW TO EDIT: /admin → Testimonials tab.
 * ========================================================================== */

export type Testimonial = {
  name: string;
  role: string;
  proof?: string;
  quote: string;
  enabled: boolean;
};

export const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    name: "Daniel Brown",
    role: "Project client",
    proof: "$40 paid",
    quote:
      "I recently had the chance to work with Never Galaxy for a project, and I found their service to be quite good. The team was responsive and really listened to my ideas, which made the collaboration smooth. They offered a variety of editing styles to choose from, which helped bring my vision to life. The final product exceeded my expectations, and I appreciated their attention to detail. They were professional and met the deadline. Overall, I would recommend Never Galaxy to anyone looking for reliable video editing services.",
    enabled: true,
  },
  {
    name: "Thomas Phillips",
    role: "Project client",
    proof: "$180 paid",
    quote:
      "They were very attentive to my needs and took the time to understand the vision I had for my video. The team was responsive and kept me updated throughout the editing process, which I really appreciated. The final product exceeded my expectations; the editing was polished and professional. They incorporated the feedback I provided along the way, ensuring the video truly reflected my ideas.",
    enabled: true,
  },
  {
    name: "Samuel Torres",
    role: "Creator",
    proof: "$120 paid",
    quote:
      "They have a quirky approach to video editing that adds a fun twist to the end result. It's like they sprinkle a bit of magic dust on your footage, making even the most mundane moments feel entertaining. The team was friendly and super responsive to my requests. If you're looking for something unique and playful, they might just be the agency for you.",
    enabled: true,
  },
  {
    name: "Matthew",
    role: "Project client",
    proof: "$95 paid",
    quote:
      "Their team was friendly and attentive, making the editing process smooth and enjoyable. I appreciated how they listened to my ideas and turned them into something truly special.",
    enabled: true,
  },
  {
    name: "James Ramirez",
    role: "Project client",
    proof: "$150 paid",
    quote:
      "I was quite pleased with the results. They were friendly, listened to my ideas, and made the whole process smooth. Overall, I'd recommend them if you need reliable video editing support.",
    enabled: true,
  },
  {
    name: "Jack Wood",
    role: "Project client",
    proof: "$80 paid",
    quote:
      "Good turnaround time and responsive to my feedback. A solid service, and the kind of communication that makes a remote edit easy to run.",
    enabled: true,
  },
];

/** Validate + coerce whatever the DB returns into a clean list. */
export function sanitizeTestimonials(input: unknown): Testimonial[] {
  if (!Array.isArray(input)) return DEFAULT_TESTIMONIALS;
  const out: Testimonial[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 120) : "";
    const quote = typeof r.quote === "string" ? r.quote.trim().slice(0, 4000) : "";
    if (!name || !quote) continue;
    out.push({
      name,
      role: typeof r.role === "string" ? r.role.trim().slice(0, 120) : "Client",
      proof: typeof r.proof === "string" && r.proof.trim() ? r.proof.trim().slice(0, 60) : undefined,
      quote,
      enabled: r.enabled !== false,
    });
  }
  return out.length ? out : DEFAULT_TESTIMONIALS;
}
