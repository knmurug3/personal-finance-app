"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowUp, MessageCircle, RotateCcw, KeyRound } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

const SUGGESTIONS = [
  "How much did I spend on food last month?",
  "Am I on track with my budgets this month?",
  "What are my biggest recurring bills?",
  "How are my investments doing?",
  "How has my net worth changed recently?",
  "What were my largest purchases this month?",
];

/** Minimal, injection-safe rendering of the assistant's light markdown (bold, bullets, paragraphs). */
function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>
    );
  return (
    <div className="space-y-2.5">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (lines.length && lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
          return (
            <ul key={i} className="space-y-1 pl-1">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-label-3 select-none">•</span>
                  <span>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""))}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {inline(block.replace(/^#+\s*/gm, ""))}
          </p>
        );
      })}
    </div>
  );
}

export function AskView({ initialQuestion, onConsumeInitial }: { initialQuestion?: string | null; onConsumeInitial?: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/chat")
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((d) => setConfigured(Boolean(d.configured)))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const history: Msg[] = [...messages.filter((m) => !m.error), { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setBusy(true);
    setStatus("Thinking");

    const update = (fn: (prev: string) => string, error = false) =>
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        next[next.length - 1] = { ...last, content: fn(last.content), error: error || last.error };
        return next;
      });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        if (body.error === "not_configured") setConfigured(false);
        update(() => body.error && body.error !== "not_configured" ? body.error : "Ask isn't available right now.", true);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "text") {
            setStatus(null);
            update((prev) => prev + ev.text);
          } else if (ev.type === "status") {
            setStatus(ev.text);
          } else if (ev.type === "break") {
            update((prev) => (prev && !prev.endsWith("\n\n") ? prev + "\n\n" : prev));
          } else if (ev.type === "error") {
            update((prev) => (prev ? `${prev}\n\n${ev.text}` : ev.text), true);
          }
        }
      }
    } catch {
      update((prev) => prev || "Connection lost. Please try again.", true);
    } finally {
      setBusy(false);
      setStatus(null);
      inputRef.current?.focus();
    }
  };

  // Questions handed over from elsewhere (e.g. Overview suggestion chips)
  useEffect(() => {
    if (initialQuestion && configured) {
      ask(initialQuestion);
      onConsumeInitial?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, configured]);

  if (configured === false) {
    return (
      <div className="card p-8 sm:p-10 text-center max-w-xl mx-auto">
        <span className="w-14 h-14 rounded-full bg-sys-blue/15 flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-7 h-7 text-sys-blue" />
        </span>
        <h3 className="text-[20px] font-semibold">Turn on Ask</h3>
        <p className="text-[15px] text-label-2 mt-1.5">
          Ask answers questions about your money using Claude. Add an Anthropic API key as{" "}
          <code className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[13px]">ANTHROPIC_API_KEY</code> in your Vercel project
          settings, then redeploy.
        </p>
      </div>
    );
  }

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-280px)]">
      {empty ? (
        <div className="card p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-full bg-sys-blue/15 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-sys-blue" />
            </span>
            <div>
              <h3 className="text-[20px] font-semibold tracking-tight">Ask about your money</h3>
              <p className="text-[14px] text-label-2">Answers come from your real accounts, budgets and investments.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                disabled={busy || configured === null}
                className="rounded-full bg-white/[0.07] hover:bg-white/[0.11] px-3.5 py-2 text-[14px] text-left transition active:scale-[0.97] disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4" aria-live="polite">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-[20px] rounded-br-md bg-sys-blue text-[#fff] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <div
                  className={`max-w-[92%] rounded-[20px] rounded-bl-md px-4 py-3 text-[15px] leading-relaxed ${
                    m.error ? "bg-sys-red/12 text-white" : "bg-surface shadow-card"
                  }`}
                >
                  {m.content ? (
                    <RichText text={m.content} />
                  ) : (
                    <span className="flex items-center gap-2 text-label-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-sys-blue/30 border-t-sys-blue animate-spin" />
                      {status ?? "Thinking"}…
                    </span>
                  )}
                  {m.content && busy && i === messages.length - 1 && status && (
                    <span className="mt-2 flex items-center gap-2 text-[13px] text-label-2">
                      <span className="w-3 h-3 rounded-full border-2 border-sys-blue/30 border-t-sys-blue animate-spin" />
                      {status}…
                    </span>
                  )}
                </div>
              </div>
            )
          )}
          <div ref={endRef} />
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] md:bottom-6 mt-6 z-20"
      >
        <div className="liquid-glass lens rounded-[26px] p-1.5 pl-4 flex items-end gap-2">
          <label htmlFor="ask-input" className="sr-only">
            Ask about your money
          </label>
          <textarea
            id="ask-input"
            ref={inputRef}
            rows={1}
            value={input}
            maxLength={2000}
            onChange={(e) => {
              setInput(e.target.value);
              // Grow with the text, up to max-h-40
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder={busy ? "Answering…" : "Ask about your money…"}
            className="flex-1 resize-none bg-transparent py-2 text-[16px] leading-6 max-h-40 placeholder:text-label-3 !shadow-none !border-0"
          />
          {!empty && !busy && (
            <button
              type="button"
              onClick={() => setMessages([])}
              aria-label="New conversation"
              title="New conversation"
              className="w-9 h-9 rounded-full flex items-center justify-center glass-button text-label-2 shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-sys-blue text-[#fff] shrink-0 transition active:scale-90 disabled:opacity-35"
          >
            <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-label-3">
          Answers use Claude and may be imperfect. Check important numbers in the app.
        </p>
      </form>
    </div>
  );
}
