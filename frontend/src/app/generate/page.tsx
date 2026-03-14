"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

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
  let hour = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === "AM" && hour === 12) hour = 0;
  else if (ampm === "PM" && hour !== 12) hour += 12;
  return hour * 60 + min;
}

function typeColor(type: string): string {
  if (type === "LEC") return "bg-blue-500";
  if (type === "TUT") return "bg-emerald-500";
  if (type === "PRA") return "bg-amber-500";
  return "bg-gray-400";
}

function typeBadge(type: string): string {
  if (type === "LEC") return "bg-blue-100 text-blue-700";
  if (type === "TUT") return "bg-green-100 text-green-700";
  if (type === "PRA") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-600";
}

function termBadge(term: string): string {
  if (term === "F") return "bg-orange-100 text-orange-700";
  if (term === "S") return "bg-blue-100 text-blue-700";
  if (term === "Y") return "bg-purple-100 text-purple-700";
  return "bg-gray-100 text-gray-500";
}

function termLabel(term: string): string {
  if (term === "F") return "Fall";
  if (term === "S") return "Winter";
  if (term === "Y") return "Full Year";
  return term;
}

// ── Mini Calendar ─────────────────────────────────────────────────────────

function MiniCalendar({ entries, label, accentColor }: { entries: ScheduleEntry[]; label: string; accentColor: string }) {
  const START_HOUR = 8, END_HOUR = 21, HOUR_HEIGHT = 28;

  const blocks = entries.flatMap((entry) =>
    entry.meetings
      .filter((m) => m.day && m.start_time && m.end_time)
      .map((m) => {
        const start = timeToMinutes(m.start_time);
        const end = timeToMinutes(m.end_time);
        if (start === null || end === null) return null;
        const dayIdx = DAYS.indexOf(m.day);
        if (dayIdx < 0) return null;
        return { entry, start, end, dayIdx };
      })
      .filter(Boolean) as { entry: ScheduleEntry; start: number; end: number; dayIdx: number }[]
  );

  return (
    <div>
      <div className={`text-xs font-bold px-3 py-1.5 rounded-t-xl ${accentColor} text-white`}>{label}</div>
      <div className="border border-t-0 border-gray-200 rounded-b-xl overflow-hidden bg-white">
        <div className="grid grid-cols-[40px_repeat(5,1fr)]">
          <div className="bg-gray-50 border-b border-r border-gray-200" />
          {DAYS.map((d) => (
            <div key={d} className="text-center text-[9px] font-semibold text-gray-500 py-1 border-b border-r border-gray-200 bg-gray-50 last:border-r-0">
              {d.slice(0, 3)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[40px_repeat(5,1fr)] relative" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
            <div key={i} className="text-[8px] text-gray-400 text-right pr-1 border-r border-gray-100"
              style={{ position: "absolute", top: i * HOUR_HEIGHT, left: 0, width: 40, height: HOUR_HEIGHT }}>
              {((START_HOUR + i) % 12 || 12) + (START_HOUR + i < 12 ? "a" : "p")}
            </div>
          ))}
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
            <div key={`l-${i}`} className="border-b border-gray-50"
              style={{ position: "absolute", top: i * HOUR_HEIGHT, left: 40, right: 0, height: HOUR_HEIGHT }} />
          ))}
          {blocks.map((b, idx) => {
            const top = ((b.start - START_HOUR * 60) / 60) * HOUR_HEIGHT;
            const height = ((b.end - b.start) / 60) * HOUR_HEIGHT;
            const colW = `calc((100% - 40px) / 5)`;
            const left = `calc(40px + ${b.dayIdx} * ${colW})`;
            return (
              <div key={idx} className={`absolute rounded ${typeColor(b.entry.type)} text-white text-[7px] font-medium px-0.5 py-0.5 overflow-hidden leading-tight shadow-sm`}
                style={{ top, height: Math.max(height, 10), left, width: colW }}
                title={`${b.entry.course_code} ${b.entry.section_code}`}>
                <div className="truncate">{b.entry.course_code.replace(/H1[FSY]?$/, "")}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Section List ──────────────────────────────────────────────────────────

function SectionList({ entries, warnings, semLabel }: { entries: ScheduleEntry[]; warnings: Warning[]; semLabel: string }) {
  if (entries.length === 0) return <p className="text-sm text-gray-400 italic">No {semLabel.toLowerCase()} courses.</p>;
  return (
    <div className="space-y-2">
      {entries.map((entry, i) => {
        const { enrolled, capacity } = entry.availability;
        const fillPct = capacity > 0 ? Math.min(100, (enrolled / capacity) * 100) : 0;
        const isFull = capacity > 0 && enrolled >= capacity;
        return (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="font-mono text-xs font-bold text-[#002A5C] bg-blue-50 rounded-lg px-2 py-0.5">{entry.course_code}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeBadge(entry.type)}`}>{entry.section_code}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${termBadge(entry.term)}`}>{termLabel(entry.term)}</span>
              {isFull && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">FULL</span>}
            </div>
            <p className="text-xs text-gray-700 mb-1">{entry.title}</p>
            {entry.instructors.length > 0 && <p className="text-[11px] text-gray-500 mb-1">👤 {entry.instructors.join(", ")}</p>}
            <div className="mb-1">
              <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                <span>Enrollment</span>
                <span>{enrolled}/{capacity}{entry.waitlist_count > 0 && <span className="ml-1 text-orange-500">(+{entry.waitlist_count} wl)</span>}</span>
              </div>
              <div className="h-1 w-full rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full ${isFull ? "bg-red-400" : fillPct >= 85 ? "bg-orange-400" : "bg-emerald-400"}`} style={{ width: `${fillPct}%` }} />
              </div>
            </div>
            <div className="space-y-0.5">
              {entry.meetings.map((m, j) => (
                <div key={j} className="flex items-center gap-2 text-[10px] text-gray-600">
                  <span className="w-16 font-medium text-gray-700">{m.day}</span>
                  <span>{m.start_time} – {m.end_time}</span>
                  {m.location && m.location !== "TBA" && <span className="ml-auto rounded bg-gray-50 px-1 py-0.5 text-gray-500 font-mono text-[9px]">{m.location}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {warnings.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {warnings.map((w, i) => (
            <div key={i} className={`rounded-lg px-3 py-2 text-xs border ${w.type === "full" ? "bg-red-50 border-red-200 text-red-700" : w.type === "cancelled" ? "bg-gray-100 border-gray-300 text-gray-600" : "bg-yellow-50 border-yellow-200 text-yellow-700"}`}>
              {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Generate Page ────────────────────────────────────────────────────

export default function GeneratePage() {
  const [wishlist, setWishlist] = useState<{ code: string; title: string }[]>([]);
  const [courseInput, setCourseInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [activeSchedule, setActiveSchedule] = useState(0);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setShowDrop(false); return; }
    try {
      const res = await fetch(`/api/suggestions?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data); setShowDrop(data.length > 0);
    } catch { /* ignore */ }
  }, []);

  function addCourse(code: string, title: string) {
    if (wishlist.some((w) => w.code === code)) return;
    setWishlist((p) => [...p, { code, title }]); setCourseInput(""); setShowDrop(false); setResult(null);
  }

  function removeCourse(code: string) {
    setWishlist((p) => p.filter((w) => w.code !== code)); setResult(null);
  }

  async function generateSchedules() {
    if (wishlist.length === 0) return;
    setGenerating(true); setResult(null); setActiveSchedule(0);
    try {
      const res = await fetch("http://localhost:8000/api/schedule/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_codes: wishlist.map((w) => w.code), max_schedules: 5 }),
      });
      setResult((await res.json()) as ScheduleResult);
    } catch {
      setResult({ schedules: [], total_valid: 0, errors: ["Failed to connect to the backend."], summary: { fall_courses: [], winter_courses: [], year_courses: [] } });
    } finally { setGenerating(false); }
  }

  const schedule = result?.schedules?.[activeSchedule] ?? null;

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-[#002A5C] shadow-lg">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white font-black text-sm">U</div>
            <span className="text-white font-bold text-base tracking-tight">UofT Timetable</span>
          </Link>
          <div className="ml-auto flex gap-3 items-center">
            <Link href="/" className="text-white/60 hover:text-white text-sm font-medium transition">Timetable</Link>
            <Link href="/chat" className="text-white/60 hover:text-white text-sm font-medium transition flex items-center gap-1"><span>🤖</span> Copilot</Link>
            <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-sm font-semibold">⚡ Generator</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Schedule Generator</h1>
        <p className="text-sm text-gray-500 mb-6">Add courses, then auto-generate conflict-free Fall + Winter timetables. Full-year courses are locked to the same sections in both semesters.</p>

        {/* ── Wishlist ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
          <label className="text-sm font-semibold text-gray-700 mb-3 block">Your Course Wishlist</label>
          <div className="relative mb-4">
            <input type="text" value={courseInput}
              onChange={(e) => { setCourseInput(e.target.value); fetchSuggestions(e.target.value); }}
              onKeyDown={(e) => { if (e.key === "Escape") setShowDrop(false); }}
              placeholder="Search for a course (e.g. MAT223, Linear Algebra)…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#002A5C]/30 transition" autoComplete="off" />
            {showDrop && suggestions.length > 0 && (
              <div className="absolute top-full mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-xl z-40 overflow-hidden max-h-60 overflow-y-auto">
                {suggestions.map((s) => (
                  <button key={s.course_code} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-blue-50 transition-colors"
                    onMouseDown={(e) => { e.preventDefault(); addCourse(s.course_code, s.title); }}>
                    <span className="font-mono text-xs font-bold text-[#002A5C] bg-blue-50 rounded px-1.5 py-0.5 shrink-0">{s.course_code}</span>
                    <span className="text-sm text-gray-700 truncate">{s.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {wishlist.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No courses added yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {wishlist.map((w) => (
                <div key={w.code} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
                  <span className="font-mono font-bold text-[#002A5C] text-xs">{w.code}</span>
                  <span className="text-gray-600 text-xs truncate max-w-[140px]">{w.title}</span>
                  <button onClick={() => removeCourse(w.code)} className="ml-1 text-gray-400 hover:text-red-500 transition">✕</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={generateSchedules} disabled={wishlist.length === 0 || generating}
            className="mt-5 w-full rounded-xl bg-[#002A5C] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#003875] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            {generating ? (<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating…</>) : (<>⚡ Generate Conflict-Free Schedules</>)}
          </button>
        </div>

        {/* ── Errors ───────────────────────────────────────────── */}
        {result && result.errors.length > 0 && (
          <div className="mb-6 space-y-2">
            {result.errors.map((err, i) => <div key={i} className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">❌ {err}</div>)}
          </div>
        )}

        {/* ── Summary ──────────────────────────────────────────── */}
        {result && result.summary && (
          <div className="mb-6 flex gap-3 flex-wrap text-xs">
            {result.summary.fall_courses.length > 0 && <span className="bg-orange-100 text-orange-700 rounded-full px-3 py-1 font-semibold">🍂 Fall: {result.summary.fall_courses.join(", ")}</span>}
            {result.summary.winter_courses.length > 0 && <span className="bg-blue-100 text-blue-700 rounded-full px-3 py-1 font-semibold">❄️ Winter: {result.summary.winter_courses.join(", ")}</span>}
            {result.summary.year_courses.length > 0 && <span className="bg-purple-100 text-purple-700 rounded-full px-3 py-1 font-semibold">📅 Full Year: {result.summary.year_courses.join(", ")}</span>}
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────── */}
        {result && result.schedules.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{result.total_valid} valid schedule{result.total_valid !== 1 ? "s" : ""} found</h2>
              <p className="text-xs text-gray-400">Showing top {result.schedules.length}, ranked by seat availability</p>
            </div>

            {/* Schedule tabs */}
            <div className="flex gap-2 flex-wrap">
              {result.schedules.map((_, i) => (
                <button key={i} onClick={() => setActiveSchedule(i)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${i === activeSchedule ? "bg-[#002A5C] text-white shadow-sm" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
                  Option {i + 1}
                </button>
              ))}
            </div>

            {schedule && (
              <div className="space-y-6">
                {/* Calendars side by side */}
                <div className="grid gap-4 md:grid-cols-2">
                  <MiniCalendar entries={schedule.fall} label="🍂 Fall Semester" accentColor="bg-orange-500" />
                  <MiniCalendar entries={schedule.winter} label="❄️ Winter Semester" accentColor="bg-blue-500" />
                </div>

                {/* Section details side by side */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-bold text-orange-700 mb-2">🍂 Fall Sections</h3>
                    <SectionList entries={schedule.fall} warnings={schedule.fall_warnings} semLabel="Fall" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-blue-700 mb-2">❄️ Winter Sections</h3>
                    <SectionList entries={schedule.winter} warnings={schedule.winter_warnings} semLabel="Winter" />
                  </div>
                </div>

                <div className="text-center"><span className="text-xs text-gray-400">Score: {schedule.score} (higher = more open seats)</span></div>
              </div>
            )}
          </div>
        )}

        {result && result.schedules.length === 0 && result.errors.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">😔</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No valid schedules found</h3>
            <p className="text-sm text-gray-400">All combinations of sections have time conflicts. Try removing a course.</p>
          </div>
        )}
      </main>
    </div>
  );
}
