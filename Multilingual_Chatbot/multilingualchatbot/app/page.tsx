"use client";

import { useEffect, useRef, useState } from "react";
import ThemeToggle from "./components/ThemeToggle";

type Role = "user" | "assistant";
type Message = { role: Role; content: string };

const LANGS = [
  "English",
  "Spanish",
  "French",
  "German",
  "Portuguese (Brazil)",
  "Portuguese (Portugal)",
  "Italian",
  "Hindi",
  "Bengali",
  "Chinese (Simplified)",
  "Chinese (Traditional)",
  "Japanese",
  "Korean",
  "Arabic",
  "Hebrew",
  "Turkish",
  "Russian",
  "Indonesian",
  "Thai",
  "Vietnamese",
];

const RTL_LANGS = new Set(["Arabic", "Hebrew", "Persian", "Urdu"]);
const SUGGESTIONS = [
  "Translate 'Good morning' to Japanese.",
  "How do you say 'Where is the train station?' in French?",
  "Write a polite greeting message in Spanish.",
  "Explain a joke in Hindi.",
];

// --- helpers ---
function splitIntoBlocks(text: string) {
  const parts: { type: "text" | "code"; content: string; lang?: string }[] = [];
  const regex = /```([\w+-]*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", content: text.slice(last, m.index) });
    const lang = m[1] || undefined;
    const code = m[2] || "";
    parts.push({ type: "code", content: code.trimEnd(), lang });
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push({ type: "text", content: text.slice(last) });
  return parts;
}

function CopyBtn({ getText, small = false }: { getText: () => string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  return (
    <button
      onClick={onCopy}
      className={`rounded-md border ${
        small ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-xs"
      } border-slate-300 bg-white/90 text-slate-700 shadow-sm hover:border-indigo-400 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200`}
      title="Copy"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function MessageBubble({ role, content }: Message) {
  const isUser = role === "user";
  const blocks = splitIntoBlocks(content);
  const bubbleClasses = isUser
    ? "bg-blue-600 text-white"
    : "bg-white border border-slate-200 text-slate-900 dark:bg-slate-900/70 dark:border-slate-800 dark:text-slate-100";

  return (
    <div className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-semibold select-none">
          AI
        </div>
      )}
      <div className={`relative group max-w-[80%] rounded-2xl px-4 py-3 shadow-sm whitespace-pre-wrap break-words ${bubbleClasses}`}>
        {/* Copy whole message button (shows on hover) */}
        <div className={`absolute right-2 top-2 ${isUser ? "" : "opacity-0 group-hover:opacity-100 transition-opacity"}`}>
          <CopyBtn getText={() => content} small />
        </div>

        {blocks.map((b, i) =>
          b.type === "code" ? (
            <div key={i} className="relative mt-2">
              <pre
                className={`overflow-x-auto rounded-xl border ${
                  isUser ? "border-white/30 bg-white/20" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70"
                } p-3 text-[13px]`}
                title={b.lang ? `Language: ${b.lang}` : "Code"}
              >
                <code>{b.content}</code>
              </pre>
              <div className="absolute right-2 top-2">
                <CopyBtn getText={() => b.content} small />
              </div>
            </div>
          ) : (
            <span key={i}>{b.content}</span>
          )
        )}
      </div>
      {isUser && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-semibold select-none">
          You
        </div>
      )}
    </div>
  );
}

// --- page ---
export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [targetLang, setTargetLang] = useState<string>("French");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const dir = RTL_LANGS.has(targetLang) ? "rtl" : "ltr";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function autoGrowTextarea() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }

  async function sendMessage(e?: React.FormEvent, textOverride?: string) {
    e?.preventDefault();
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    const newHistory = [...messages, { role: "user", content: text } as Message];
    setMessages(newHistory);
    setInput("");
    setLoading(true);
    autoGrowTextarea();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, targetLang, history: newHistory }),
      });

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const body = await res.text();
        throw new Error(`Non-JSON from /api/chat (HTTP ${res.status}). ${body.slice(0, 120)}`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "" }]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Sorry, something went wrong. (${err?.message || "error"})` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950 dark:text-slate-100">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-3 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
              Multilingual Chatbot
            </span>{" "}
            <span className="text-slate-500 dark:text-slate-400">(Ollama)</span>
          </h1>

          <div className="flex items-center gap-2">
            <label htmlFor="lang" className="text-sm text-slate-600 dark:text-slate-300">
              Reply in:
            </label>
            <select
              id="lang"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              title="Target language"
            >
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            <ThemeToggle />

            <button
              className="ml-2 text-sm text-slate-600 hover:text-slate-900 underline dark:text-slate-300 dark:hover:text-white"
              onClick={() => setMessages([])}
              title="Clear conversation"
            >
              Clear
            </button>
          </div>
        </div>
      </header>

      {/* Chat card */}
      <section className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-6">
        <div className="relative rounded-3xl border border-slate-200/70 bg-white/70 backdrop-blur-xl shadow-xl dark:border-slate-800 dark:bg-slate-900/60">
          {/* Messages */}
          <div className="h-[68vh] sm:h-[70vh] overflow-y-auto p-4 sm:p-6" dir={dir}>
            {messages.length === 0 ? (
              <div className="h-full grid place-items-center text-center text-slate-500 dark:text-slate-400">
                <div className="space-y-4">
                  <p className="text-lg font-medium">Start a conversation</p>
                  <p className="text-sm">
                    Type your message below. The bot will reply in your selected language.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(undefined, s)}
                        className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-indigo-400 hover:text-indigo-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        title="Try this prompt"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <ul className="space-y-5">
                {messages.map((m, i) => (
                  <li key={i}>
                    <MessageBubble role={m.role} content={m.content} />
                  </li>
                ))}
                {loading && (
                  <li>
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-semibold">
                        AI
                      </div>
                      <div className="max-w-[80%] rounded-2xl px-4 py-3 shadow-sm bg-white border border-slate-200 text-slate-700 dark:bg-slate-900/70 dark:border-slate-800 dark:text-slate-200">
                        <span className="inline-flex items-center gap-2">
                          Thinking
                          <span className="inline-flex">
                            <span className="mx-0.5 h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"></span>
                            <span className="mx-0.5 h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]"></span>
                            <span className="mx-0.5 h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]"></span>
                          </span>
                        </span>
                      </div>
                    </div>
                  </li>
                )}
                <div ref={bottomRef} />
              </ul>
            )}
          </div>

          {/* Composer */}
          <footer className="sticky bottom-0 rounded-b-3xl border-t border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
            <form onSubmit={(e) => sendMessage(e)} className="px-4 sm:px-6 py-3 flex items-end gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  const ta = textareaRef.current;
                  if (ta) {
                    ta.style.height = "auto";
                    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
                  }
                }}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                className="flex-1 max-h-48 resize-none rounded-xl border border-slate-300 bg-white/90 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="h-10 shrink-0 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-5 text-white shadow-sm transition-opacity disabled:opacity-50"
                title="Send"
              >
                {loading ? "Sending…" : "Send"}
              </button>
            </form>
          </footer>
        </div>
      </section>
    </main>
  );
}