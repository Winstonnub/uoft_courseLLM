"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Course, Section, Meeting } from "@/types/course";

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
  if (type === "LEC") return "bg-blue-600/10 border-blue-200 text-blue-900";
  if (type === "TUT") return "bg-emerald-600/10 border-emerald-200 text-emerald-900";
  if (type === "PRA") return "bg-amber-600/10 border-amber-200 text-amber-900";
  return "bg-gray-600/10 border-gray-200 text-gray-900";
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

type TimetableEntry = {
  id: string;
  course_code: string;
  title: string;
  session: string;
  section_code: string;
  type: string;
  meetings: Meeting[];
};

type Conflict = {
  a: { id: string; course_code: string; section_code: string };
  b: { id: string; course_code: string; section_code: string };
  day: string;
  start_time: string;
  end_time: string;
};

type TimetableState = {
  entries: TimetableEntry[];
  conflicts: Conflict[];
  warning?: string;
  error?: string;
};

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionCard({
  sec,
  action,
}: {
  sec: Section;
  action?: {
    label: string;
    disabled: boolean;
    onClick: () => void;
  };
}) {
  const { enrolled, capacity } = sec.availability;
  const fillPct = capacity > 0 ? Math.min(100, (enrolled / capacity) * 100) : 0;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeColor(sec.type)}`}>
            {sec.section_code}
          </span>
          {sec.cancelled && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
              Cancelled
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{sec.delivery_mode}</span>
          {action && (
            <button
              onClick={action.onClick}
              disabled={action.disabled}
              className="rounded-lg bg-[#002A5C] px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-[#003875] disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {action.label}
            </button>
          )}
        </div>
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

function Calendar({
  entries,
  conflicts,
  onRemoveEntry,
}: {
  entries: TimetableEntry[];
  conflicts: Conflict[];
  onRemoveEntry: (entryId: string) => void;
}) {
  const startHour = 8;
  const endHour = 21;
  const minutesPerDay = (endHour - startHour) * 60;

  const conflictIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of conflicts) {
      s.add(c.a.id);
      s.add(c.b.id);
    }
    return s;
  }, [conflicts]);

  const blocksByDay = useMemo(() => {
    const by: Record<string, CalendarBlock[]> = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [] };
    for (const e of entries) {
      for (const m of e.meetings || []) {
        const dk = dayKey(m.day);
        if (!dk) continue;
        const s = timeToMinutes(m.start_time);
        const en = timeToMinutes(m.end_time);
        if (s === null || en === null) continue;
        // clamp
        const startMin = Math.max(startHour * 60, s);
        const endMin = Math.min(endHour * 60, en);
        if (endMin <= startMin) continue;
        by[dk].push({
          entry: e,
          meeting: m,
          day: dk,
          startMin,
          endMin,
          conflict: conflictIds.has(e.id),
        });
      }
    }

    for (const k of Object.keys(by)) {
      by[k].sort((a, b) => a.startMin - b.startMin);
    }

    return by;
  }, [entries, conflictIds]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Weekly Timetable</h2>
          <p className="text-xs text-gray-400">Mon–Fri · {startHour}:00–{endHour}:00</p>
        </div>
        <div className="text-xs text-gray-400">{entries.length} section{entries.length !== 1 ? "s" : ""}</div>
      </div>

      <div className="grid grid-cols-[64px_repeat(5,1fr)]">
        {/* Header row */}
        <div className="bg-gray-50 border-b border-gray-100" />
        {DAYS.map((d) => (
          <div key={d.key} className="bg-gray-50 border-b border-gray-100 px-3 py-2">
            <div className="text-xs font-semibold text-gray-700">{d.label}</div>
          </div>
        ))}

        {/* Body */}
        <div className="relative bg-white border-r border-gray-100" style={{ height: `${minutesPerDay}px` }}>
          {Array.from({ length: endHour - startHour + 1 }, (_, i) => {
            const h = startHour + i;
            return (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-gray-100 text-[10px] text-gray-400"
                style={{ top: `${i * 60}px` }}
              >
                <div className="-translate-y-2 px-2">{h}:00</div>
              </div>
            );
          })}
        </div>

        {DAYS.map((d) => (
          <div
            key={d.key}
            className="relative bg-white border-r border-gray-100 last:border-r-0"
            style={{ height: `${minutesPerDay}px` }}
          >
            {Array.from({ length: endHour - startHour }, (_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-t border-gray-50"
                style={{ top: `${i * 60}px` }}
              />
            ))}

            {(blocksByDay[d.key] || []).map((b, idx) => {
              const top = b.startMin - startHour * 60;
              const height = Math.max(24, b.endMin - b.startMin);
              const classes = entryColor(b.entry.type);
              return (
                <div
                  key={`${b.entry.id}-${b.meeting.day}-${b.meeting.start_time}-${idx}`}
                  className={`absolute left-2 right-2 rounded-xl border p-2 shadow-sm ${classes} ${
                    b.conflict ? "ring-2 ring-red-400/60" : ""
                  }`}
                  style={{ top: `${top}px`, height: `${height}px` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold">{b.entry.course_code}</span>
                        <span className="text-[11px] font-semibold">{b.entry.section_code}</span>
                        <span className="text-[10px] rounded px-1.5 py-0.5 bg-white/60 border border-white/40">
                          {b.entry.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-700 truncate">{b.meeting.start_time}–{b.meeting.end_time}</div>
                      {b.meeting.location && b.meeting.location !== "TBA" && (
                        <div className="text-[10px] text-gray-500 truncate">{b.meeting.location}</div>
                      )}
                    </div>
                    <button
                      onClick={() => onRemoveEntry(b.entry.id)}
                      className="shrink-0 rounded-md border border-gray-200 bg-white/70 px-2 py-1 text-[10px] font-semibold text-gray-700 hover:bg-white transition"
                      title="Remove section"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {conflicts.length > 0 && (
        <div className="px-5 py-4 border-t border-gray-100 bg-red-50">
          <div className="text-xs font-semibold text-red-800 mb-2">Conflicts ({conflicts.length})</div>
          <div className="grid gap-2 md:grid-cols-2">
            {conflicts.slice(0, 6).map((c, idx) => (
              <div key={idx} className="rounded-lg border border-red-200 bg-white/60 px-3 py-2 text-xs text-red-900">
                {c.a.course_code} {c.a.section_code} ↔ {c.b.course_code} {c.b.section_code} · {c.day} · {c.start_time}–{c.end_time}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Update CourseModal signature usage: now adds default LEC+TUT via API
function CourseModal({
  course,
  onClose,
  onAddSection,
  isSectionAdded,
}: {
  course: Course;
  onClose: () => void;
  onAddSection: (course: Course, section_code: string) => void;
  isSectionAdded: (course: Course, section_code: string) => boolean;
}) {
  const lecs = course.sections.filter((s) => s.type === "LEC");
  const tuts = course.sections.filter((s) => s.type === "TUT");
  const pras = course.sections.filter((s) => s.type === "PRA");
  const other = course.sections.filter((s) => !["LEC", "TUT", "PRA"].includes(s.type));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
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
            className="rounded-full p-2 hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
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
                <div>
                  <span className="font-semibold text-gray-700">Prerequisites: </span>
                  <span className="text-gray-600">{course.prerequisites}</span>
                </div>
              )}
              {course.corequisites && (
                <div>
                  <span className="font-semibold text-gray-700">Corequisites: </span>
                  <span className="text-gray-600">{course.corequisites}</span>
                </div>
              )}
              {course.exclusions && (
                <div>
                  <span className="font-semibold text-gray-700">Exclusions: </span>
                  <span className="text-gray-600">{course.exclusions}</span>
                </div>
              )}
            </div>
          )}

          {[
            { label: "Lectures", items: lecs },
            { label: "Tutorials", items: tuts },
            { label: "Practicals", items: pras },
            { label: "Other", items: other },
          ]
            .filter(({ items }) => items.length > 0)
            .map(({ label, items }) => (
              <div key={label}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {label}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((sec) => {
                    const added = isSectionAdded(course, sec.section_code);
                    return (
                      <SectionCard
                        key={sec.section_code}
                        sec={sec}
                        action={{
                          label: added ? "Added" : "Add",
                          disabled: added,
                          onClick: () => onAddSection(course, sec.section_code),
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
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

  const [timetable, setTimetable] = useState<TimetableState>({ entries: [], conflicts: [] });
  const [ttLoading, setTtLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [showSearch, setShowSearch] = useState(false);

  const fetchTimetable = useCallback(async () => {
    setTtLoading(true);
    try {
      const res = await fetch("/api/timetable", { cache: "no-store" });
      setTimetable(await res.json());
    } catch {
      // ignore
    } finally {
      setTtLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimetable();
  }, [fetchTimetable]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const removeEntry = useCallback(async (entryId: string) => {
    setTtLoading(true);
    try {
      const res = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", entryId }),
      });
      setTimetable((await res.json()) as TimetableState);
    } finally {
      setTtLoading(false);
    }
  }, []);

  const clearTimetable = useCallback(async () => {
    setTtLoading(true);
    try {
      const res = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      setTimetable((await res.json()) as TimetableState);
      setToast("Timetable cleared");
    } finally {
      setTtLoading(false);
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ q: query, page: String(page), pageSize: String(PAGE_SIZE), session });
    try {
      const res = await fetch(`/api/courses?${params}`);
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [query, page, session]);

  // Only fetch when search drawer is open.
  useEffect(() => {
    if (!showSearch) return;
    fetchCourses();
  }, [fetchCourses, showSearch]);

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

  const addSection = useCallback(async (course: Course, section_code: string) => {
    setTtLoading(true);
    try {
      const sec = course.sections.find((s) => s.section_code === section_code);
      const type = sec?.type;
      const sectionsPayload: { lec?: string; tut?: string; pra?: string } = {};
      if (type === "LEC") sectionsPayload.lec = section_code;
      else if (type === "TUT") sectionsPayload.tut = section_code;
      else if (type === "PRA") sectionsPayload.pra = section_code;
      else {
        // Fallback: still try to add as a lecture
        sectionsPayload.lec = section_code;
      }

      const res = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          course_code: course.course_code,
          session: course.session,
          sections: sectionsPayload,
        }),
      });
      const next = (await res.json()) as TimetableState;
      setTimetable(next);
      if (next.warning) setToast(next.warning);
      if (next.error) setToast(next.error);
    } finally {
      setTtLoading(false);
    }
  }, []);

  const isSectionAdded = useCallback(
    (course: Course, section_code: string) =>
      timetable.entries.some((e) => e.course_code === course.course_code && e.section_code === section_code),
    [timetable.entries]
  );

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-[#002A5C] shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white font-black text-sm">U</div>
            <span className="text-white font-bold text-base tracking-tight">UofT Timetable</span>
          </div>

          <button
            onClick={() => setShowSearch(true)}
            className="ml-auto rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 transition"
          >
            Add courses
          </button>

          <a href="/chat" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 transition flex items-center gap-1.5">
            <span>🤖</span> Copilot
          </a>

          <a href="/generate" className="rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/30 transition flex items-center gap-1.5">
            <span>⚡</span> Generator
          </a>

          <button
            onClick={clearTimetable}
            disabled={timetable.entries.length === 0 || ttLoading}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Clear
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <Calendar entries={timetable.entries} conflicts={timetable.conflicts} onRemoveEntry={removeEntry} />
      </main>

      {/* Search Drawer */}
      {showSearch && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSearch(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-gray-900">Add courses</div>
                <div className="text-xs text-gray-400">Adds default LEC + TUT/PRA (you’ll be able to choose sections next)</div>
              </div>
              <button
                onClick={() => setShowSearch(false)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Close
              </button>
            </div>

            <div className="p-5 border-b border-gray-100">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    placeholder="Search (e.g. CSC311)"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#002A5C]/30 focus:border-[#002A5C] transition"
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                    autoComplete="off"
                  />

                  {showDropdown && suggestions.length > 0 && (
                    <div ref={dropdownRef} className="absolute top-full mt-1.5 w-full rounded-xl border border-gray-200 bg-white shadow-xl z-40 overflow-hidden">
                      {suggestions.map((s, i) => (
                        <button
                          key={s.course_code}
                          className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-blue-50 transition-colors ${
                            i === activeIdx ? "bg-blue-50" : ""
                          }`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            commitSearch(s.course_code);
                          }}
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
                  onChange={(e) => {
                    setSession(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#002A5C]/30 focus:border-[#002A5C] transition w-40 cursor-pointer"
                >
                  {Object.entries(SESSION_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    commitSearch(inputValue);
                    fetchCourses();
                  }}
                  className="rounded-xl bg-[#002A5C] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#003875] transition-colors"
                >
                  Search
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-10 h-10 rounded-full border-4 border-[#002A5C]/20 border-t-[#002A5C] animate-spin" />
                </div>
              ) : data && data.items.length === 0 ? (
                <div className="text-sm text-gray-500">No results.</div>
              ) : (
                <div className="space-y-3">
                  {data?.items.map((course) => (
                    <div
                      key={`${course.course_code}-${course.session}`}
                      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#002A5C] bg-blue-50 rounded px-2 py-1">
                              {course.course_code}
                            </span>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sessionColor(course.session)}`}>
                              {sessionLabel(course.session)}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-gray-900 mt-2 line-clamp-2">{course.title}</div>
                        </div>
                        <div className="shrink-0 flex flex-col gap-2">
                          <button
                            onClick={() => setSelected(course)}
                            className="rounded-xl bg-[#002A5C] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#003875] transition"
                          >
                            Choose sections
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {totalPages > 1 && (
                    <div className="pt-3 flex items-center justify-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        Prev
                      </button>
                      <div className="text-sm text-gray-400">
                        Page {page} / {totalPages}
                      </div>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selected && (
        <CourseModal
          course={selected}
          onClose={() => setSelected(null)}
          onAddSection={addSection}
          isSectionAdded={isSectionAdded}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="rounded-xl bg-gray-900 text-white px-4 py-2 text-sm shadow-lg">{toast}</div>
        </div>
      )}
    </div>
  );
}
