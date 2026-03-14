"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Course, Section } from "@/types/course";

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
    return "bg-purple-100 text-purple-700";
  if (session.includes("20259")) return "bg-orange-100 text-orange-700";
  if (session.includes("20261")) return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-500";
}

function fillColor(enrolled: number, capacity: number): string {
  if (capacity === 0) return "bg-gray-200";
  const pct = enrolled / capacity;
  if (pct >= 1) return "bg-red-400";
  if (pct >= 0.85) return "bg-orange-400";
  return "bg-emerald-400";
}

function typeColor(type: string): string {
  if (type === "LEC") return "bg-blue-100 text-blue-700";
  if (type === "TUT") return "bg-green-100 text-green-700";
  if (type === "PRA") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-600";
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Suggestion {
  course_code: string;
  title: string;
}

interface ApiResponse {
  items: Course[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionCard({ sec }: { sec: Section }) {
  const { enrolled, capacity } = sec.availability;
  const fillPct = capacity > 0 ? Math.min(100, (enrolled / capacity) * 100) : 0;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeColor(sec.type)}`}>
            {sec.section_code}
          </span>
          {sec.cancelled && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
              Cancelled
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{sec.delivery_mode}</span>
      </div>

      {sec.instructors.length > 0 && (
        <p className="text-sm text-gray-600 mb-2">👤 {sec.instructors.join(", ")}</p>
      )}

      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Enrolment</span>
          <span>
            {enrolled}/{capacity}
            {sec.waitlist_count > 0 && (
              <span className="ml-1 text-orange-500">(+{sec.waitlist_count} waitlist)</span>
            )}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${fillColor(enrolled, capacity)}`}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>

      {sec.meetings.length > 0 && (
        <div className="space-y-1 mt-3">
          {sec.meetings.map((m, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
              <span className="w-20 font-medium text-gray-700">{m.day}</span>
              <span>{m.start_time} – {m.end_time}</span>
              {m.location && m.location !== "TBA" && (
                <span className="ml-auto rounded bg-gray-50 px-1.5 py-0.5 text-gray-500 font-mono">
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

function CourseModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const lecs = course.sections.filter((s) => s.type === "LEC");
  const tuts = course.sections.filter((s) => s.type === "TUT");
  const pras = course.sections.filter((s) => s.type === "PRA");
  const other = course.sections.filter((s) => !["LEC", "TUT", "PRA"].includes(s.type));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl bg-white px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-sm font-bold text-[#002A5C]">{course.course_code}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sessionColor(course.session)}`}>
                {sessionLabel(course.session)}
              </span>
              {course.campus && <span className="text-xs text-gray-400">{course.campus}</span>}
            </div>
            <h2 className="text-xl font-bold text-gray-900 leading-snug">{course.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-2 hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6 pt-4 space-y-5">
          {course.description && (
            <p className="text-sm text-gray-600 leading-relaxed">{course.description}</p>
          )}

          {course.breadth_requirements && (
            <span className="inline-block rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500">
              📚 {course.breadth_requirements}
            </span>
          )}

          {(course.prerequisites || course.corequisites || course.exclusions) && (
            <div className="rounded-xl bg-gray-50 p-4 space-y-2 text-sm">
              {course.prerequisites && (
                <div><span className="font-semibold text-gray-700">Prerequisites: </span><span className="text-gray-600">{course.prerequisites}</span></div>
              )}
              {course.corequisites && (
                <div><span className="font-semibold text-gray-700">Corequisites: </span><span className="text-gray-600">{course.corequisites}</span></div>
              )}
              {course.exclusions && (
                <div><span className="font-semibold text-gray-700">Exclusions: </span><span className="text-gray-600">{course.exclusions}</span></div>
              )}
            </div>
          )}

          {[{ label: "Lectures", items: lecs }, { label: "Tutorials", items: tuts }, { label: "Practicals", items: pras }, { label: "Other", items: other }]
            .filter(({ items }) => items.length > 0)
            .map(({ label, items }) => (
              <div key={label}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((sec) => <SectionCard key={sec.section_code} sec={sec} />)}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function CourseCard({ course, onClick }: { course: Course; onClick: () => void }) {
  const lecCount = course.sections.filter((s) => s.type === "LEC").length;
  const tutCount = course.sections.filter((s) => s.type === "TUT").length;
  const praCount = course.sections.filter((s) => s.type === "PRA").length;
  const instructors = [...new Set(course.sections.filter((s) => s.type === "LEC").flatMap((s) => s.instructors))].slice(0, 2);
  const lecs = course.sections.filter((s) => s.type === "LEC" && s.availability.capacity > 0);
  const avgFill = lecs.length > 0
    ? lecs.reduce((sum, s) => sum + s.availability.enrolled / s.availability.capacity, 0) / lecs.length
    : 0;

  return (
    <button
      onClick={onClick}
      className="group text-left w-full rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-[#002A5C]/30 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002A5C]"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-mono text-xs font-bold text-[#002A5C] bg-blue-50 rounded-lg px-2 py-1">
          {course.course_code}
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${sessionColor(course.session)}`}>
          {sessionLabel(course.session)}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-gray-900 leading-snug mb-2 group-hover:text-[#002A5C] transition-colors line-clamp-2">
        {course.title}
      </h3>

      {instructors.length > 0 && (
        <p className="text-xs text-gray-500 mb-3 truncate">
          👤 {instructors.join(", ")}
        </p>
      )}

      {lecs.length > 0 && (
        <div className="mb-3">
          <div className="h-1 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${fillColor(avgFill * 100, 100)}`}
              style={{ width: `${Math.min(100, avgFill * 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{Math.round(avgFill * 100)}% avg enrolment</p>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {lecCount > 0 && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">{lecCount} LEC</span>}
        {tutCount > 0 && <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">{tutCount} TUT</span>}
        {praCount > 0 && <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">{praCount} PRA</span>}
      </div>
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function TimetablePage() {
  const [query, setQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [session, setSession] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Course | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 12;

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ q: query, page: String(page), pageSize: String(PAGE_SIZE), session });
    try {
      const res = await fetch(`/api/courses?${params}`);
      setData(await res.json());
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [query, page, session]);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  useEffect(() => {
    if (inputValue.length < 2) { setSuggestions([]); setShowDropdown(false); return; }
    const controller = new AbortController();
    fetch(`/api/suggestions?q=${encodeURIComponent(inputValue)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => { setSuggestions(d); setShowDropdown(d.length > 0); setActiveIdx(-1); })
      .catch(() => {});
    return () => controller.abort();
  }, [inputValue]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node))
        setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function commitSearch(value: string) {
    setQuery(value); setInputValue(value); setPage(1); setShowDropdown(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter") { e.preventDefault(); commitSearch(activeIdx >= 0 ? suggestions[activeIdx].course_code : inputValue); }
    else if (e.key === "Escape") setShowDropdown(false);
  }

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-[#002A5C] shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white font-black text-sm">U</div>
            <span className="text-white font-bold text-base tracking-tight">UofT Course Explorer</span>
          </div>
          <span className="ml-auto text-white/50 text-xs hidden sm:block">Arts &amp; Science · 2025–26</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Find Your Courses</h1>
          <p className="text-sm text-gray-500 mb-5">
            Search across {data ? data.total.toLocaleString() : "3,000+"} Arts &amp; Science courses
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="relative">
                <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7 7 0 1116.65 16.65z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  placeholder="Search by code or title (e.g. CSC311, Machine Learning)…"
                  className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-10 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#002A5C]/30 focus:border-[#002A5C] transition"
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                  autoComplete="off"
                />
                {inputValue && (
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                    onClick={() => { setInputValue(""); commitSearch(""); inputRef.current?.focus(); }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Autocomplete dropdown */}
              {showDropdown && suggestions.length > 0 && (
                <div ref={dropdownRef} className="absolute top-full mt-1.5 w-full rounded-xl border border-gray-200 bg-white shadow-xl z-40 overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button
                      key={s.course_code}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-blue-50 transition-colors ${i === activeIdx ? "bg-blue-50" : ""}`}
                      onMouseDown={(e) => { e.preventDefault(); commitSearch(s.course_code); }}
                    >
                      <span className="font-mono text-xs font-bold text-[#002A5C] bg-blue-50 rounded px-1.5 py-0.5 shrink-0">{s.course_code}</span>
                      <span className="text-sm text-gray-700 truncate">{s.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <select
              value={session}
              onChange={(e) => { setSession(e.target.value); setPage(1); }}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#002A5C]/30 focus:border-[#002A5C] transition sm:w-44 cursor-pointer"
            >
              {Object.entries(SESSION_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>

            <button
              onClick={() => commitSearch(inputValue)}
              className="rounded-xl bg-[#002A5C] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#003875] active:bg-[#001f45] transition-colors"
            >
              Search
            </button>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-4 border-[#002A5C]/20 border-t-[#002A5C] animate-spin" />
              <p className="text-sm text-gray-400">Loading courses…</p>
            </div>
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No courses found</h3>
            <p className="text-sm text-gray-400">Try a different search term or remove filters</p>
          </div>
        ) : (
          <>
            {data && (
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-800">{data.total.toLocaleString()}</span>{" "}
                  course{data.total !== 1 ? "s" : ""} found
                  {query && <span> for &ldquo;<span className="font-medium text-gray-700">{query}</span>&rdquo;</span>}
                </p>
                <p className="text-sm text-gray-400">Page {data.page} of {data.totalPages}</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data?.items.map((course) => (
                <CourseCard
                  key={`${course.course_code}-${course.session}`}
                  course={course}
                  onClick={() => setSelected(course)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button onClick={() => setPage(1)} disabled={page === 1}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">«</button>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">‹ Prev</button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 5) p = i + 1;
                  else if (page <= 3) p = i + 1;
                  else if (page >= totalPages - 2) p = totalPages - 4 + i;
                  else p = page - 2 + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${p === page ? "bg-[#002A5C] text-white shadow-sm" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
                      {p}
                    </button>
                  );
                })}

                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">Next ›</button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">»</button>
              </div>
            )}
          </>
        )}
      </main>

      {selected && <CourseModal course={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
