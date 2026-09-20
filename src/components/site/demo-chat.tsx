"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowUp, RotateCcw, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

type Role = "user" | "assistant";
type Message = { role: Role; content: string; pending?: boolean };

const EXAMPLES = [
  "Why did our AP cycle time jump 40% in Q3 — what should we fix first?",
  "Vendor ACME's invoices are 2× higher than last quarter. Diagnose.",
  "Our contract review takes 11 days. Where's the friction?",
  "Three reviewers touch every invoice under $10k. Is that the bottleneck?",
];

const WELCOME: Message = {
  role: "assistant",
  content:
    "I'm Cadence — your operations analyst. Ask me about a bottleneck, an anomaly, or a workflow that feels off. I'll reason through it and hand you the next moves.\n\n*Try one of the prompts below, or write your own.*",
};

export function DemoChat() {
  const [messages, setMessages] = React.useState<Message[]>([WELCOME]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    setError(null);
    setInput("");

    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setLoading(true);
    // optimistic pending assistant placeholder
    setMessages((m) => [...m, { role: "assistant", content: "", pending: true }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Request failed");
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: data.content };
        return copy;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `I hit a wall: **${msg}**. Try again in a moment.`,
        };
        return copy;
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function reset() {
    setMessages([WELCOME]);
    setError(null);
    setInput("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-cadence-pulse rounded-full bg-cadence" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cadence" />
          </span>
          Diagnostic session
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      {/* messages */}
      <div
        ref={scrollRef}
        className="scrollbar-cadence flex-1 space-y-5 overflow-y-auto px-4 py-5"
      >
        {messages.map((m, i) => (
          <ChatBubble key={i} message={m} />
        ))}
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}
      </div>

      {/* example chips when conversation is fresh */}
      {messages.length <= 1 ? (
        <div className="border-t border-border px-4 py-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
            Try a prompt
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => send(ex)}
                disabled={loading}
                className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* composer */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-background/40 p-2 focus-within:border-foreground/30 focus-within:bg-background">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask Cadence what's broken and what to fix…"
            className="scrollbar-cadence max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background transition-all hover:translate-y-[-1px] disabled:translate-y-0 disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-1.5 px-1 text-[11px] text-muted-foreground/50">
          Cadence reasons from what you tell it. It won&apos;t invent numbers it
          doesn&apos;t have.
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[11px] font-semibold",
          isUser
            ? "border-border bg-secondary text-muted-foreground"
            : "border-border bg-foreground text-background",
        )}
      >
        {isUser ? "You" : <Sparkles className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-foreground text-background"
            : "rounded-tl-sm border border-border bg-secondary/40 text-foreground",
        )}
      >
        {message.pending ? (
          <TypingDots />
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <Markdown text={message.content} />
        )}
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
          style={{
            animation: "cadence-blink 1.1s steps(2, start) infinite",
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-cadence">
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h3 className="mt-1 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          code: ({ children }) => (
            <code className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.85em]">
              {children}
            </code>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

