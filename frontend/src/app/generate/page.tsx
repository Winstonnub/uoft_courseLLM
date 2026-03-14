"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────

interface Suggestion {
  course_code: string;
  title: string;
}

interface ScheduleEntry {
  course_code: string;
  title: string;
  section_code: string;
  type: string;
  instructors: string[];
  meetings: { day: string; start_time: string; end_time: string; location: string }[];
  availability: { enrolled: number; capacity: number };
  waitlist_count: number;
  delivery_mode: string;
}

interface Warning {
  type: string;
  section: string;
  message: string;
}

interface GeneratedSchedule {
  entries: ScheduleEntry[];
  score: number;
  warnings: Warning[];
}

interface ScheduleResult {
  schedules: GeneratedSchedule[];
  total_valid: number;
  errors: string[];
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

// ── Mini Calendar ─────────────────────────────────────────────────────────

function MiniCalendar({ entries }: { entries: ScheduleEntry[] }) {
  const START_HOUR = 8;
  const END_HOUR = 21;
  const HOUR_HEIGHT = 28;

  const blocks = entries.flatMap((entry) =>
    entry.meetings
      .filter((m) => m.day && m.start_time && m.end_time)
      .map((m) => {
        const start = timeToMinutes(m.start_time);
        const end = timeToMinutes(m.end_time);
        if (start === null || end === null) return null;
        const dayIdx = DAYS.indexOf(m.day);
        if (dayIdx < 0) return null;
        return { entry, meeting: m, start, end, dayIdx };
      })
      .filter(Boolean) as { entry: ScheduleEntry; meeting: any; start: number; end: number; dayIdx: number }[]
  );

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="grid grid-cols-[48px_repeat(5,1fr)]">
        <div className="bg-gray-50 border-b border-r border-gray-200" />
        {DAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold text-gray-500 py-1.5 border-b border-r border-gray-200 bg-gray-50 last:border-r-0"
          >
            {d.slice(0, 3)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[48px_repeat(5,1fr)] relative" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
        {/* Hour labels */}
        {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
          <div
            key={i}
            className="text-[9px] text-gray-400 text-right pr-1.5 border-r border-gray-100"
            style={{ position: "absolute", top: i * HOUR_HEIGHT, left: 0, width: 48, height: HOUR_HEIGHT }}
          >
            {((START_HOUR + i) % 12 || 12) + (START_HOUR + i < 12 ? "a" : "p")}
          </div>
        ))}
        {/* Grid lines */}
        {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
          <div
            key={`line-${i}`}
            className="border-b border-gray-50"
            style={{ position: "absolute", top: i * HOUR_HEIGHT, left: 48, right: 0, height: HOUR_HEIGHT }}
          />
        ))}
        {/* Course blocks */}
        {blocks.map((b, idx) => {
          const top = ((b.start - START_HOUR * 60) / 60) * HOUR_HEIGHT;
          const height = ((b.end - b.start) / 60) * HOUR_HEIGHT;
          const colWidth = `calc((100% - 48px) / 5)`;
          const left = `calc(48px + ${b.dayIdx} * ${colWidth})`;
          return (
            <div
              key={idx}
              className={`absolute rounded-md ${typeColor(b.entry.type)} text-white text-[8px] font-medium px-1 py-0.5 overflow-hidden leading-tight shadow-sm`}
              style={{ top, height: Math.max(height, 12), left, width: colWidth }}
              title={`${b.entry.course_code} ${b.entry.section_code}`}
            >
              <div className="truncate">{b.entry.course_code.replace(/H1[FSY]?$/, "")}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Generate Page ────────────────────────────────────────────────────

export default function GeneratePage() {
  // Wishlist
  const [wishlist, setWishlist] = useState<{ code: string; title: string }[]>([]);
  const [courseInput, setCourseInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDrop, setShowDrop] = useState(false);

  // Schedule results
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [activeSchedule, setActiveSchedule] = useState(0);

  // Autocomplete
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setShowDrop(false); return; }
    try {
      const res = await fetch(`/api/suggestions?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data);
      setShowDrop(data.length > 0);
    } catch { /* ignore */ }
  }, []);

  function addCourse(code: string, title: string) {
    if (wishlist.some((w) => w.code === code)) return;
    setWishlist((prev) => [...prev, { code, title }]);
    setCourseInput("");
    setShowDrop(false);
    setResult(null); // clear old results
  }

  function removeCourse(code: string) {
    setWishlist((prev) => prev.filter((w) => w.code !== code));
    setResult(null);
  }

  async function generateSchedules() {
    if (wishlist.length === 0) return;
    setGenerating(true);
    setResult(null);
    setActiveSchedule(0);
    try {
      const res = await fetch("http://localhost:8000/api/schedule/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_codes: wishlist.map((w) => w.code),
          max_schedules: 5,
        }),
      });
      const data = (await res.json()) as ScheduleResult;
      setResult(data);
    } catch {
      setResult({ schedules: [], total_valid: 0, errors: ["Failed to connect to the backend."] });
    } finally {
      setGenerating(false);
    }
  }

  const schedule = result?.schedules?.[activeSchedule] ?? null;

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-[#002A5C] shadow-lg">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white font-black text-sm">U</div>
            <span className="text-white font-bold text-base tracking-tight">UofT Timetable</span>
          </Link>
          <div className="ml-auto flex gap-3 items-center">
            <Link href="/" className="text-white/60 hover:text-white text-sm font-medium transition">Timetable</Link>
            <Link href="/chat" className="text-white/60 hover:text-white text-sm font-medium transition flex items-center gap-1"><span>🤖</span> Copilot</Link>
            <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-sm font-semibold">
              ⚡ Generator
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Schedule Generator</h1>
        <p className="text-sm text-gray-500 mb-6">Add the courses you want to take, then auto-generate conflict-free timetables.</p>

        {/* ── Course Wishlist Builder ───────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
          <label className="text-sm font-semibold text-gray-700 mb-3 block">Your Course Wishlist</label>

          {/* Search input */}
          <div className="relative mb-4">
            <input
              type="text"
              value={courseInput}
              onChange={(e) => { setCourseInput(e.target.value); fetchSuggestions(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowDrop(false);
              }}
              placeholder="Search for a course (e.g. MAT223, Linear Algebra)…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#002A5C]/30 focus:border-[#002A5C] transition"
              autoComplete="off"
            />
            {showDrop && suggestions.length > 0 && (
              <div className="absolute top-full mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-xl z-40 overflow-hidden max-h-60 overflow-y-auto">
                {suggestions.map((s) => (
                  <button
                    key={s.course_code}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-blue-50 transition-colors"
                    onMouseDown={(e) => { e.preventDefault(); addCourse(s.course_code, s.title); }}
                  >
                    <span className="font-mono text-xs font-bold text-[#002A5C] bg-blue-50 rounded px-1.5 py-0.5 shrink-0">{s.course_code}</span>
                    <span className="text-sm text-gray-700 truncate">{s.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Wishlist pills */}
          {wishlist.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No courses added yet. Search above to build your wishlist.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {wishlist.map((w) => (
                <div
                  key={w.code}
                  className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm"
                >
                  <span className="font-mono font-bold text-[#002A5C] text-xs">{w.code}</span>
                  <span className="text-gray-600 text-xs truncate max-w-[140px]">{w.title}</span>
                  <button
                    onClick={() => removeCourse(w.code)}
                    className="ml-1 text-gray-400 hover:text-red-500 transition"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={generateSchedules}
            disabled={wishlist.length === 0 || generating}
            className="mt-5 w-full rounded-xl bg-[#002A5C] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#003875] active:bg-[#001f45] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating schedules…
              </>
            ) : (
              <>⚡ Generate Conflict-Free Schedules</>
            )}
          </button>
        </div>

        {/* ── Errors ───────────────────────────────────────────────── */}
        {result && result.errors.length > 0 && (
          <div className="mb-6 space-y-2">
            {result.errors.map((err, i) => (
              <div key={i} className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                ❌ {err}
              </div>
            ))}
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────── */}
        {result && result.schedules.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {result.total_valid} valid schedule{result.total_valid !== 1 ? "s" : ""} found
              </h2>
              <p className="text-xs text-gray-400">Showing top {result.schedules.length}, ranked by seat availability</p>
            </div>

            {/* Schedule tabs */}
            <div className="flex gap-2 flex-wrap">
              {result.schedules.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSchedule(i)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    i === activeSchedule
                      ? "bg-[#002A5C] text-white shadow-sm"
                      : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Schedule {i + 1}
                </button>
              ))}
            </div>

            {schedule && (
              <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                {/* Section list */}
                <div className="space-y-3">
                  {schedule.entries.map((entry, i) => {
                    const { enrolled, capacity } = entry.availability;
                    const fillPct = capacity > 0 ? Math.min(100, (enrolled / capacity) * 100) : 0;
                    const isFull = capacity > 0 && enrolled >= capacity;

                    return (
                      <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#002A5C] bg-blue-50 rounded-lg px-2 py-1">
                              {entry.course_code}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${typeBadge(entry.type)}`}>
                              {entry.section_code}
                            </span>
                            {isFull && (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                                FULL
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">{entry.delivery_mode}</span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{entry.title}</p>
                        {entry.instructors.length > 0 && (
                          <p className="text-xs text-gray-500 mb-2">👤 {entry.instructors.join(", ")}</p>
                        )}
                        {/* Enrollment bar */}
                        <div className="mb-2">
                          <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                            <span>Enrollment</span>
                            <span>
                              {enrolled}/{capacity}
                              {entry.waitlist_count > 0 && (
                                <span className="ml-1 text-orange-500">(+{entry.waitlist_count} waitlist)</span>
                              )}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isFull ? "bg-red-400" : fillPct >= 85 ? "bg-orange-400" : "bg-emerald-400"}`}
                              style={{ width: `${fillPct}%` }}
                            />
                          </div>
                        </div>
                        {/* Meetings */}
                        <div className="space-y-1">
                          {entry.meetings.map((m, j) => (
                            <div key={j} className="flex items-center gap-2 text-xs text-gray-600">
                              <span className="w-20 font-medium text-gray-700">{m.day}</span>
                              <span>{m.start_time} – {m.end_time}</span>
                              {m.location && m.location !== "TBA" && (
                                <span className="ml-auto rounded bg-gray-50 px-1.5 py-0.5 text-gray-500 font-mono">{m.location}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Warnings */}
                  {schedule.warnings.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <h3 className="text-sm font-semibold text-gray-700">⚠️ Enrollment Warnings</h3>
                      {schedule.warnings.map((w, i) => (
                        <div
                          key={i}
                          className={`rounded-xl px-4 py-3 text-sm border ${
                            w.type === "full"
                              ? "bg-red-50 border-red-200 text-red-700"
                              : w.type === "cancelled"
                              ? "bg-gray-100 border-gray-300 text-gray-600"
                              : "bg-yellow-50 border-yellow-200 text-yellow-700"
                          }`}
                        >
                          {w.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mini calendar preview */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Weekly Preview</h3>
                  <MiniCalendar entries={schedule.entries} />
                  <div className="mt-3 text-center">
                    <span className="text-xs text-gray-400">
                      Score: {schedule.score} (higher = more open seats)
                    </span>
                  </div>
                </div>
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
