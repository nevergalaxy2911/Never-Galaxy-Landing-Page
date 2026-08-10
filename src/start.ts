import { createMiddleware } from "@tanstack/react-start";
import { renderErrorPage } from "./lib/error-page";
import { supabase } from "./integrations/supabase/client";

/**
 * Server-side error catcher: renders our styled 500 page instead of a stack.
 * Skips framework signals like redirects and aborts to avoid blank screens
 * during navigation or expected cancellations.
 */
const errorMiddleware = createMiddleware({ type: "request" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // 1. Pass-through redirects, not-founds, and other framework-internal signals
    if (error != null && typeof error === "object") {
      if ("statusCode" in error || "status" in error || "isRedirect" in error || "__isNotFound" in error) {
        throw error;
      }
      
      // 2. Identify and ignore abort/cancellation events (normal during navigation)
      const errorStr = String(error).toLowerCase();
      const isAbort = 
        ("name" in error && (error.name === "AbortError" || error.name === "AbortSignal")) ||
        errorStr.includes("aborted") ||
        errorStr.includes("abortincoming") ||
        errorStr.includes("socketonclose");

      if (isAbort) {
        // Log locally so we can confirm they are happening without blowing up the UI
        console.log(`[Start] Abort Signal Caught: ${errorStr}`);
        throw error;
      }
    }

    // 3. Log real unexpected crashes with detail
    console.error("[Start] Critical Server Error:", error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    
    // 4. Fallback for real crashes: return our branded shell instead of a raw stack.
    // This ensures the user sees a friendly error page instead of a blank screen.
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * Client-side function middleware: attach the Supabase access token to every
 * createServerFn call so requireAdmin() in the server can validate the caller.
 * Only runs in the browser; server-side calls (SSR loaders) skip this.
 */
const attachSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  if (!supabase || typeof window === "undefined") return next();
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      return next({ headers: { Authorization: `Bearer ${token}` } });
    }
  } catch {
    /* fall through, unauth server fn will 401 as expected */
  }
  return next();
});

import { createStart } from "@tanstack/react-start";
export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));

// V8.2 Production Stability: Hardened Abort Protection & Error Recovery [2026-08-10_18:25]
// Sync attempt 1786384955470
