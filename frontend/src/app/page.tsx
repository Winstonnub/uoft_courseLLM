"use client";

import Link from "next/link";
import { MoveRight, Calendar, Sparkles, MessageSquare } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="min-h-screen relative bg-[#030712] text-white selection:bg-blue-500/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full animate-blob animation-delay-2000" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-indigo-600/10 blur-[100px] rounded-full animate-blob animation-delay-4000" />
      </div>

      <nav className="relative z-20 border-b border-white/10 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-xl shadow-xl shadow-blue-500/20 ring-1 ring-white/20">U</div>
            <span className="font-black text-2xl tracking-tighter">CO<span className="text-blue-500">PILOT</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-bold text-white/60">
            <Link href="/timetable" className="hover:text-white transition-colors">Timetable</Link>
            <Link href="/generate" className="hover:text-white transition-colors">Generator</Link>
            <Link href="/chat" className="hover:text-white transition-colors">Copilot</Link>
          </div>
          <Link href="/timetable" className="rounded-2xl bg-white text-black px-6 py-2.5 text-sm font-black hover:bg-white/90 transition-all shadow-xl shadow-white/5">
            Get Started
          </Link>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        {/* Hero Section */}
        <div className="text-center mb-24">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-blue-400 text-xs font-black uppercase tracking-widest mb-8 animate-fade-in">
            <Sparkles className="w-3 h-3" />
            Empowering UofT Students
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-8 leading-[0.9]">
            The Future of <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">Course Planning</span>
          </h1>
          <p className="max-w-2xl mx-auto text-white/50 text-xl font-medium leading-relaxed mb-12">
            Experience the most advanced course management system ever built for UofT. 
            AI-powered advice, conflict-free scheduling, and real-time data at your fingertips.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href="/timetable" className="group w-full sm:w-auto rounded-3xl bg-blue-600 px-10 py-5 text-lg font-black flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-2xl shadow-blue-500/20 hover:scale-105 active:scale-95">
              Launch Planner
              <MoveRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/chat" className="w-full sm:w-auto rounded-3xl bg-white/5 border border-white/10 px-10 py-5 text-lg font-black hover:bg-white/10 transition-all backdrop-blur-xl">
              Talk to AI
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          <Link href="/timetable" className="group glass-card p-10 rounded-[32px] block">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-8 ring-1 ring-blue-500/20 group-hover:scale-110 transition-transform">
              <Calendar className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-black mb-4">Timetable Editor</h3>
            <p className="text-white/40 font-medium leading-relaxed">
              Drag-and-drop course management with instant conflict detection and real-time enrolment tracking.
            </p>
          </Link>

          <Link href="/generate" className="group glass-card p-10 rounded-[32px] block">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-8 ring-1 ring-emerald-500/20 group-hover:scale-110 transition-transform">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-black mb-4">Auto-Generator</h3>
            <p className="text-white/40 font-medium leading-relaxed">
              Just pick your wishlist. We&apos;ll find the perfect, conflict-free schedule ranked by seat availability across all terms.
            </p>
          </Link>

          <Link href="/chat" className="group glass-card p-10 rounded-[32px] block">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-8 ring-1 ring-purple-500/20 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-black mb-4">AI Academic Advisor</h3>
            <p className="text-white/40 font-medium leading-relaxed">
              Our LLM knows the official Arts & Science calendar by heart. Ask about prerequisites, breadth, or program planning.
            </p>
          </Link>
        </div>

        {/* Stats Section */}
        <div className="mt-40 grid grid-cols-2 md:grid-cols-4 gap-8 py-20 border-y border-white/10 bg-white/[0.02] rounded-[40px] px-10">
          <div className="text-center">
            <div className="text-4xl font-black text-white mb-2 tracking-tighter">3,800+</div>
            <div className="text-[10px] uppercase font-black tracking-[0.2em] text-white/30">Live Courses</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-black text-white mb-2 tracking-tighter">Real-Time</div>
            <div className="text-[10px] uppercase font-black tracking-[0.2em] text-white/30">Enrolment Data</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-black text-white mb-2 tracking-tighter">AI-Driven</div>
            <div className="text-[10px] uppercase font-black tracking-[0.2em] text-white/30">Degree Insight</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-black text-white mb-2 tracking-tighter">0 Conflicts</div>
            <div className="text-[10px] uppercase font-black tracking-[0.2em] text-white/30">Guaranteed Logic</div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-500/20">U</div>
            <span className="font-black text-xl tracking-tighter">CO<span className="text-blue-500">PILOT</span></span>
          </div>
          <p className="text-white/30 text-xs font-black uppercase tracking-widest">
            Made with ❤️ for the UofT Community
          </p>
        </div>
      </footer>
    </div>
  );
}
