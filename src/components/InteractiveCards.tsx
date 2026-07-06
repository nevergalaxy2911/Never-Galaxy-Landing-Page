import { useInteractiveCards } from "@/hooks/useInteractiveCards";

/**
 * InteractiveCards — thin mount for the global card interactivity system.
 *
 * All RAF, pointer, and tilt logic lives in `useInteractiveCards` so it
 * can be reused/tested in isolation. This component just runs the hook
 * once at app root and renders nothing.
 *
 * Effects driven: 3D tilt, cone border glow, surface spotlight, and a
 * motion-driven hue shift. See the hook file for tuning knobs.
 */
export function InteractiveCards() {
  useInteractiveCards();
  return null;
}
