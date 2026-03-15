"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles, User, Bot, Loader2 } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your **UofT AI Course Copilot**. I know everything about the Arts & Science calendar, course prerequisites, and official academic rules. \n\nHow can I help you plan your degree today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function sendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "No response received." }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I'm sorry, I'm having trouble connecting to my brain right now. Please make sure the backend server is running!" },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative bg-[#030712] text-white flex flex-col font-sans selection:bg-blue-500/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full animate-blob animation-delay-2000" />
      </div>

      <header className="relative z-20 glass border-b border-white/10 backdrop-blur-xl shrink-0">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-all">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg">U</div>
            <span className="font-black text-xl tracking-tighter">CO<span className="text-blue-500">PILOT</span></span>
          </Link>
          <div className="flex gap-4">
            <Link href="/timetable" className="rounded-xl px-4 py-2 text-sm font-black bg-white/5 hover:bg-white/10 border border-white/10 transition-all">Timetable</Link>
            <Link href="/generate" className="rounded-xl px-4 py-2 text-sm font-black bg-white/5 hover:bg-white/10 border border-white/10 transition-all">⚡ Generator</Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 overflow-hidden flex flex-col mx-auto w-full max-w-5xl">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-8 space-y-8 scroll-smooth">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`flex gap-4 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                  m.role === "user" ? "bg-white/10 border border-white/10 text-white" : "bg-blue-600 border border-blue-400/30 text-white"
                }`}>
                  {m.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>

                <div className={`max-w-[80%] rounded-3xl px-6 py-4 shadow-2xl backdrop-blur-xl border ${
                  m.role === "user" 
                    ? "bg-white/5 border-white/10 text-white/90 rounded-tr-none" 
                    : "bg-blue-600/10 border-blue-500/20 text-white/90 rounded-tl-none"
                }`}>
                  <div className="prose prose-invert prose-sm max-w-none font-medium leading-relaxed">
                    <ReactMarkdown>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
                <Bot className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1.5 px-6 py-4 rounded-3xl bg-blue-600/5 border border-blue-500/10">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
              </div>
            </motion.div>
          )}
        </div>

        <div className="p-4 md:p-8 shrink-0">
          <form onSubmit={sendMessage} className="relative group">
            <div className="absolute inset-0 bg-blue-500/20 blur-2xl group-hover:bg-blue-500/30 transition-all rounded-[32px] pointer-events-none" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about MAT223, breadth requirements, or degree plans..."
              className="relative w-full rounded-[32px] glass-dark border border-white/10 px-8 py-6 text-sm font-bold placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 transition-all pr-20"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-3 top-3 bottom-3 w-14 rounded-2xl bg-blue-600 flex items-center justify-center hover:bg-blue-500 transition-all disabled:opacity-30 shadow-lg"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </form>
          <p className="text-center mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
            AI can make mistakes. Verify important academic rules.
          </p>
        </div>
      </main>
    </div>
  );
}
