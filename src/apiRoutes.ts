import type { Request, Response } from "express";
import crypto from "crypto";
import {
  users,
  notes,
  hashPassword,
  signAccessToken,
  ensureDemoNotesForNewUser,
  requireAuth,
  AuthenticatedRequest,
  UserRecord,
  NoteRecord,
} from "./serverAuth.ts";

export function registerApiRoutes(app: any) {
  // 1. Sign Up (POST /signup and /api/signup)
  const handleSignup = (req: Request, res: Response) => {
    const { fullName, name, email, password } = req.body || {};
    const resolvedName = (fullName || name || "").trim();
    const resolvedEmail = (email || "").trim().toLowerCase();
    const resolvedPassword = typeof password === "string" ? password : "";

    if (!resolvedName || resolvedName.length < 2) {
      res.status(400).json({ error: "Full Name is required (minimum 2 characters)." });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!resolvedEmail || !emailRegex.test(resolvedEmail)) {
      res.status(400).json({ error: "Please provide a valid email address." });
      return;
    }

    if (!resolvedPassword || resolvedPassword.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters long." });
      return;
    }

    if (users.has(resolvedEmail)) {
      res.status(409).json({ error: "An account with this email address already exists." });
      return;
    }

    const newUser: UserRecord = {
      id: `usr_${crypto.randomUUID().slice(0, 10)}`,
      fullName: resolvedName,
      email: resolvedEmail,
      passwordHash: hashPassword(resolvedPassword),
      emailConfirmed: true,
      createdAt: new Date().toISOString(),
    };

    users.set(resolvedEmail, newUser);
    ensureDemoNotesForNewUser(newUser.id);

    res.status(201).json({
      message: "Your account has been created. Please check your email and verify your address before logging in.",
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
        createdAt: newUser.createdAt,
      },
      session: null,
    });
  };

  app.post("/signup", handleSignup);
  app.post("/api/signup", handleSignup);

  // 2. Login (POST /login and /api/login)
  const handleLogin = (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    const resolvedEmail = (email || "").trim().toLowerCase();
    const resolvedPassword = typeof password === "string" ? password : "";

    if (!resolvedEmail || !resolvedPassword) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const user = users.get(resolvedEmail);
    if (!user || user.passwordHash !== hashPassword(resolvedPassword)) {
      res.status(401).json({ error: "Invalid email or password. Please try again." });
      return;
    }

    const accessToken = signAccessToken({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    });

    res.status(200).json({
      accessToken,
      tokenType: "Bearer",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  };

  app.post("/login", handleLogin);
  app.post("/api/login", handleLogin);

  // Current authenticated user
  app.get("/api/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({ user: req.user });
  });

  // 3. Create Note (POST /notes & /api/notes)
  const handleCreateNote = (req: AuthenticatedRequest, res: Response) => {
    const { title, content, tags } = req.body || {};
    const trimmedTitle = typeof title === "string" ? title.trim() : "";
    const trimmedContent = typeof content === "string" ? content.trim() : "";

    if (!trimmedTitle) {
      res.status(400).json({ error: "Note title is required." });
      return;
    }

    if (!trimmedContent) {
      res.status(400).json({ error: "Note content string is required." });
      return;
    }

    const parsedTags: string[] = Array.isArray(tags)
      ? tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
      : [];

    const now = new Date().toISOString();
    const newNote: NoteRecord = {
      id: `note_${crypto.randomUUID().slice(0, 8)}`,
      userId: req.user!.id,
      title: trimmedTitle,
      content: trimmedContent,
      tags: Array.from(new Set(parsedTags)),
      createdAt: now,
      updatedAt: now,
    };

    notes.set(newNote.id, newNote);
    res.status(201).json(newNote);
  };

  app.post("/notes", requireAuth, handleCreateNote);
  app.post("/api/notes", requireAuth, handleCreateNote);

  // 4. Read Notes (GET /notes & GET /notes/:id)
  const handleGetNotes = (req: AuthenticatedRequest, res: Response) => {
    ensureDemoNotesForNewUser(req.user!.id);
    const allNotes: NoteRecord[] = Array.from(notes.values());
    const userNotes = allNotes
      .filter((n: NoteRecord) => n.userId === req.user!.id)
      .sort((a: NoteRecord, b: NoteRecord) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    res.status(200).json(userNotes);
  };

  app.get("/notes", requireAuth, handleGetNotes);
  app.get("/api/notes", requireAuth, handleGetNotes);

  const handleGetNoteById = (req: AuthenticatedRequest, res: Response) => {
    const note = notes.get(req.params.id);
    if (!note || note.userId !== req.user!.id) {
      res.status(404).json({ error: "Note not found or access denied." });
      return;
    }
    res.status(200).json(note);
  };

  app.get("/notes/:id", requireAuth, handleGetNoteById);
  app.get("/api/notes/:id", requireAuth, handleGetNoteById);

  // 5. Update Note (PUT /notes/:id)
  const handleUpdateNote = (req: AuthenticatedRequest, res: Response) => {
    const existing = notes.get(req.params.id);
    if (!existing || existing.userId !== req.user!.id) {
      res.status(404).json({ error: "Note not found or access denied." });
      return;
    }

    const { title, content, tags } = req.body || {};

    const updatedTitle =
      title !== undefined ? String(title).trim() : existing.title;
    const updatedContent =
      content !== undefined ? String(content).trim() : existing.content;
    const updatedTags = Array.isArray(tags)
      ? Array.from(new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)))
      : existing.tags;

    if (!updatedTitle) {
      res.status(400).json({ error: "Note title cannot be empty." });
      return;
    }

    if (!updatedContent) {
      res.status(400).json({ error: "Note content cannot be empty." });
      return;
    }

    const updatedNote: NoteRecord = {
      ...existing,
      title: updatedTitle,
      content: updatedContent,
      tags: updatedTags,
      updatedAt: new Date().toISOString(),
    };

    notes.set(updatedNote.id, updatedNote);
    res.status(200).json(updatedNote);
  };

  app.put("/notes/:id", requireAuth, handleUpdateNote);
  app.put("/api/notes/:id", requireAuth, handleUpdateNote);

  // 6. Delete Note (DELETE /notes/:id)
  const handleDeleteNote = (req: AuthenticatedRequest, res: Response) => {
    const existing = notes.get(req.params.id);
    if (!existing || existing.userId !== req.user!.id) {
      res.status(404).json({ error: "Note not found or access denied." });
      return;
    }

    notes.delete(req.params.id);
    res.status(200).json({
      message: "Note deleted permanently.",
      id: req.params.id,
    });
  };

  app.delete("/notes/:id", requireAuth, handleDeleteNote);
  app.delete("/api/notes/:id", requireAuth, handleDeleteNote);
}
