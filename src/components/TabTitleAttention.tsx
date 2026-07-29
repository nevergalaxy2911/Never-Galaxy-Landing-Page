import { useEffect } from "react";

/* -----------------------------------------------------------------------------
 * TabTitleAttention — when the visitor switches to another tab, the document
 * title alternates between the real page title and a friendly "come back"
 * nudge, looping until they return. On return the original title is restored
 * exactly, so nothing leaks into history or bookmarks.
 *
 * WHY A LOOP AND NOT A ONE-SHOT: a static changed title is easy to miss in a
 * crowded tab strip; alternating text is what actually catches the eye.
 *
 * ACCESSIBILITY / ETIQUETTE: the swap only ever runs while the tab is hidden,
 * so it can never distract someone who is actually reading the page, and it
 * stops the instant the tab becomes visible again.
 *
 * HOW TO MODIFY
 *   • Change the wording   → MESSAGES (add as many as you like; they cycle).
 *   • Change the speed     → SWAP_MS.
 *   • Disable it entirely  → stop rendering <TabTitleAttention /> in
 *     src/routes/index.tsx.
 * --------------------------------------------------------------------------- */

const MESSAGES = ["👀 Come back!", "🌌 Still orbiting…"];
const SWAP_MS = 1400;

export function TabTitleAttention() {
  useEffect(() => {
    let timer = 0;
    let original = document.title;
    let step = 0;

    const stop = () => {
      if (timer) window.clearInterval(timer);
      timer = 0;
      step = 0;
      if (document.title !== original) document.title = original;
    };

    const start = () => {
      if (timer) return;
      // Capture the *current* title so per-route titles are respected.
      original = document.title;
      timer = window.setInterval(() => {
        step++;
        // Even steps show the real title, odd steps cycle the nudges — that
        // back-and-forth is what makes the tab visibly blink.
        document.title =
          step % 2 === 1
            ? MESSAGES[Math.floor(step / 2) % MESSAGES.length]
            : original;
      }, SWAP_MS);
    };

    const onVisibility = () => (document.hidden ? start() : stop());
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, []);

  return null;
}

export default TabTitleAttention;
