/**
 * Shared portfolio item types.
 *
 * HOW TO MODIFY:
 *   • Add fields here → they immediately become available across every
 *     component that renders a video/motion/graphic tile.
 *   • Keep this file dependency-free so it can be imported anywhere
 *     (client, server, tests) without pulling in React.
 */

import type { AspectConfig } from "@/lib/portfolio-aspect";

export type PortfolioKind = "video" | "motion" | "graphic";

export type VideoItem = {
  id: string;
  title: string;
  kind: string;
  youtubeId?: string;
  span: string;
  /** Admin-chosen media shape. Reserves the exact box so nothing shifts. */
  aspect?: AspectConfig;
};

export type GraphicItem = {
  id: string;
  title: string;
  kind: string;
  src?: string;
  /** Optional mobile-optimized variant, served via <img srcSet> on ≤640px. */
  srcMobile?: string;
  /** Tiny blurred placeholder for instant website tile paint while the real shot decodes. */
  placeholderSrc?: string;
  /** Larger optimized screenshot used behind the iframe preview modal while the live site loads. */
  previewSrc?: string;
  href?: string;
  span: string;
  /** Admin-chosen media shape. Reserves the exact box so nothing shifts. */
  aspect?: AspectConfig;
  /** If true, item claims large-format hero styling in the bento grid. */
  featured?: boolean;
};

