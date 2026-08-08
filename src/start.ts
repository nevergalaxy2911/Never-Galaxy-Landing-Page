import { createStart, createMiddleware } from "@tanstack/react-start";
import { renderErrorPage } from "./lib/error-page";
import { supabase } from "./integrations/supabase/client";

// Server-side error catcher: renders our styled 500 page instead of a stack.
// Skips redirects and aborts which are internal framework signals.
const errorMiddleware = createMiddleware({ type: "request" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // Pass-through redirects, not-founds, and other framework-internal signals
    if (error != null && typeof error === "object") {
      if ("statusCode" in error || "status" in error || "isRedirect" in error || "__isNotFound" in error) {
        throw error;
      }
      // Pass-through explicit aborts (standard or Framework-specific)
      if ("name" in error && (error.name === "AbortError" || error.name === "AbortSignal")) {
        throw error;
      }
      if (String(error).toLowerCase().includes("aborted")) {
        throw error;
      }
    }
    
    // Log real unexpected crashes
    console.error("[Start] Server Error:", error);
    
    // Fallback for real crashes: return our branded shell instead of a raw stack
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Client-side function middleware: attach the Supabase access token to every
// createServerFn call so requireAdmin() in the server can validate the caller.
// Only runs in the browser; server-side calls (SSR loaders) skip this.
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

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
