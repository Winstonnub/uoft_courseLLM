"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, User, Send, ExternalLink, Loader2, Info } from "lucide-react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your UofT AI Course Copilot. I know everything about the Arts & Science calendar, course prerequisites, and official academic rules. How can I help you plan your degree today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    
    // Add user message to UI immediately
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        }),
      });

      if (!res.ok) throw new Error("Failed to fetch response");
      const data = await res.json();
      
      setMessages([...newMessages, { 
        role: "assistant", 
        content: data.reply,
        sources: data.sources
      }]);
    } catch (error) {
      setMessages([...newMessages, { role: "assistant", content: "Sorry, I'm having trouble connecting to my backend right now." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#f9fafc]">
      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-[#002A5C] shadow-lg shrink-0">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white font-black text-sm">U</div>
              <span className="text-white font-bold text-base tracking-tight">UofT Course Explorer</span>
            </Link>
          </div>
          <div className="flex gap-4 items-center">
            <Link href="/" className="text-white/70 hover:text-white text-sm font-medium transition">Catalog</Link>
            <div className="px-3 py-1 rounded-full border border-white/20 bg-white/10 text-white text-sm font-semibold">
              <Bot className="w-4 h-4 inline-block mr-1.5 -translate-y-px" />
              Copilot
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((message, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-4 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
                  message.role === "assistant" 
                    ? "bg-[#002A5C] text-white" 
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {message.role === "assistant" ? <Bot size={18} /> : <User size={18} />}
                </div>

                {/* Message Bubble */}
                <div className={`flex flex-col gap-2 max-w-[85%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm ${
                    message.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : "bg-white border border-gray-100 text-gray-800 rounded-tl-none prose prose-p:leading-relaxed prose-pre:bg-gray-50 prose-pre:text-gray-800 prose-a:text-blue-600"
                  }`}>
                    {message.role === "user" ? (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    ) : (
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    )}
                  </div>
                  
                  {/* Citations/Tags */}
                  {message.sources && message.sources.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      transition={{ delay: 0.4 }}
                      className="flex gap-2 flex-wrap"
                    >
                      {message.sources.map((src, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-xs font-medium text-gray-500 shadow-sm">
                          <Info size={12} className="text-[#002A5C]" />
                          {src}
                        </span>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
            
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4"
              >
                <div className="shrink-0 w-8 h-8 rounded-full bg-[#002A5C] text-white flex items-center justify-center shadow-sm">
                  <Bot size={18} />
                </div>
                <div className="px-5 py-4 rounded-2xl rounded-tl-none bg-white border border-gray-100 shadow-sm flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t border-gray-100 p-4 shrink-0">
        <div className="max-w-3xl mx-auto">
          <form 
            onSubmit={handleSubmit}
            className="relative flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-[#002A5C]/50 focus-within:ring-2 focus-within:ring-[#002A5C]/20 transition-all p-2 shadow-sm"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about a course prerequisite, academic rules, or degree planning..."
              className="flex-1 max-h-32 min-h-[44px] bg-transparent resize-none outline-none py-2 px-3 text-sm text-gray-800 placeholder:text-gray-400"
              rows={1}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="mb-1 mr-1 shrink-0 p-2.5 rounded-xl bg-[#002A5C] text-white hover:bg-[#003875] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="translate-x-[1px]" />}
            </button>
          </form>
          <div className="text-center mt-3">
            <span className="text-[11px] text-gray-400">
              AI Copilot can make mistakes. Verify critical graduation requirements with your registrar.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
