import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import { BookOpen, AlertCircle, CheckCircle2, ArrowRight, Mail, Lock, KeyRound } from "lucide-react";

interface LocationState {
  email?: string;
  signupSuccess?: boolean;
  message?: string;
}

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const state = (location.state as LocationState) || {};
  const queryEmail = searchParams.get("email") || "";
  const queryRegistered = searchParams.get("registered") === "true";

  // Pre-fill email passed from Sign Up via router state or query parameter
  const initialEmail = state.email || queryEmail || "";
  const cameFromSignup = Boolean(state.signupSuccess || queryRegistered);

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupBanner, setSignupBanner] = useState<string | null>(
    cameFromSignup
      ? state.message ||
          "Your account has been created. Please check your email and verify your address before logging in."
      : null
  );

  // Sync email and success message if location state or query params update
  useEffect(() => {
    const nextEmail = state.email || searchParams.get("email") || "";
    if (nextEmail) {
      setEmail(nextEmail);
    }
    if (state.signupSuccess || searchParams.get("registered") === "true") {
      setSignupBanner(
        state.message ||
          "Your account has been created. Please check your email and verify your address before logging in."
      );
    }
  }, [state.email, state.signupSuccess, state.message, searchParams]);

  // If a real session already exists, redirect straight to the dashboard ("/")
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data?.session) {
        navigate("/", { replace: true });
      }
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Please enter both your email address and password.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // Only redirect when a real session exists after login
      if (data?.session) {
        navigate("/", { replace: true });
      } else {
        setError("Check your email and confirm your account before logging in.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemoAccount = () => {
    setEmail("demo@folionotes.dev");
    setPassword("Password123!");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
      {/* Top Bar Contract: 3 Zones */}
      <header className="flex items-center justify-between gap-8 px-8 py-4 bg-white border-b border-slate-200">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          <BookOpen className="w-5 h-5 text-slate-900" />
          <span>Folio Notes</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link to="/login" className="text-slate-900 font-semibold whitespace-nowrap shrink-0">
            Sign In
          </Link>
          <Link to="/signup" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            Create Account
          </Link>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/signup"
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            Sign Up
          </Link>
        </div>
      </header>

      {/* Main Content Split */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Editorial Overview */}
        <div className="lg:col-span-6 space-y-6">
          <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
            <span>Authenticated Session Guard</span>
            <span aria-hidden="true">·</span>
            <span>Bearer Token Architecture</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
            Sign in to your notes repository.
          </h1>

          <p className="text-base text-slate-600 leading-relaxed max-w-xl">
            Authenticate via{" "}
            <code className="text-xs font-mono bg-slate-200/70 px-1.5 py-0.5 rounded text-slate-800">
              supabase.auth.signInWithPassword(&#123; email, password &#125;)
            </code>{" "}
            to obtain a verified session token. Private routes verify your session using{" "}
            <code className="text-xs font-mono bg-slate-200/70 px-1.5 py-0.5 rounded text-slate-800">
              supabase.auth.getSession()
            </code>
            .
          </p>

          {/* Instant Demo Credentials Box */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5 max-w-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900">Pre-Seeded Architect Account</span>
              <button
                type="button"
                onClick={handleFillDemoAccount}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer whitespace-nowrap"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Auto-fill Demo Credentials</span>
              </button>
            </div>
            <div className="text-xs text-slate-500 font-mono space-y-0.5 tabular-nums">
              <div>Email: demo@folionotes.dev</div>
              <div>Password: Password123!</div>
            </div>
          </div>
        </div>

        {/* Right Column: Sign In Card */}
        <div className="lg:col-span-6">
          <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md mx-auto w-full">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Sign In</h2>
              <p className="text-sm text-slate-500 mt-1">
                Enter your email and password to access your notes.
              </p>
            </div>

            {/* Clear success message above the form when arriving from a successful Sign Up */}
            {signupBanner && (
              <div
                role="status"
                data-testid="signup-success-banner"
                className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-900"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{signupBanner}</div>
              </div>
            )}

            <form onSubmit={handleSignIn} className="space-y-4" noValidate>
              <div>
                <label htmlFor="signin-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="signin-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signin-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="signin-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <span>{loading ? "Signing In..." : "Sign In"}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-600">
                Don&apos;t have an account yet?{" "}
                <Link to="/signup" className="font-semibold text-slate-900 hover:underline">
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="px-8 py-4 border-t border-slate-200 bg-white text-xs text-slate-500 flex items-center justify-between">
        <span>Folio Notes Workspace</span>
        <span>Protected by Supabase Auth & Token Route Guards</span>
      </footer>
    </div>
  );
}
