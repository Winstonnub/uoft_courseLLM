"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Course, Section, Meeting } from "@/types/course";
import Link from "next/link";

// ── Helpers ────────────────────────────────────────────────────────────────

const SESSION_LABELS: Record<string, string> = {
  "": "All Sessions",
  "20259": "Fall 2025",
  "20261": "Winter 2026",
  "20259-20261": "Full Year",
};

function sessionLabel(session: string): string {
  if (!session) return "";
  if (session.includes("20259") && session.includes("20261")) return "F + W";
  if (session.includes("20259")) return "F";
  if (session.includes("20261")) return "W";
  return session;
}

function sessionColor(session: string): string {
  if (session.includes("20259") && session.includes("20261"))
    return "bg-purple-500/20 text-purple-300 border-purple-500/30";
  if (session.includes("20259")) return "bg-orange-500/20 text-orange-300 border-orange-500/30";
  if (session.includes("20261")) return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  return "bg-gray-500/20 text-gray-300 border-gray-500/30";
}

function fillColor(enrolled: number, capacity: number): string {
  if (capacity === 0) return "bg-white/10";
  const pct = enrolled / capacity;
  if (pct >= 1) return "bg-red-500";
  if (pct >= 0.85) return "bg-orange-500";
  return "bg-emerald-500";
}

function typeColor(type: string): string {
  if (type === "LEC") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  if (type === "TUT") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (type === "PRA") return "bg-amber-500/20 text-amber-300 border-amber-500/30";
  return "bg-white/10 text-white/70 border-white/10";
}

function timeToMinutes(t: string): number | null {
  if (!t || t === "TBA") return null;
  const m = t.match(/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === "AM") {
    if (hour === 12) hour = 0;
  } else {
    if (hour !== 12) hour += 12;
  }
  return hour * 60 + min;
}

const DAYS: ReadonlyArray<{ key: "Mon" | "Tue" | "Wed" | "Thu" | "Fri"; label: string }> = [
  { key: "Mon", label: "Monday" },
  { key: "Tue", label: "Tuesday" },
  { key: "Wed", label: "Wednesday" },
  { key: "Thu", label: "Thursday" },
  { key: "Fri", label: "Friday" },
];

function dayKey(day: string): "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | null {
  const d = (day || "").toLowerCase();
  if (d.startsWith("mon")) return "Mon";
  if (d.startsWith("tue")) return "Tue";
  if (d.startsWith("wed")) return "Wed";
  if (d.startsWith("thu")) return "Thu";
  if (d.startsWith("fri")) return "Fri";
  return null;
}

function entryColor(type: string) {
  if (type === "LEC") return "bg-blue-500/20 border-blue-500/40 text-blue-100 shadow-[0_0_15px_-5px_rgba(59,130,246,0.5)]";
  if (type === "TUT") return "bg-emerald-500/20 border-emerald-500/40 text-emerald-100 shadow-[0_0_15px_-5px_rgba(16,185,129,0.5)]";
  if (type === "PRA") return "bg-amber-500/20 border-amber-500/40 text-amber-100 shadow-[0_0_15px_-5px_rgba(245,158,11,0.5)]";
  return "bg-white/10 border-white/20 text-white/90";
}

type CalendarBlock = {
  entry: TimetableEntry;
  meeting: Meeting;
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
  startMin: number;
  endMin: number;
  conflict: boolean;
};

// ── Types ──────────────────────────────────────────────────────────────────

interface Suggestion { course_code: string; title: string; }
interface ApiResponse { items: Course[]; total: number; page: number; totalPages: number; pageSize: number; }

type TimetableEntry = {
  id: string; course_code: string; title: string; session: string;
  section_code: string; type: string; meetings: Meeting[];
};

type Conflict = {
  a: { id: string; course_code: string; section_code: string };
  b: { id: string; course_code: string; section_code: string };
  day: string; start_time: string; end_time: string;
};

