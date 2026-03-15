"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Sparkles, ArrowLeft, Loader2, CheckCircle2, AlertCircle, Sun, Moon, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────

interface Suggestion { course_code: string; title: string; }

interface ScheduleEntry {
  course_code: string; title: string; term: string;
  section_code: string; type: string; instructors: string[];
  meetings: { day: string; start_time: string; end_time: string; location: string }[];
  availability: { enrolled: number; capacity: number };
  waitlist_count: number; delivery_mode: string;
}

interface Warning { type: string; section: string; message: string; }

interface GeneratedSchedule {
  fall: ScheduleEntry[]; winter: ScheduleEntry[];
  score: number; fall_warnings: Warning[]; winter_warnings: Warning[];
}

interface ScheduleResult {
  schedules: GeneratedSchedule[]; total_valid: number; errors: string[];
  summary: { fall_courses: string[]; winter_courses: string[]; year_courses: string[]; };
}

// ── Helpers ───────────────────────────────────────────────────────────────

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function timeToMinutes(t: string): number | null {
  if (!t || t === "TBA") return null;
  const m = t.match(/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10), min = parseInt(m[2], 10), ampm = m[3].toUpperCase();
  if (ampm === "AM" && hour === 12) hour = 0; else if (ampm === "PM" && hour !== 12) hour += 12;
  return hour * 60 + min;
}

function typeColor(type: string): string {
  if (type === "LEC") return "bg-blue-500";
  if (type === "TUT") return "bg-emerald-500";
  if (type === "PRA") return "bg-amber-500";
  return "bg-gray-400";
}

function typeBadge(type: string): string {
  if (type === "LEC") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  if (type === "TUT") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (type === "PRA") return "bg-amber-500/20 text-amber-300 border-amber-500/30";
  return "bg-white/10 text-white/40 border-white/10";
}

function termBadge(term: string): string {
  if (term === "F") return "bg-orange-500/20 text-orange-300 border-orange-500/30";
  if (term === "S") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  if (term === "Y") return "bg-purple-500/20 text-purple-300 border-purple-500/30";
  return "bg-white/10 text-white/40 border-white/10";
}

// ── Mini Calendar ─────────────────────────────────────────────────────────

