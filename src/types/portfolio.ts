/**
 * Shared portfolio item types.
 *
 * HOW TO MODIFY:
 *   • Add fields here → they immediately become available across every
 *     component that renders a video/motion/graphic tile.
 *   • Keep this file dependency-free so it can be imported anywhere
 *     (client, server, tests) without pulling in React.
 */

export type PortfolioKind = "video" | "motion" | "graphic";

export type VideoItem = {
  id: string;
  title: string;
  kind: string;
  youtubeId?: string;
  span: string;
};

export type GraphicItem = {
  id: string;
  title: string;
  kind: string;
  src?: string;
  /** Optional mobile-optimized variant, served via <img srcSet> on ≤640px. */
  srcMobile?: string;
  href?: string;
  span: string;
};