type TimetableState = { entries: TimetableEntry[]; conflicts: Conflict[]; warning?: string; error?: string; };

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionCard({ sec, action }: { sec: Section; action?: { label: string; disabled: boolean; onClick: () => void; }; }) {
  const { enrolled, capacity } = sec.availability;
  const fillPct = capacity > 0 ? Math.min(100, (enrolled / capacity) * 100) : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${typeColor(sec.type)}`}>
            {sec.section_code}
          </span>
          {sec.cancelled && (
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300 border border-red-500/30">
              Cancelled
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">{sec.delivery_mode}</span>
          {action && (
            <button
              onClick={action.onClick}
              disabled={action.disabled}
              className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>

      {sec.instructors.length > 0 && (
        <p className="text-sm text-white/60 mb-2 font-medium">👤 {sec.instructors.join(", ")}</p>
      )}

      <div className="mb-2">
        <div className="flex justify-between text-[10px] text-white/40 mb-1 font-bold uppercase tracking-wider">
          <span>Enrolment</span>
          <span>
            {enrolled}/{capacity}
            {sec.waitlist_count > 0 && (
              <span className="ml-1 text-orange-400">(+{sec.waitlist_count} waitlist)</span>
            )}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${fillColor(enrolled, capacity)}`}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>

      {sec.meetings.length > 0 && (
        <div className="space-y-1 mt-3">
          {sec.meetings.map((m, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-white/60">
              <span className="w-20 font-bold text-white/80">{m.day}</span>
              <span>{m.start_time} – {m.end_time}</span>
              {m.location && m.location !== "TBA" && (
                <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-white/40 font-mono text-[10px]">
                  {m.location}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Calendar({ entries, conflicts, onRemoveEntry }: { entries: TimetableEntry[]; conflicts: Conflict[]; onRemoveEntry: (entryId: string) => void; }) {
  const startHour = 8, endHour = 21, HOUR_HEIGHT = 60;
  const minutesPerDay = (endHour - startHour) * 60;

  const conflictIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of conflicts) { s.add(c.a.id); s.add(c.b.id); }
    return s;
  }, [conflicts]);

  const blocksByDay = useMemo(() => {
    const by: Record<string, CalendarBlock[]> = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [] };
    for (const e of entries) {
      for (const m of e.meetings || []) {
        const dk = dayKey(m.day); if (!dk) continue;
        const s = timeToMinutes(m.start_time), en = timeToMinutes(m.end_time);
        if (s === null || en === null) continue;
        const startMin = Math.max(startHour * 60, s), endMin = Math.min(endHour * 60, en);
        if (endMin <= startMin) continue;
        by[dk].push({ entry: e, meeting: m, day: dk, startMin, endMin, conflict: conflictIds.has(e.id) });
      }
    }
    for (const k of Object.keys(by)) by[k].sort((a, b) => a.startMin - b.startMin);
    return by;
  }, [entries, conflictIds]);

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Weekly Planner</h2>
          <p className="text-xs text-white/40 font-medium">{startHour}:00 – {endHour}:00 · {entries.length} sections</p>
        </div>
      </div>

      <div className="grid grid-cols-[64px_repeat(5,1fr)] bg-transparent">
        <div className="border-b border-white/10" />
        {DAYS.map((d) => (
          <div key={d.key} className="border-b border-r border-white/10 px-3 py-3 last:border-r-0 text-center bg-white/5">
            <div className="text-xs font-bold text-white/80 uppercase tracking-widest">{d.label}</div>
          </div>
        ))}

        <div className="relative border-r border-white/10" style={{ height: `${minutesPerDay}px` }}>
          {Array.from({ length: endHour - startHour + 1 }, (_, i) => (
            <div key={i} className="absolute left-0 right-0 border-t border-white/5 text-[10px] text-white/30" style={{ top: `${i * 60}px` }}>
              <div className="-translate-y-2 px-2 font-bold">{startHour + i}:00</div>
            </div>
          ))}
        </div>

        {DAYS.map((d) => (
          <div key={d.key} className="relative border-r border-white/10 last:border-r-0" style={{ height: `${minutesPerDay}px` }}>
            {Array.from({ length: endHour - startHour }, (_, i) => (
              <div key={i} className="absolute left-0 right-0 border-t border-white/5" style={{ top: `${i * 60}px` }} />
            ))}
            {(blocksByDay[d.key] || []).map((b, idx) => {
              const top = b.startMin - startHour * 60, height = Math.max(30, b.endMin - b.startMin);
              return (
                <div key={`${b.entry.id}-${idx}`} className={`absolute left-1 right-1 rounded-xl border p-2 backdrop-blur-xl transition-all hover:scale-[1.02] hover:z-20 ${entryColor(b.entry.type)} ${b.conflict ? "ring-2 ring-red-500/50 border-red-500/50" : ""}`} style={{ top: `${top}px`, height: `${height}px` }}>
                  <div className="flex items-start justify-between gap-1 overflow-hidden h-full">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-black">{b.entry.course_code}</span>
                        <span className="text-[10px] font-bold opacity-80">{b.entry.section_code}</span>
                      </div>
                      <div className="text-[10px] opacity-70 mt-0.5 font-medium">{b.meeting.start_time}-{b.meeting.end_time}</div>
                    </div>
                    <button onClick={() => onRemoveEntry(b.entry.id)} className="shrink-0 rounded bg-black/20 p-1 text-[8px] hover:bg-black/40 transition">✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {conflicts.length > 0 && (
        <div className="px-6 py-4 border-t border-red-500/20 bg-red-500/5 backdrop-blur-md">
          <div className="text-xs font-black text-red-300 uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="animate-pulse w-2 h-2 rounded-full bg-red-500" />
            Scheduling Conflicts ({conflicts.length})
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {conflicts.map((c, idx) => (
              <div key={idx} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[10px] text-red-200">
                <span className="font-bold">{c.a.course_code}</span> ↔ <span className="font-bold">{c.b.course_code}</span> · {c.day}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CourseModal({ course, onClose, onAddSection, isSectionAdded }: { course: Course; onClose: () => void; onAddSection: (course: Course, section_code: string) => void; isSectionAdded: (course: Course, section_code: string) => boolean; }) {
  const lecs = course.sections.filter(s => s.type === "LEC"), tuts = course.sections.filter(s => s.type === "TUT"), pras = course.sections.filter(s => s.type === "PRA"), other = course.sections.filter(s => !["LEC", "TUT", "PRA"].includes(s.type));
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-3xl glass shadow-2xl border border-white/20">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-gray-900/80 backdrop-blur-xl px-8 py-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-sm font-black text-blue-400">{course.course_code}</span>
              <span className={`rounded-full px-3 py-0.5 text-[10px] font-black border uppercase tracking-wider ${sessionColor(course.session)}`}>{sessionLabel(course.session)}</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight leading-none">{course.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-full bg-white/5 p-2 hover:bg-white/10 text-white/40 hover:text-white transition">✕</button>
        </div>
        <div className="px-8 py-8 space-y-8">
          {course.description && <p className="text-white/70 text-sm leading-relaxed font-medium">{course.description}</p>}
          <div className="flex gap-4 flex-wrap">
            {course.breadth_requirements && <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[10px] font-black uppercase text-white/50">📚 {course.breadth_requirements}</span>}
            {course.campus && <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[10px] font-black uppercase text-white/50">📍 {course.campus}</span>}
          </div>
          {(course.prerequisites || course.corequisites || course.exclusions) && (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-3 text-xs">
              {course.prerequisites && (<div><span className="font-black text-white/40 uppercase tracking-widest mr-2">Prerequisites:</span> <span className="text-white/80">{course.prerequisites}</span></div>)}
              {course.corequisites && (<div><span className="font-black text-white/40 uppercase tracking-widest mr-2">Corequisites:</span> <span className="text-white/80">{course.corequisites}</span></div>)}
              {course.exclusions && (<div><span className="font-black text-white/40 uppercase tracking-widest mr-2">Exclusions:</span> <span className="text-white/80">{course.exclusions}</span></div>)}
            </div>
          )}
          {[{ label: "Lectures", items: lecs }, { label: "Tutorials", items: tuts }, { label: "Practicals", items: pras }, { label: "Other", items: other }].filter(g => g.items.length > 0).map(g => (
            <div key={g.label}><h3 className="text-xs font-black text-white/30 uppercase tracking-[0.2em] mb-4">{g.label}</h3><div className="grid gap-4 sm:grid-cols-2">{g.items.map(sec => <SectionCard key={sec.section_code} sec={sec} action={{ label: isSectionAdded(course, sec.section_code) ? "Added" : "Add to Timetable", disabled: isSectionAdded(course, sec.section_code), onClick: () => onAddSection(course, sec.section_code) }} />)}</div></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TimetablePage() {
  const [query, setQuery] = useState(""), [inputValue, setInputValue] = useState("");
  const [session, setSession] = useState(""), [page, setPage] = useState(1);
  const [data, setData] = useState<ApiResponse | null>(null), [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Course | null>(null), [suggestions, setSuggestions] = useState<Suggestion[]>([]), [showDropdown, setShowDropdown] = useState(false), [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null), dropdownRef = useRef<HTMLDivElement>(null), PAGE_SIZE = 12;
  const [timetable, setTimetable] = useState<TimetableState>({ entries: [], conflicts: [] }), [ttLoading, setTtLoading] = useState(false), [toast, setToast] = useState<string | null>(null), [showSearch, setShowSearch] = useState(false);

  const fetchTimetable = useCallback(async () => {
    setTtLoading(true); try { const res = await fetch("/api/timetable", { cache: "no-store" }); setTimetable(await res.json()); } catch {} finally { setTtLoading(false); }
  }, []);

  useEffect(() => { fetchTimetable(); }, [fetchTimetable]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);

  const removeEntry = useCallback(async (entryId: string) => {
    setTtLoading(true); try { const res = await fetch("/api/timetable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", entryId }) }); setTimetable(await res.json()); } finally { setTtLoading(false); }
  }, []);

  const clearTimetable = useCallback(async () => {
    setTtLoading(true); try { const res = await fetch("/api/timetable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear" }) }); setTimetable(await res.json()); setToast("Timetable cleared"); } finally { setTtLoading(false); }
  }, []);

  const fetchCourses = useCallback(async () => {
    setLoading(true); try { const res = await fetch(`/api/courses?${new URLSearchParams({ q: query, page: String(page), pageSize: String(PAGE_SIZE), session })}`); setData(await res.json()); } catch { setData(null); } finally { setLoading(false); }
  }, [query, page, session]);

  useEffect(() => { if (showSearch) fetchCourses(); }, [fetchCourses, showSearch]);

  useEffect(() => {
    if (inputValue.length < 2) { setSuggestions([]); setShowDropdown(false); return; }
    const c = new AbortController(); fetch(`/api/suggestions?q=${encodeURIComponent(inputValue)}`, { signal: c.signal }).then(r => r.json()).then(d => { setSuggestions(d); setShowDropdown(d.length > 0); setActiveIdx(-1); }).catch(() => {}); return () => c.abort();
  }, [inputValue]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) setShowDropdown(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const addSection = useCallback(async (course: Course, sec_code: string) => {
    setTtLoading(true); try {
      const s = course.sections.find(x => x.section_code === sec_code);
      const p: any = {}; if (s?.type === "LEC") p.lec = sec_code; else if (s?.type === "TUT") p.tut = sec_code; else if (s?.type === "PRA") p.pra = sec_code; else p.lec = sec_code;
      const r = await fetch("/api/timetable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", course_code: course.course_code, session: course.session, sections: p }) });
      const next = await r.json(); setTimetable(next); if (next.warning) setToast(next.warning); if (next.error) setToast(next.error);
    } finally { setTtLoading(false); }
  }, []);

  return (
    <div className="min-h-screen relative bg-[#030712] text-white">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-blob animation-delay-2000" />
      </div>

      <header className="sticky top-0 z-30 glass border-b border-white/10 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-all">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-500/20">U</div>
            <span className="font-black text-xl tracking-tighter">CO<span className="text-blue-500">PILOT</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSearch(true)} className="rounded-xl px-4 py-2 text-sm font-black bg-white/5 hover:bg-white/10 border border-white/10 transition-all">Add Course</button>
            <Link href="/generate" className="rounded-xl bg-emerald-600/20 px-4 py-2 text-sm font-black text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 transition-all">⚡ Generator</Link>
            <Link href="/chat" className="rounded-xl px-4 py-2 text-sm font-black bg-white/5 hover:bg-white/10 border border-white/10 transition-all">🤖 Chat</Link>
            <button onClick={clearTimetable} disabled={timetable.entries.length === 0 || ttLoading} className="rounded-xl px-4 py-2 text-sm font-black bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20 transition-all disabled:opacity-20">Clear</button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Calendar entries={timetable.entries} conflicts={timetable.conflicts} onRemoveEntry={removeEntry} />
      </main>

      {showSearch && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowSearch(false)} />
          <div className="relative h-full w-full max-w-xl glass-dark border-l border-white/10 shadow-2xl flex flex-col">
            <div className="px-6 py-6 border-b border-white/10 bg-white/5">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black tracking-tight">Search Catalog</h2>
                <button onClick={() => setShowSearch(false)} className="rounded-full bg-white/5 p-2 hover:bg-white/10 transition">✕</button>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <input ref={inputRef} type="text" value={inputValue} placeholder="Search course codes..." className="w-full rounded-2xl bg-white/5 px-5 py-4 text-sm font-medium border border-white/10 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all" onChange={e => setInputValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { setQuery(inputValue); setPage(1); } if (e.key === "ArrowDown") setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); if (e.key === "ArrowUp") setActiveIdx(i => Math.max(i - 1, -1)); }} autoComplete="off" />
                  {showDropdown && suggestions.length > 0 && (<div ref={dropdownRef} className="absolute top-full mt-2 w-full rounded-2xl glass border border-white/10 shadow-2xl overflow-hidden py-2">{suggestions.map((s, i) => (<button key={s.course_code} className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors ${i === activeIdx ? "bg-white/10" : "hover:bg-white/5"}`} onMouseDown={e => { e.preventDefault(); setQuery(s.course_code); setInputValue(s.course_code); setShowDropdown(false); }}> <span className="font-mono text-[10px] font-black bg-blue-500/20 text-blue-400 rounded px-2 py-0.5">{s.course_code}</span> <span className="text-xs font-bold text-white/80">{s.title}</span></button>))}</div>)}
                </div>
                <div className="flex gap-3">
                  <select value={session} onChange={e => { setSession(e.target.value); setPage(1); }} className="flex-1 rounded-2xl bg-white/5 px-5 py-3 text-xs font-black uppercase tracking-wider border border-white/10 appearance-none cursor-pointer hover:bg-white/10 transition"> {Object.entries(SESSION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)} </select>
                  <button onClick={() => { setQuery(inputValue); setPage(1); }} className="rounded-2xl bg-blue-600 px-8 py-3 text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition-all">Search</button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loading ? ( <div className="flex items-center justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-blue-500 animate-spin" /></div> ) : data?.items.map(c => (
                <div key={`${c.course_code}-${c.session}`} className="group rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/[0.08] transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-[10px] font-black bg-blue-500/20 text-blue-400 rounded px-2 py-1 uppercase">{c.course_code}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black border uppercase ${sessionColor(c.session)}`}>{sessionLabel(c.session)}</span>
                      </div>
                      <div className="text-sm font-black text-white group-hover:text-blue-400 transition-colors leading-tight mb-2">{c.title}</div>
                      <p className="text-[10px] text-white/40 line-clamp-2 leading-relaxed">{c.description}</p>
                    </div>
                    <button onClick={() => setSelected(c)} className="rounded-xl bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all border border-white/10">Views</button>
                  </div>
                </div>
              ))}
              {totalPages > 1 && (<div className="flex items-center justify-center gap-4 pt-6"><button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-xl bg-white/5 border border-white/10 disabled:opacity-20 hover:bg-white/10 transition">←</button><span className="text-[10px] font-black uppercase tracking-widest text-white/30">Page {page} / {totalPages}</span><button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-xl bg-white/5 border border-white/10 disabled:opacity-20 hover:bg-white/10 transition">→</button></div>)}
            </div>
          </div>
        </div>
      )}
      {selected && <CourseModal course={selected} onClose={() => setSelected(null)} onAddSection={addSection} isSectionAdded={isSectionAdded} />}
      {toast && <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"><div className="rounded-2xl glass-dark border border-white/20 text-white px-6 py-3 text-xs font-bold shadow-2xl animate-bounce">{toast}</div></div>}
    </div>
  );
}
