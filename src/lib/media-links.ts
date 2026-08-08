/* =============================================================================
 * MEDIA LINKS, one shared parser for every URL an admin can paste.
 * -----------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 *   The admin console and the public site both need to understand a pasted
 *   link. Before this file they each had their own half-parser, so a URL could
 *   "save fine" and then render nothing. Now there is exactly ONE parser and it
 *   returns a HUMAN-READABLE REASON whenever it cannot understand a link, which
 *   the admin form shows inline.
 *
 * WHAT IT SUPPORTS (YouTube)
 *   • https://www.youtube.com/watch?v=ID
 *   • https://youtu.be/ID
 *   • https://www.youtube.com/shorts/ID
 *   • https://www.youtube.com/live/ID
 *   • https://www.youtube.com/embed/ID   and   /v/ID
 *   • bare 11-character video IDs
 *   • youtube-nocookie.com and m.youtube.com
 *
 * HOW TO MODIFY
 *   • Accept another host  → add it to YT_HOSTS.
 *   • Accept another path  → extend YT_PATH_RE.
 *   • Change error copy    → edit the `reason` strings below (visitor-facing
 *     admin copy: no em dashes).
 * ========================================================================== */

export type LinkParse =
  | { ok: true; kind: "youtube"; id: string; canonical: string; thumb: string }
  | { ok: true; kind: "link"; url: string }
  | { ok: false; reason: string; hint?: string };

const YT_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
  "www.youtu.be",
];

// /embed/ID, /shorts/ID, /live/ID, /v/ID
const YT_PATH_RE = /\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{6,})/;
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function normalise(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  // Tolerate "youtube.com/watch?v=..." pasted without a scheme.
  if (/^(?:www\.)?(?:youtu\.be|youtube\.com|m\.youtube\.com)\//i.test(s)) return `https://${s}`;
  return s;
}

/** Extract a YouTube video id, or undefined when the URL is not a video. */
export function parseYouTubeId(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const s = normalise(String(raw));
  if (YT_ID_RE.test(s)) return s;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return undefined;
  }
  const host = url.hostname.toLowerCase();
  if (!YT_HOSTS.includes(host)) return undefined;
  if (host.endsWith("youtu.be")) {
    const id = url.pathname.slice(1).split("/")[0];
    return id && YT_ID_RE.test(id) ? id : (id || undefined);
  }
  const v = url.searchParams.get("v");
  if (v) return v;
  const m = url.pathname.match(YT_PATH_RE);
  return m ? m[1] : undefined;
}

export function youTubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/**
 * Full parse used by the admin form. `expect` tells the parser what the
 * current category needs, so the error copy can be specific.
 */
export function parseMediaLink(raw: string, expect: "video" | "link"): LinkParse {
  const s = normalise(String(raw ?? ""));

  if (!s) {
    return expect === "video"
      ? { ok: false, reason: "No link yet. Paste the YouTube URL of the video you want on this tile." }
      : { ok: false, reason: "No link yet. Paste the page you want this tile to open, or leave it empty." };
  }

  if (expect === "video") {
    const id = parseYouTubeId(s);
    if (id && YT_ID_RE.test(id)) {
      const canonical = `https://www.youtube.com/watch?v=${id}`;
      return { ok: true, kind: "youtube", id, canonical, thumb: youTubeThumb(id) };
    }
    if (id) {
      return {
        ok: false,
        reason: `Found "${id}" but that is not a valid YouTube video id (ids are 11 characters).`,
        hint: "Open the video on YouTube, hit Share, and copy the link it gives you.",
      };
    }
    let host = "";
    try {
      host = new URL(s).hostname;
    } catch {
      return {
        ok: false,
        reason: "That is not a complete web address.",
        hint: "It should start with https:// , for example https://youtu.be/dQw4w9WgXcQ",
      };
    }
    if (/vimeo\.com/i.test(host)) {
      return { ok: false, reason: "Vimeo links are not supported on video tiles yet.", hint: "Upload to YouTube (unlisted works fine) and paste that link." };
    }
    if (/drive\.google|dropbox|onedrive/i.test(host)) {
      return { ok: false, reason: "Cloud storage links cannot be embedded.", hint: "Upload the video to YouTube as Unlisted and paste that link here." };
    }
    if (/youtube|youtu\.be/i.test(host)) {
      return {
        ok: false,
        reason: "This is a YouTube link but there is no video id in it (a channel or playlist page, maybe).",
        hint: "Open the actual video and copy the link from the Share button.",
      };
    }
    return {
      ok: false,
      reason: `"${host}" is not YouTube, so this tile cannot show a player.`,
      hint: "Switch this item to an image category, or paste a YouTube link.",
    };
  }

  // expect === "link"
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return { ok: false, reason: `"${u.protocol}" links are not allowed here.`, hint: "Use an https:// address." };
    }
    return { ok: true, kind: "link", url: u.toString() };
  } catch {
    return {
      ok: false,
      reason: "That is not a complete web address.",
      hint: "It should start with https:// , for example https://your-project.com",
    };
  }
}

/** Same idea for image URLs shown on image tiles. */
export function parseImageLink(raw: string): LinkParse {
  const s = normalise(String(raw ?? ""));
  if (!s) return { ok: false, reason: "No image yet. Paste a direct image URL so the tile has something to show." };
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return { ok: false, reason: "Image links must be http(s) addresses." };
    }
    if (/youtube|youtu\.be/i.test(u.hostname)) {
      return { ok: false, reason: "This is a video link, not an image.", hint: "Paste a .jpg / .png / .webp URL, or a screenshot link." };
    }
    return { ok: true, kind: "link", url: u.toString() };
  } catch {
    return { ok: false, reason: "That is not a complete image address.", hint: "It should start with https:// and usually ends in .jpg, .png or .webp" };
  }
}
