import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  Save,
  LogOut,
  FileText,
  Terminal,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface ApiLogEntry {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint: string;
  status: number;
  timestamp: string;
  summary: string;
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [accessToken, setAccessToken] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userFullName, setUserFullName] = useState<string>("");

  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(true);
  const [savingNote, setSavingNote] = useState<boolean>(false);
  const [deletingNote, setDeletingNote] = useState<boolean>(false);

  // Editor state
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [titleInput, setTitleInput] = useState<string>("");
  const [contentInput, setContentInput] = useState<string>("");
  const [tagsInput, setTagsInput] = useState<string>("");

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTagFilter, setActiveTagFilter] = useState<string>("all");

  // Active workspace tab ("notes" | "architecture")
  const [activeSection, setActiveSection] = useState<"notes" | "architecture">("notes");

  // Feedback & API logs
  const [statusNotice, setStatusNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([]);
  const [singleNoteLookupResult, setSingleNoteLookupResult] = useState<Note | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const appendApiLog = (
    method: "GET" | "POST" | "PUT" | "DELETE",
    endpoint: string,
    status: number,
    summary: string
  ) => {
    const entry: ApiLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      method,
      endpoint,
      status,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      summary,
    };
    setApiLogs((prev) => [entry, ...prev.slice(0, 14)]);
  };

  // Load session via supabase.auth.getSession() and fetch user's notes
  useEffect(() => {
    let mounted = true;

    async function initWorkspace() {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session) {
        navigate("/login", { replace: true });
        return;
      }

      const session = data.session;
      if (!mounted) return;

      const token = session.access_token;
      setAccessToken(token);
      setUserEmail(session.user?.email || "");
      setUserFullName(
        session.user?.user_metadata?.full_name ||
          session.user?.email?.split("@")[0] ||
          "Authenticated User"
      );

      await fetchAllNotes(token);
    }

    initWorkspace();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  // GET /notes — Fetch all notes belonging to the authenticated user
  const fetchAllNotes = async (tokenToUse?: string) => {
    const token = tokenToUse || accessToken;
    if (!token) return;

    setLoadingNotes(true);
    try {
      const res = await fetch("/notes", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      appendApiLog("GET", "/notes", res.status, `Fetched ${Array.isArray(data) ? data.length : 0} user notes`);

      if (!res.ok) {
        if (res.status === 401) {
          await supabase.auth.signOut();
          navigate("/login", { replace: true });
          return;
        }
        throw new Error(data.error || "Failed to fetch notes");
      }

      setNotes(data);
      if (data.length > 0 && !selectedNoteId && !isCreatingNew) {
        selectExistingNote(data[0]);
      } else if (data.length === 0) {
        startNewNoteDraft();
      }
    } catch (err: any) {
      setStatusNotice({ type: "error", text: err?.message || "Could not load notes." });
    } finally {
      setLoadingNotes(false);
    }
  };

  // GET /notes/{id} — Fetch a single note belonging to the authenticated user
  const fetchSingleNoteById = async (id: string) => {
    if (!accessToken) return;
    setStatusNotice(null);

    try {
      const res = await fetch(`/notes/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      appendApiLog("GET", `/notes/${id}`, res.status, res.ok ? `Loaded "${data.title}"` : data.error);

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch note by ID");
      }

      setSingleNoteLookupResult(data);
      selectExistingNote(data);
      setStatusNotice({
        type: "success",
        text: `Verified GET /notes/${id} response (200 OK).`,
      });
    } catch (err: any) {
      setStatusNotice({ type: "error", text: err?.message || "Failed to fetch single note." });
    }
  };

  const selectExistingNote = (note: Note) => {
    setIsCreatingNew(false);
    setSelectedNoteId(note.id);
    setTitleInput(note.title);
    setContentInput(note.content);
    setTagsInput(note.tags.join(", "));
    setStatusNotice(null);
  };

  const startNewNoteDraft = () => {
    setIsCreatingNew(true);
    setSelectedNoteId(null);
    setTitleInput("");
    setContentInput("");
    setTagsInput("");
    setStatusNotice(null);
  };

  const parseTagsArray = (raw: string): string[] => {
    return Array.from(
      new Set(
        raw
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      )
    );
  };

  // POST /notes (Create) or PUT /notes/{id} (Update)
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusNotice(null);

    const trimmedTitle = titleInput.trim();
    const trimmedContent = contentInput.trim();
    const tagsArray = parseTagsArray(tagsInput);

    if (!trimmedTitle) {
      setStatusNotice({ type: "error", text: "Please provide a note title." });
      return;
    }

    if (!trimmedContent) {
      setStatusNotice({ type: "error", text: "Please provide note content." });
      return;
    }

    setSavingNote(true);

    try {
      if (isCreatingNew || !selectedNoteId) {
        // 3. Create Note (POST /notes): Title, main content string, and tags array.
        const res = await fetch("/notes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            title: trimmedTitle,
            content: trimmedContent,
            tags: tagsArray,
          }),
        });

        const created = await res.json();
        appendApiLog("POST", "/notes", res.status, res.ok ? `Created "${created.title}"` : created.error);

        if (!res.ok) {
          throw new Error(created.error || "Failed to create note.");
        }

        setNotes((prev) => [created, ...prev]);
        selectExistingNote(created);
        setStatusNotice({ type: "success", text: "Note created via POST /notes." });
      } else {
        // 5. Update Note (PUT /notes/{id}): Modify titles, text contents, or tag properties.
        const res = await fetch(`/notes/${encodeURIComponent(selectedNoteId)}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            title: trimmedTitle,
            content: trimmedContent,
            tags: tagsArray,
          }),
        });

        const updated = await res.json();
        appendApiLog(
          "PUT",
          `/notes/${selectedNoteId}`,
          res.status,
          res.ok ? `Updated "${updated.title}"` : updated.error
        );

        if (!res.ok) {
          throw new Error(updated.error || "Failed to update note.");
        }

        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        selectExistingNote(updated);
        setStatusNotice({ type: "success", text: `Note updated via PUT /notes/${updated.id}.` });
      }
    } catch (err: any) {
      setStatusNotice({ type: "error", text: err?.message || "Error saving note." });
    } finally {
      setSavingNote(false);
    }
  };

  // 6. Delete Note (DELETE /notes/{id}): Remove the note permanently.
  const handleDeleteNote = async (idToDelete: string) => {
    if (!idToDelete || !accessToken) return;
    setDeletingNote(true);
    setStatusNotice(null);

    try {
      const res = await fetch(`/notes/${encodeURIComponent(idToDelete)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = await res.json();
      appendApiLog("DELETE", `/notes/${idToDelete}`, res.status, payload.message || "Deleted note");

      if (!res.ok) {
        throw new Error(payload.error || "Failed to delete note.");
      }

      const remaining = notes.filter((n) => n.id !== idToDelete);
      setNotes(remaining);

      if (remaining.length > 0) {
        selectExistingNote(remaining[0]);
      } else {
        startNewNoteDraft();
      }

      setStatusNotice({ type: "success", text: `Note permanently removed via DELETE /notes/${idToDelete}.` });
    } catch (err: any) {
      setStatusNotice({ type: "error", text: err?.message || "Error deleting note." });
    } finally {
      setDeletingNote(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  // All unique tags across user's notes
  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => n.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [notes]);

  // Filtered notes
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const matchesTag = activeTagFilter === "all" || n.tags.includes(activeTagFilter);
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesTag;
      const matchesSearch =
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q));
      return matchesTag && matchesSearch;
    });
  }, [notes, activeTagFilter, searchQuery]);

  const supabaseSnippet = `import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://aimyolveljmuluzeczwa.supabase.co";
const SUPABASE_PUBLIC_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpbXlvbHZlbGptdWx1emVjendhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NTAwMzUsImV4cCI6MjEwNzMyNjAzNX0.wgyRprbBhEyFQu2q-wNgq2G1bvmrWfPbE4FI6VwwMYU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);`;

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(supabaseSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top Bar Contract: 3 Zones (Brand, Nav Links, Primary Action) */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          <BookOpen className="w-5 h-5 text-slate-900" />
          <span>Folio Notes</span>
        </div>

        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveSection("notes")}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === "notes"
                ? "text-slate-900 font-semibold border-b-2 border-slate-900"
                : "hover:text-slate-900"
            }`}
          >
            Notes Workspace
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("architecture")}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === "architecture"
                ? "text-slate-900 font-semibold border-b-2 border-slate-900"
                : "hover:text-slate-900"
            }`}
          >
            API &amp; Supabase Architecture
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleSignOut}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Sub-header context strip */}
      <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{userFullName}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">{userEmail}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{notes.length} Protected Notes</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchAllNotes()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync GET /notes</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSection("notes");
              startNewNoteDraft();
            }}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      {activeSection === "notes" ? (
        <main className="flex-1 max-w-[1440px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-110px)]">
          {/* Left Sidebar: Search, Tag Filters, Note List */}
          <aside className="lg:col-span-4 bg-white border-r border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200 space-y-3">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title, content, or tags..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition-colors"
                />
              </div>

              {/* Interactive Tag Filter Controls (functional buttons) */}
              {allTags.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setActiveTagFilter("all")}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      activeTagFilter === "all"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    All ({notes.length})
                  </button>
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setActiveTagFilter(tag)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        activeTagFilter === tag
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loadingNotes ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="animate-pulse space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-full" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : filteredNotes.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                  <div className="text-sm font-semibold text-slate-800">No matching notes</div>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    {searchQuery || activeTagFilter !== "all"
                      ? "Try clearing your search filter or create a new note."
                      : "Create your first protected note to store titles, prose, and tags."}
                  </p>
                  <button
                    type="button"
                    onClick={startNewNoteDraft}
                    className="px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create First Note</span>
                  </button>
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isSelected = !isCreatingNew && selectedNoteId === note.id;
                  return (
                    <div
                      key={note.id}
                      onClick={() => selectExistingNote(note)}
                      className={`p-4 transition-colors cursor-pointer ${
                        isSelected ? "bg-slate-100/90" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-900 truncate">{note.title}</h3>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0 tabular-nums">
                          {new Date(note.updatedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-2">
                        {note.content}
                      </p>

                      {/* Zero-Pill Metadata Discipline: Unboxed text with typographic separators */}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
                        <span className="font-mono text-slate-400">{note.id}</span>
                        {note.tags.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{note.tags.map((t) => `#${t}`).join(" · ")}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right Main Pane: Note Editor & CRUD Inspector */}
          <section className="lg:col-span-8 p-6 lg:p-8 flex flex-col justify-between space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span className="font-mono">
                      {isCreatingNew ? "POST /notes" : `PUT /notes/${selectedNoteId}`}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Token-Guarded Endpoint</span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                    {isCreatingNew ? "Create New Note" : "Edit Note"}
                  </h2>
                </div>

                <div className="flex items-center gap-2.5">
                  {!isCreatingNew && selectedNoteId && (
                    <>
                      <button
                        type="button"
                        onClick={() => fetchSingleNoteById(selectedNoteId)}
                        className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Test GET /notes/{selectedNoteId}
                      </button>
                      <button
                        type="button"
                        disabled={deletingNote}
                        onClick={() => handleDeleteNote(selectedNoteId)}
                        className="px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{deletingNote ? "Deleting..." : "Delete Note"}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {statusNotice && (
                <div
                  role="status"
                  className={`p-3.5 rounded-lg border flex items-start gap-2.5 text-xs ${
                    statusNotice.type === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  {statusNotice.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <span className="font-medium">{statusNotice.text}</span>
                </div>
              )}

              <form onSubmit={handleSaveNote} className="space-y-4">
                <div>
                  <label htmlFor="note-title" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Note Title
                  </label>
                  <input
                    id="note-title"
                    type="text"
                    required
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    placeholder="Enter a descriptive note title..."
                    className="w-full px-3.5 py-2.5 text-sm font-medium bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="note-tags" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tags (comma-separated array)
                  </label>
                  <input
                    id="note-tags"
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="architecture, roadmap, backend"
                    className="w-full px-3.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="note-content" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Main Content
                  </label>
                  <textarea
                    id="note-content"
                    rows={10}
                    required
                    value={contentInput}
                    onChange={(e) => setContentInput(e.target.value)}
                    placeholder="Write your note content..."
                    className="w-full p-3.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 leading-relaxed focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-slate-500">
                    {parseTagsArray(tagsInput).length > 0 ? (
                      <span>
                        Parsed tags:{" "}
                        <span className="font-mono text-slate-700">
                          [{parseTagsArray(tagsInput).map((t) => `"${t}"`).join(", ")}]
                        </span>
                      </span>
                    ) : (
                      <span>No tags specified</span>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={savingNote}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>
                      {savingNote
                        ? "Saving..."
                        : isCreatingNew
                        ? "Create Note (POST /notes)"
                        : "Save Changes (PUT /notes/{id})"}
                    </span>
                  </button>
                </div>
              </form>
            </div>

            {/* Live Token-Guarded API Activity Log */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-slate-700" />
                  <h3 className="text-xs font-bold text-slate-900">
                    Token-Guarded REST Request Log
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Authorization: Bearer {accessToken ? `${accessToken.slice(0, 18)}...` : "none"}
                </span>
              </div>

              {singleNoteLookupResult && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 overflow-x-auto">
                  <div className="text-[11px] font-sans font-semibold text-slate-500 mb-1">
                    Last GET /notes/{singleNoteLookupResult.id} Payload:
                  </div>
                  {JSON.stringify(singleNoteLookupResult, null, 2)}
                </div>
              )}

              <div className="divide-y divide-slate-100 text-xs font-mono max-h-40 overflow-y-auto">
                {apiLogs.length === 0 ? (
                  <div className="py-3 text-slate-400 font-sans">
                    Interact with notes above to inspect live REST API calls.
                  </div>
                ) : (
                  apiLogs.map((log) => (
                    <div key={log.id} className="py-2 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-bold text-slate-900 w-14 shrink-0">{log.method}</span>
                        <span className="text-slate-700 truncate">{log.endpoint}</span>
                        <span className="text-slate-500 font-sans truncate">{log.summary}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 tabular-nums">
                        <span
                          className={
                            log.status >= 200 && log.status < 300
                              ? "text-emerald-700 font-semibold"
                              : "text-red-600 font-semibold"
                          }
                        >
                          HTTP {log.status}
                        </span>
                        <span className="text-slate-400">{log.timestamp}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </main>
      ) : (
        /* API & Supabase Architecture Reference Tab */
        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-8">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Supabase Connection File (src/supabaseClient.js)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configured with SUPABASE_URL and SUPABASE_PUBLIC_KEY and exported as a single client instance.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopySnippet}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? "Copied" : "Copy Code"}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed">
              {supabaseSnippet}
            </pre>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">
              Unified Full-Stack Endpoint Specification
            </h2>
            <p className="text-xs text-slate-500">
              All note endpoints enforce Bearer JWT route guarding to isolate each user&apos;s notes.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-4 font-semibold">Method &amp; Route</th>
                    <th className="py-2.5 px-4 font-semibold">Auth Guard</th>
                    <th className="py-2.5 pl-4 font-semibold">Contract &amp; Behavior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="py-3 pr-4 font-mono font-semibold text-slate-900">POST /signup</td>
                    <td className="py-3 px-4">Public</td>
                    <td className="py-3 pl-4">
                      Accepts Full Name, Email, and Password. Validates fields, creates user, and returns session: null so user verifies and logs in on /login with pre-filled email.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono font-semibold text-slate-900">POST /login</td>
                    <td className="py-3 px-4">Public</td>
                    <td className="py-3 pl-4">
                      Accepts Email and Password, yielding a signed HMAC-SHA256 JWT access token.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono font-semibold text-slate-900">POST /notes</td>
                    <td className="py-3 px-4 font-mono text-emerald-700">Bearer Token</td>
                    <td className="py-3 pl-4">
                      Creates a new note with title, main content string, and tags array scoped to req.user.id.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono font-semibold text-slate-900">
                      GET /notes &amp; GET /notes/&#123;id&#125;
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-700">Bearer Token</td>
                    <td className="py-3 pl-4">
                      Fetches all notes or a single note belonging strictly to the authenticated user.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono font-semibold text-slate-900">PUT /notes/&#123;id&#125;</td>
                    <td className="py-3 px-4 font-mono text-emerald-700">Bearer Token</td>
                    <td className="py-3 pl-4">
                      Modifies note title, text content, or tag array properties with ownership verification.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono font-semibold text-slate-900">DELETE /notes/&#123;id&#125;</td>
                    <td className="py-3 px-4 font-mono text-emerald-700">Bearer Token</td>
                    <td className="py-3 pl-4">
                      Permanently removes the note belonging to the authenticated user.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
