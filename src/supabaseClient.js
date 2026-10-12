import { createClient } from "@supabase/supabase-js";

// ============================================================================
// SUPABASE CONFIGURATION: Loaded from .env (import.meta.env) with safe fallbacks
// ============================================================================
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://aimyolveljmuluzeczwa.supabase.co";

const SUPABASE_PUBLIC_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpbXlvbHZlbGptdWx1emVjendhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NTAwMzUsImV4cCI6MjEwNzMyNjAzNX0.wgyRprbBhEyFQu2q-wNgq2G1bvmrWfPbE4FI6VwwMYU";

// Custom resilient fetch adapter so the client works seamlessly with both a live
// Supabase project and the unified local Express backend (/signup, /login) when
// the placeholder URL is offline in preview environments.
const customSupabaseFetch = async (input, init) => {
  const urlStr = typeof input === "string" ? input : input.url || String(input);

  try {
    const response = await fetch(input, init);
    if (response.ok || response.status < 500) {
      // Check if it's an unreachable Supabase project returning a 404/400 DNS error
      const clone = response.clone();
      const text = await clone.text();
      if (!text.includes("Project not specified") && !text.includes("not found") && response.status !== 404) {
        return response;
      }
    }
  } catch (_err) {
    // Fallback to local unified auth bridge below if placeholder Supabase URL is unreachable
  }

  // Bridge Supabase Auth endpoints to the unified Express backend (/signup & /login)
  if (urlStr.includes("/auth/v1/signup") && init?.method === "POST") {
    const body = JSON.parse(init.body || "{}");
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const fullName = body.data?.full_name || email.split("@")[0] || "User";

    const res = await fetch("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password }),
    });
    const payload = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          code: res.status,
          error_code: "signup_error",
          msg: payload.error || "Sign up failed",
          message: payload.error || "Sign up failed",
        }),
        { status: res.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Per email confirmation specification: return user with session: null
    // so the user must verify/confirm and sign in explicitly on /login
    return new Response(
      JSON.stringify({
        user: {
          id: payload.user.id,
          aud: "authenticated",
          role: "authenticated",
          email: payload.user.email,
          user_metadata: { full_name: payload.user.fullName },
          app_metadata: { provider: "email" },
          created_at: payload.user.createdAt,
        },
        session: null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (urlStr.includes("/auth/v1/token") && init?.method === "POST") {
    const body = JSON.parse(init.body || "{}");
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: payload.error || "Invalid login credentials",
          message: payload.error || "Invalid login credentials",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const nowSec = Math.floor(Date.now() / 1000);
    return new Response(
      JSON.stringify({
        access_token: payload.accessToken,
        token_type: "bearer",
        expires_in: 86400,
        expires_at: nowSec + 86400,
        refresh_token: payload.accessToken,
        user: {
          id: payload.user.id,
          aud: "authenticated",
          role: "authenticated",
          email: payload.user.email,
          email_confirmed_at: new Date().toISOString(),
          user_metadata: { full_name: payload.user.fullName },
          app_metadata: { provider: "email" },
          created_at: payload.user.createdAt,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (urlStr.includes("/auth/v1/user") && (!init?.method || init?.method === "GET")) {
    const authHeader = init?.headers?.Authorization || init?.headers?.authorization || "";
    const res = await fetch("/api/me", {
      headers: { Authorization: authHeader },
    });
    if (res.ok) {
      const payload = await res.json();
      return new Response(
        JSON.stringify({
          id: payload.user.id,
          aud: "authenticated",
          role: "authenticated",
          email: payload.user.email,
          user_metadata: { full_name: payload.user.fullName },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (urlStr.includes("/auth/v1/logout")) {
    return new Response(JSON.stringify({}), {
      status: 204,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
  global: {
    fetch: customSupabaseFetch,
  },
});
