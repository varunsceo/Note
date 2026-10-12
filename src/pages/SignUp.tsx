import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import { BookOpen, AlertCircle, CheckCircle2, ArrowRight, User, Mail, Lock } from "lucide-react";

export default function SignUp() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setConfirmationMessage(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || trimmedName.length < 2) {
      setError("Full Name is required (minimum 2 characters).");
      return;
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedName,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // Ensure we do NOT auto-login after signup
      if (data?.session) {
        await supabase.auth.signOut();
      }

      // Show confirmation message if session is null, then redirect to Sign In with pre-filled email
      if (!data?.session) {
        setConfirmationMessage("Check your email and confirm your account before logging in.");
      }

      // Redirect the user to the Sign In page and pass the email so it is pre-filled
      navigate(`/login?email=${encodeURIComponent(trimmedEmail)}&registered=true`, {
        replace: true,
        state: {
          email: trimmedEmail,
          signupSuccess: true,
          message:
            "Your account has been created. Please check your email and verify your address before logging in.",
        },
      });
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during sign up.");
    } finally {
      setLoading(false);
    }
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
          <Link to="/login" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            Workspace
          </Link>
          <Link to="/signup" className="text-slate-900 font-semibold whitespace-nowrap shrink-0">
            Create Account
          </Link>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/login"
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Main Content Split */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Architectural Context */}
        <div className="lg:col-span-6 space-y-6">
          <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
            <span>Unified System Architecture</span>
            <span aria-hidden="true">·</span>
            <span>Supabase Auth + REST CRUD</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
            Create your private notes workspace.
          </h1>

          <p className="text-base text-slate-600 leading-relaxed max-w-xl">
            Register with your full name, email address, and password. Your account is provisioned via{" "}
            <code className="text-xs font-mono bg-slate-200/70 px-1.5 py-0.5 rounded text-slate-800">
              supabase.auth.signUp(&#123; email, password &#125;)
            </code>{" "}
            and synchronized with token-guarded{" "}
            <code className="text-xs font-mono bg-slate-200/70 px-1.5 py-0.5 rounded text-slate-800">
              POST /signup
            </code>{" "}
            validation.
          </p>

          <div className="pt-4 border-t border-slate-200 space-y-3 text-sm text-slate-600">
            <div className="flex items-baseline justify-between">
              <span className="font-medium text-slate-900">01. Email Verification Guard</span>
              <span className="text-xs font-mono text-slate-500 tabular-nums">POST /signup</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upon registration, auto-login is prevented and your email address is carried directly to the Sign In form with verification instructions.
            </p>

            <div className="flex items-baseline justify-between pt-2">
              <span className="font-medium text-slate-900">02. Token-Guarded Privacy</span>
              <span className="text-xs font-mono text-slate-500 tabular-nums">Bearer JWT</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Every note creation, retrieval, update, and deletion endpoint verifies your active session token before executing queries.
            </p>
          </div>
        </div>

        {/* Right Column: Sign Up Form Card */}
        <div className="lg:col-span-6">
          <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md mx-auto w-full">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Sign Up</h2>
              <p className="text-sm text-slate-500 mt-1">
                Enter your details below to register a new account.
              </p>
            </div>

            {confirmationMessage && (
              <div
                role="status"
                className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-900"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{confirmationMessage}</div>
              </div>
            )}

            <form onSubmit={handleSignUp} className="space-y-4" noValidate>
              <div>
                <label htmlFor="signup-fullname" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="signup-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ada Lovelace"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="signup-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ada@folionotes.dev"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="signup-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
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
                <span>{loading ? "Creating Account..." : "Create Account"}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-600">
                Already have an account?{" "}
                <Link to="/login" className="font-semibold text-slate-900 hover:underline">
                  Sign in here
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