function MiniCalendar({ entries, label, accentColor }: { entries: ScheduleEntry[]; label: string; accentColor: string }) {
  const START_HOUR = 8, END_HOUR = 21, HOUR_HEIGHT = 32;
  const blocks = entries.flatMap((entry) =>
    entry.meetings.filter((m) => m.day && m.start_time && m.end_time).map((m) => {
      const start = timeToMinutes(m.start_time), end = timeToMinutes(m.end_time), dayIdx = DAYS.indexOf(m.day);
      if (start === null || end === null || dayIdx < 0) return null;
      return { entry, start, end, dayIdx };
    }).filter(Boolean) as { entry: ScheduleEntry; start: number; end: number; dayIdx: number }[]
  );

  return (
    <div className="glass-card rounded-[24px] overflow-hidden flex flex-col">
      <div className={`px-4 py-2 border-b border-white/10 text-[10px] font-black uppercase tracking-widest text-center ${accentColor} text-white/90`}>{label}</div>
      <div className="flex-1 bg-black/20 p-2">
        <div className="grid grid-cols-[32px_repeat(5,1fr)] h-full relative" style={{ minHeight: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
          {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => (
            <div key={i} className="absolute left-0 right-0 border-t border-white/5 text-[8px] text-white/20 font-black" style={{ top: i * HOUR_HEIGHT }}>
              <div className="-translate-y-2 px-1">{START_HOUR + i}</div>
            </div>
          ))}
          {/* Day lines */}
          <div className="absolute inset-0 grid grid-cols-[32px_repeat(5,1fr)] pointer-events-none">
            <div className="border-r border-white/5" />
            {[...Array(5)].map((_, i) => <div key={i} className="border-r border-white/5 last:border-r-0" />)}
          </div>
          {blocks.map((b, idx) => {
            const top = ((b.start - START_HOUR * 60) / 60) * HOUR_HEIGHT, height = ((b.end - b.start) / 60) * HOUR_HEIGHT;
            const left = `calc(32px + ${b.dayIdx} * (100% - 32px) / 5)`;
            return (
              <div key={idx} className={`absolute rounded-lg ${typeColor(b.entry.type)} shadow-lg shadow-black/40 text-white text-[7px] font-black px-1 py-1 overflow-hidden backdrop-blur-md border border-white/10 ring-1 ring-black/20`}
                style={{ top, height: Math.max(height, 12), left, width: `calc((100% - 32px) / 5 - 2px)` }}>
                <div className="truncate leading-none">{b.entry.course_code.replace(/H1[FSY]?$/, "")}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Section List ──────────────────────────────────────────────────────────

function SectionList({ entries, warnings }: { entries: ScheduleEntry[]; warnings: Warning[]; }) {
  if (entries.length === 0) return null;
  return (
    <div className="space-y-2">
      {entries.map((entry, i) => {
        const { enrolled, capacity } = entry.availability, isFull = capacity > 0 && enrolled >= capacity;
        return (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/[0.08]">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-[10px] font-black text-blue-400 bg-blue-500/10 rounded-lg px-2 py-0.5 border border-blue-500/20">{entry.course_code}</span>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-black border tracking-wider uppercase ${typeBadge(entry.type)}`}>{entry.section_code}</span>
              {isFull && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-black text-red-400 border border-red-500/20 uppercase tracking-wider">Full</span>}
            </div>
            <p className="text-[11px] text-white/70 font-bold mb-2 leading-tight">{entry.title}</p>
            <div className="mb-2">
              <div className="flex justify-between text-[9px] text-white/30 mb-1 font-black uppercase tracking-[0.1em]">
                <span>Enrollment</span>
                <span>{enrolled}/{capacity}{entry.waitlist_count > 0 && <span className="ml-1 text-orange-400">(+{entry.waitlist_count} wl)</span>}</span>
              </div>
              <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
                <div className={`h-full rounded-full ${isFull ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${(enrolled / capacity) * 100}%` }} />
              </div>
            </div>
            <div className="space-y-0.5">
              {entry.meetings.map((m, j) => (
                <div key={j} className="flex items-center gap-2 text-[10px] text-white/40 font-medium">
                  <span className="w-16 font-black text-white/60">{m.day}</span>
                  <span>{m.start_time}–{m.end_time}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {warnings.map((w, i) => (
        <div key={i} className={`rounded-xl px-4 py-3 text-[10px] font-bold border flex items-center gap-2 ${w.type === "full" ? "bg-red-500/10 border-red-500/20 text-red-300" : w.type === "cancelled" ? "bg-gray-500/10 border-gray-500/20 text-gray-400" : "bg-yellow-500/10 border-yellow-500/20 text-yellow-300"}`}>
          <AlertCircle className="w-3 h-3" /> {w.message}
        </div>
      ))}
    </div>
  );
}

// ── Main Generate Page ────────────────────────────────────────────────────

export default function GeneratePage() {
  const router = useRouter();
  const [wishlist, setWishlist] = useState<{ code: string; title: string }[]>([]);
  const [courseInput, setCourseInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]), [showDrop, setShowDrop] = useState(false);
  const [result, setResult] = useState<ScheduleResult | null>(null), [generating, setGenerating] = useState(false), [applying, setApplying] = useState(false);
  const [activeSchedule, setActiveSchedule] = useState(0);
  const [timePreference, setTimePreference] = useState<'early' | 'balanced' | 'late'>('balanced');

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setShowDrop(false); return; }
    try {
      const res = await fetch(`/api/suggestions?q=${encodeURIComponent(q)}`);
      setSuggestions(await res.json()); setShowDrop(true);
    } catch {}
  }, []);

  const generateSchedules = async () => {
    if (wishlist.length === 0) return;
    setGenerating(true); setResult(null); setActiveSchedule(0);
    try {
      const res = await fetch("http://localhost:8000/api/schedule/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_codes: wishlist.map((w) => w.code), max_schedules: 5, time_preference: timePreference }),
      });
      setResult((await res.json()) as ScheduleResult);
    } catch {
      setResult({ schedules: [], total_valid: 0, errors: ["Connection error"], summary: { fall_courses: [], winter_courses: [], year_courses: [] } });
    } finally { setGenerating(false); }
  };

  const applySchedule = async (schedule: GeneratedSchedule) => {
    setApplying(true);
    try {
      // Clear existing first
      await fetch("/api/timetable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear" }) });
      // Group all sections by course_code so we send ONE request per course
      // with all section types (lec, tut, pra) specified together.
      // This prevents the API from filling in unwanted defaults.
      const allEntries = [...new Map([...schedule.fall, ...schedule.winter].map(item => [item.course_code + item.section_code, item])).values()];
      const byCourse: Record<string, { course_code: string; term: string; lec?: string; tut?: string; pra?: string }> = {};
      for (const e of allEntries) {
        if (!byCourse[e.course_code]) {
          byCourse[e.course_code] = { course_code: e.course_code, term: e.term };
        }
        if (e.type === "LEC") byCourse[e.course_code].lec = e.section_code;
        else if (e.type === "TUT") byCourse[e.course_code].tut = e.section_code;
        else if (e.type === "PRA") byCourse[e.course_code].pra = e.section_code;
      }
      for (const entry of Object.values(byCourse)) {
        const sections: any = {};
        if (entry.lec) sections.lec = entry.lec;
        if (entry.tut) sections.tut = entry.tut;
        if (entry.pra) sections.pra = entry.pra;
        await fetch("/api/timetable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", course_code: entry.course_code, session: entry.term === "F" ? "20259" : "20261", sections }) });
      }
      router.push("/timetable");
    } catch {} finally { setApplying(false); }
  };

  const schedule = result?.schedules?.[activeSchedule] ?? null;

  return (
    <div className="min-h-screen relative bg-[#030712] text-white overflow-x-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 blur-[150px] rounded-full animate-blob" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full animate-blob animation-delay-4000" />
      </div>

      <header className="sticky top-0 z-30 glass border-b border-white/10 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-all">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg">U</div>
            <span className="font-black text-xl tracking-tighter">CO<span className="text-blue-500">PILOT</span></span>
          </Link>
          <div className="flex gap-4">
            <Link href="/timetable" className="rounded-xl px-4 py-2 text-sm font-black bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center gap-2">Timetable</Link>
            <Link href="/chat" className="rounded-xl px-4 py-2 text-sm font-black bg-white/5 hover:bg-white/10 border border-white/10 transition-all">🤖 Chat</Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-4xl mx-auto mb-12">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 flex items-center gap-4">Auto-Generator <Sparkles className="text-emerald-400 w-8 h-8" /></h1>
          <p className="text-white/40 font-medium text-lg leading-relaxed">Add your courses to the wishlist, and we'll compute the most optimal, conflict-free paths through your degree.</p>
        </div>

        <div className="glass-card rounded-[32px] p-8 mb-12 border border-white/10">
          <label className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-6 block">Course Wishlist</label>
          <div className="relative mb-8">
            <input type="text" value={courseInput} onChange={(e) => { setCourseInput(e.target.value); fetchSuggestions(e.target.value); }} onKeyDown={(e) => { if (e.key === "Escape") setShowDrop(false); }} placeholder="Search courses (MAT223, CSC148)..." className="w-full rounded-2xl bg-white/5 px-6 py-5 text-sm font-bold border border-white/10 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none" autoComplete="off" />
            {showDrop && suggestions.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-[#0f1729] rounded-3xl border border-white/20 shadow-2xl z-50 overflow-hidden py-2 max-h-[300px] overflow-y-auto">{suggestions.map(s => (<button key={s.course_code} className="w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-white/10 transition-all group" onMouseDown={e => { e.preventDefault(); if (!wishlist.find(x=>x.code===s.course_code)) setWishlist(p => [...p, {code:s.course_code, title:s.title}]); setCourseInput(""); setShowDrop(false); }}> <span className="font-mono text-xs font-black bg-emerald-500/20 text-emerald-400 rounded px-2 py-1 transition-all group-hover:bg-emerald-500/30">{s.course_code}</span> <span className="text-sm font-bold text-white/80">{s.title}</span></button>))}</div>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mb-8">
            {wishlist.length === 0 ? <p className="text-sm text-white/20 font-bold italic">No courses added yet.</p> : wishlist.map(w => (<div key={w.code} className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-2 group"><span className="font-mono font-black text-emerald-400 text-xs">{w.code}</span><span className="text-white/60 text-[10px] font-bold uppercase tracking-wider max-w-[120px] truncate">{w.title}</span><button onClick={() => setWishlist(p => p.filter(x => x.code !== w.code))} className="text-white/20 hover:text-white transition-colors">✕</button></div>))}
          </div>

          {/* Time Preference Toggle */}
          <div className="mb-8">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-3 block">Schedule Preference</label>
            <div className="grid grid-cols-3 gap-3">
              {([
                { key: 'early' as const, icon: Sun, label: 'Early Bird', desc: '8-10 AM starts' },
                { key: 'balanced' as const, icon: Clock, label: 'Balanced', desc: '10 AM-2 PM zone' },
                { key: 'late' as const, icon: Moon, label: 'Night Owl', desc: 'Afternoon starts' },
              ]).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setTimePreference(opt.key)}
                  className={`rounded-2xl p-4 text-left transition-all border ${
                    timePreference === opt.key
                      ? 'bg-emerald-500/20 border-emerald-500/40 ring-1 ring-emerald-500/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <opt.icon className={`w-5 h-5 mb-2 ${timePreference === opt.key ? 'text-emerald-400' : 'text-white/30'}`} />
                  <div className={`text-xs font-black ${timePreference === opt.key ? 'text-emerald-400' : 'text-white/60'}`}>{opt.label}</div>
                  <div className="text-[9px] text-white/30 font-bold mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={generateSchedules} disabled={wishlist.length === 0 || generating} className="w-full rounded-3xl bg-emerald-600 px-10 py-5 text-sm font-black uppercase tracking-widest text-white shadow-2xl shadow-emerald-500/20 hover:bg-emerald-500 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-3">
            {generating ? <><Loader2 className="w-5 h-5 animate-spin" /> Computing Paths...</> : <><Sparkles className="w-5 h-5" /> Generate Conflict-Free Routes</>}
          </button>
        </div>

        {result && result.errors.map((err, i) => <div key={i} className="mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 px-6 py-4 text-xs font-bold text-red-300 flex items-center gap-3"><AlertCircle className="w-4 h-4" /> {err}</div>)}

        {result && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="flex items-center justify-between">
              <div><h2 className="text-2xl font-black mb-1">{result.total_valid} Optimal Solutions</h2><p className="text-xs text-white/40 font-bold uppercase tracking-wider">Ranked by enrollment availability</p></div>
              <div className="flex gap-2">
                {result.schedules.map((_, i) => (<button key={i} onClick={() => setActiveSchedule(i)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSchedule === i ? "bg-white text-black shadow-xl" : "bg-white/5 border border-white/10 text-white/40 hover:bg-white/10"}`}>Option {i + 1}</button>))}
              </div>
            </div>

            {schedule && (
              <div className="grid gap-12">
                <div className="grid md:grid-cols-2 gap-8 h-[500px]">
                  <MiniCalendar entries={schedule.fall} label="🍂 Fall Semester" accentColor="bg-orange-600" />
                  <MiniCalendar entries={schedule.winter} label="❄️ Winter Semester" accentColor="bg-blue-600" />
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">🍂 Fall Sections</h3>
                    <SectionList entries={schedule.fall} warnings={schedule.fall_warnings} />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">❄️ Winter Sections</h3>
                    <SectionList entries={schedule.winter} warnings={schedule.winter_warnings} />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-6 pt-12 border-t border-white/10">
                  <div className="text-center group"><div className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-1">Schedule Score</div><div className="text-3xl font-black tracking-tighter group-hover:text-emerald-400 transition-colors">{schedule.score}</div></div>
                  <button onClick={() => applySchedule(schedule)} disabled={applying} className="group relative rounded-[32px] bg-blue-600 px-12 py-6 text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/40 hover:bg-blue-500 hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                    {applying ? <><Loader2 className="w-5 h-5 animate-spin mx-auto" /></> : <><div className="flex items-center gap-3">Apply Sections to Timetable <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" /></div></>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
