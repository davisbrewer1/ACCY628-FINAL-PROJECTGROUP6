"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Bot, MessageCircle, Send, X } from "lucide-react";
import {
  answerMarketingQuestion,
  createWelcomeMessage,
  type ChatMessage,
} from "@/lib/marketing-chat";

export function MarketingChatAssistant() {
  const panelTitleId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createWelcomeMessage(),
  ]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open, pending]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || pending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setPending(true);

    // Short pause so replies feel conversational.
    window.setTimeout(() => {
      const reply: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: answerMarketingQuestion(question),
      };
      setMessages((prev) => [...prev, reply]);
      setPending(false);
    }, 350);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open ? (
        <section
          aria-labelledby={panelTitleId}
          className="flex h-[min(32rem,calc(100vh-6.5rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-2xl"
        >
          <header className="flex items-start justify-between gap-3 border-b border-base-300 bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-9 items-center justify-center rounded-full bg-blue-500/20 text-teal-200">
                <Bot className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id={panelTitleId} className="text-sm font-semibold">
                  Nexus assistant
                </h2>
                <p className="text-xs text-slate-300">
                  Ask anytime while you browse
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-xs text-white hover:bg-white/10"
              onClick={() => setOpen(false)}
              aria-label="Close chat assistant"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </header>

          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto bg-base-200/50 px-3 py-4"
            aria-live="polite"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === "user"
                      ? "bg-primary text-primary-content"
                      : "border border-base-300 bg-base-100 text-base-content"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {pending ? (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-base-300 bg-base-100 px-3 py-2 text-sm text-base-content/70">
                  Thinking…
                </div>
              </div>
            ) : null}
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-base-300 bg-base-100 p-3"
          >
            <label className="sr-only" htmlFor="marketing-chat-input">
              Ask the Nexus site assistant
            </label>
            <div className="flex items-end gap-2">
              <input
                id="marketing-chat-input"
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="input input-bordered input-sm flex-1"
                placeholder="Ask anything about Nexus…"
                autoComplete="off"
                disabled={pending}
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={pending || !input.trim()}
                aria-label="Send message"
              >
                <Send className="size-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className="btn btn-primary gap-2 shadow-lg"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={undefined}
        aria-label={open ? "Hide site assistant" : "Open site assistant"}
      >
        {open ? (
          <>
            <X className="size-4" aria-hidden="true" />
            Close chat
          </>
        ) : (
          <>
            <MessageCircle className="size-4" aria-hidden="true" />
            Ask Nexus
          </>
        )}
      </button>
    </div>
  );
}
