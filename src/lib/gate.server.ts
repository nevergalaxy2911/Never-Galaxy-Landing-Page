/**
 * Server-only gate helpers. Filename-blocked from client bundles.
 * Do NOT import this file from any client-reachable module at top level —
 * always use `await import("./gate.server")` inside a server fn handler.
 */
import { useSession } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";

export type GateSession = { unlocked?: boolean; at?: number };

export function sessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_SECRET is not set (need 32+ char random string in Vercel env vars).",
    );
  }
  return {
    password,
    name: "ng-site-gate",
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function getSession() {
  return useSession<GateSession>(sessionConfig());
}

export async function requireUnlocked() {
  const session = await getSession();
  if (!session.data.unlocked) {
    throw redirect({ to: "/unlock" });
  }
  return session;
}
