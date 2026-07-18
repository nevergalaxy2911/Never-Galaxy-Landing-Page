/**
 * Shared-password gate server functions. Handler bodies dynamically import
 * ./gate.server so useSession never lands in the client bundle.
 */
import { createServerFn } from "@tanstack/react-start";

/** POST /unlock — check password, set cookie. */
export const unlockSite = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => {
    if (typeof data?.password !== "string" || data.password.length > 500) {
      throw new Error("Invalid input");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const { getSession, passwordMatches } = await import("./gate.server");
    const expected = process.env.SITE_PASSWORD;
    if (!expected) {
      return { ok: false as const, reason: "SITE_PASSWORD env var is not set." };
    }
    if (!passwordMatches(data.password, expected)) {
      return { ok: false as const };
    }
    const session = await getSession();
    await session.update({ unlocked: true, at: Date.now() });
    return { ok: true as const };
  });

/** POST — clear cookie. */
export const lockSite = createServerFn({ method: "POST" }).handler(async () => {
  const { getSession } = await import("./gate.server");
  const session = await getSession();
  await session.clear();
  return { ok: true as const };
});

/** GET — check unlock state without redirecting. */
export const getUnlockState = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getSession } = await import("./gate.server");
    const session = await getSession();
    return { unlocked: !!session.data.unlocked };
  } catch {
    return { unlocked: false };
  }
});
