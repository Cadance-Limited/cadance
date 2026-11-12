"use client";

import * as React from "react";
import {
  Building2,
  FileText,
  Loader2,
  LogOut,
  MessageSquare,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { notifyWorkspaceUpdated, onWorkspaceUpdated } from "@/lib/prompt-bus";
import { cn } from "@/lib/utils";

type UserInfo = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

type WorkspaceInfo = {
  id: string;
  name: string;
  slug: string;
  plan: string;
};

type SavedRun = {
  id: string;
  runType: string;
  docType: string;
  sourceTitle: string;
  mode: string;
  summary: string;
  createdAt: string;
};

type AuditEntry = {
  id: string;
  action: string;
  requestId: string | null;
  createdAt: string;
};

export function WorkspaceModal({
  open,
  onOpenChange,
  onSessionChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSessionChange?: (user: UserInfo | null, workspace: WorkspaceInfo | null) => void;
}) {
  const [authMode, setAuthMode] = React.useState<"login" | "register">("login");
  const [loading, setLoading] = React.useState(false);
  const [user, setUser] = React.useState<UserInfo | null>(null);
  const [workspace, setWorkspace] = React.useState<WorkspaceInfo | null>(null);
  const [runs, setRuns] = React.useState<SavedRun[]>([]);
  const [auditLogs, setAuditLogs] = React.useState<AuditEntry[]>([]);
  const [tab, setTab] = React.useState<"runs" | "audit">("runs");

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [workspaceName, setWorkspaceName] = React.useState("");
  const { toast } = useToast();

  const fetchSessionAndRuns = React.useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const data = await res.json();
      if (data?.ok && data.authenticated) {
        setUser(data.user);
        setWorkspace(data.workspace);
        onSessionChange?.(data.user, data.workspace);

        const runsRes = await fetch("/api/workspace/runs", { cache: "no-store" });
        const runsData = await runsRes.json();
        if (runsData?.ok) {
          setRuns(runsData.runs ?? []);
          setAuditLogs(runsData.auditLogs ?? []);
        }
      } else {
        setUser(null);
        setWorkspace(null);
        setRuns([]);
        setAuditLogs([]);
        onSessionChange?.(null, null);
      }
    } catch {
      /* ignore */
    }
  }, [onSessionChange]);

  React.useEffect(() => {
    fetchSessionAndRuns();
    return onWorkspaceUpdated(() => {
      fetchSessionAndRuns();
    });
  }, [fetchSessionAndRuns]);

  React.useEffect(() => {
    if (open) {
      fetchSessionAndRuns();
    }
  }, [open, fetchSessionAndRuns]);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: authMode,
          email: email.trim(),
          password,
          name: name.trim() || undefined,
          workspaceName: workspaceName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || "Authentication failed");
      }
      setPassword("");
      await fetchSessionAndRuns();
      notifyWorkspaceUpdated();
      toast({
        title: authMode === "register" ? "Workspace created" : "Signed in",
        description: `Connected to ${data.workspace?.name || "your workspace"}.`,
      });
    } catch (err) {
      toast({
        title: "Authentication failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      setUser(null);
      setWorkspace(null);
      setRuns([]);
      setAuditLogs([]);
      onSessionChange?.(null, null);
      notifyWorkspaceUpdated();
      toast({
        title: "Signed out",
        description: "Your workspace session has been closed.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function deleteRun(runId: string) {
    try {
      const res = await fetch("/api/workspace/runs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      const data = await res.json();
      if (data?.ok) {
        setRuns((prev) => prev.filter((r) => r.id !== runId));
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 border-border bg-background p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Building2 className="h-4 w-4 text-cadence" />
            {workspace ? workspace.name : "Cadence Workspace"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {workspace
              ? `Signed in as ${user?.email} (${user?.role}). Diagnostic runs and document analyses are automatically saved to your workspace.`
              : "Sign in or create a workspace to persist your diagnostic chat sessions, document analyses, and audit logs."}
          </DialogDescription>
        </DialogHeader>

        {workspace && user ? (
          <div className="flex flex-col">
            <div className="flex items-center justify-between border-b border-border bg-secondary/20 px-6 py-2.5">
              <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTab("runs")}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-colors",
                    tab === "runs"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Saved Runs ({runs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTab("audit")}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-colors",
                    tab === "audit"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Audit Log ({auditLogs.length})
                </button>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogOut className="h-3 w-3" />
                Sign out
              </button>
            </div>

            <div className="scrollbar-cadence max-h-[340px] overflow-y-auto p-4">
              {tab === "runs" ? (
                runs.length === 0 ? (
                  <div className="py-10 text-center text-xs text-muted-foreground">
                    No saved runs yet. Run a diagnostic chat or document analysis in the demo and it will appear here automatically.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {runs.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {r.runType === "CHAT" ? (
                              <MessageSquare className="h-3.5 w-3.5 text-cadence" />
                            ) : (
                              <FileText className="h-3.5 w-3.5 text-cadence" />
                            )}
                            <span className="truncate text-xs font-semibold text-foreground">
                              {r.sourceTitle}
                            </span>
                            <span className="rounded border border-border bg-secondary/40 px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                              {r.docType}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {r.summary}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteRun(r.id)}
                          aria-label="Delete saved run"
                          className="text-muted-foreground/60 transition-colors hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : auditLogs.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  No audit events recorded yet.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {auditLogs.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-cadence" />
                        <span className="font-mono text-foreground">{a.action}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(a.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3 p-6">
            <div className="mb-1 inline-flex w-fit rounded-lg border border-border bg-secondary/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={cn(
                  "rounded-md px-3 py-1 font-medium transition-colors",
                  authMode === "login"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("register")}
                className={cn(
                  "rounded-md px-3 py-1 font-medium transition-colors",
                  authMode === "register"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Create workspace
              </button>
            </div>

            {authMode === "register" ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Your name
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Workspace name
                  </span>
                  <input
                    type="text"
                    required
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="Acme Ops"
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
                  />
                </label>
              </div>
            ) : null}

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Work email
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Password (min. 8 chars)
              </span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="shimmer-border mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-all hover:translate-y-[-1px] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : authMode === "register" ? (
                "Create workspace"
              ) : (
                "Sign in to workspace"
              )}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
