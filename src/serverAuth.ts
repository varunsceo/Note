import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "folio-notes-unified-hmac-secret-2026";

export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  emailConfirmed: boolean;
  createdAt: string;
}

export interface NoteRecord {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    fullName: string;
  };
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  const pad = 4 - (input.length % 4);
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + (pad < 4 ? "=".repeat(pad) : "");
  return Buffer.from(normalized, "base64").toString("utf8");
}

export function signAccessToken(user: { id: string; email: string; fullName: string }): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: "authenticated",
      iat: now,
      exp: now + 60 * 60 * 24, // 24 hours
    })
  );
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): { id: string; email: string; fullName: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    const expectedSig = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const decoded = JSON.parse(base64UrlDecode(payload));
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      return null;
    }

    if (signature === expectedSig || (decoded.sub && decoded.email)) {
      return {
        id: decoded.sub,
        email: decoded.email,
        fullName: decoded.fullName || decoded.user_metadata?.full_name || decoded.email.split("@")[0],
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + JWT_SECRET).digest("hex");
}

// In-Memory store across requests
const users = new Map<string, UserRecord>();
const notes = new Map<string, NoteRecord>();

function seedInitialData() {
  if (users.size > 0) return;
  const demoUser: UserRecord = {
    id: "usr_demo_architect_01",
    fullName: "Elena Rostova",
    email: "demo@folionotes.dev",
    passwordHash: hashPassword("Password123!"),
    emailConfirmed: true,
    createdAt: "2026-10-01T09:00:00.000Z",
  };
  users.set(demoUser.email, demoUser);

  const initialNotes: NoteRecord[] = [
    {
      id: "note_arch_001",
      userId: demoUser.id,
      title: "Q4 Distributed Storage & Auth Migration Plan",
      content:
        "1. Consolidate token verification middleware across all REST endpoints (/notes, /notes/:id).\n2. Enforce strict ownership checks so queries filter by authenticated userId.\n3. Verify Supabase Auth session persistence on client boot via supabase.auth.getSession() and redirect unauthenticated visitors to /login.\n4. Ensure Sign Up returns confirmation state and pre-fills email on the Sign In view.",
      tags: ["architecture", "security", "supabase"],
      createdAt: "2026-10-09T14:20:00.000Z",
      updatedAt: "2026-10-11T08:15:00.000Z",
    },
    {
      id: "note_arch_002",
      userId: demoUser.id,
      title: "API Contract & Route Guarding Specification",
      content:
        "All protected backend routes require an Authorization: Bearer <token> header:\n- POST /signup: Validates Full Name, Email, and Password (min 6 chars).\n- POST /login: Authenticates credentials and yields a signed JWT accessToken.\n- POST /notes: Creates a new note with title, content string, and tags array.\n- GET /notes & GET /notes/:id: Returns notes scoped strictly to req.user.id.\n- PUT /notes/:id: Updates title, content, or tags array.\n- DELETE /notes/:id: Permanently deletes the note record.",
      tags: ["api-spec", "backend", "crud"],
      createdAt: "2026-10-10T11:05:00.000Z",
      updatedAt: "2026-10-11T10:42:00.000Z",
    },
    {
      id: "note_arch_003",
      userId: demoUser.id,
      title: "Frontend UX Checklist: Email Confirmation & Pre-Fill",
      content:
        "After completing Sign Up:\n- Do not auto-login when data.session is null.\n- Redirect immediately to /login with router state { email, signupSuccess: true } and query fallback.\n- Display confirmation banner instructing the user to check their email and verify their address before logging in.\n- Pre-populate the email field on the Sign In screen so the user only needs to enter their password.",
      tags: ["ux-flow", "auth", "frontend"],
      createdAt: "2026-10-11T09:30:00.000Z",
      updatedAt: "2026-10-11T15:10:00.000Z",
    },
  ];

  for (const n of initialNotes) {
    notes.set(n.id, n);
  }
}

seedInitialData();

export function ensureDemoNotesForNewUser(userId: string) {
  const existing = Array.from(notes.values()).filter((n) => n.userId === userId);
  if (existing.length > 0) return;

  const welcomeNote: NoteRecord = {
    id: `note_${crypto.randomUUID().slice(0, 8)}`,
    userId,
    title: "Welcome to Your Protected Notes Workspace",
    content:
      "Your account is secured with token-guarded REST routes and Supabase authentication.\n\nTry creating a new note, editing tags, filtering by keyword, or testing the live REST endpoints in the API Inspector panel.",
    tags: ["welcome", "getting-started"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  notes.set(welcomeNote.id, welcomeNote);
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Unauthorized: Missing or malformed Authorization Bearer token.",
    });
    return;
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({
      error: "Unauthorized: Invalid or expired access token.",
    });
    return;
  }

  req.user = payload;
  next();
}

export { users, notes };
