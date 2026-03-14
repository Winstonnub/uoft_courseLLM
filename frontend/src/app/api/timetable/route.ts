import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { Course, Section, Meeting } from "@/types/course";

/**
 * Timetable = a set of courses the user has added.
 *
 * For now, we store it in-memory (per server process). This is enough to:
 * - expose a stable, non-hallucinated API surface for an eventual LLM agent
 * - enforce uniqueness and conflict checking server-side
 *
 * Later we can move this to SQLite/Redis and make it per-user.
 */

type TimetableEntry = {
  id: string; // `${course_code}::${section_code}`
  course_code: string;
  title: string;
  session: string;
  section_code: string;
  type: string; // LEC/TUT/PRA
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
};

let _coursesCache: Course[] | null = null;
let _timetable: TimetableState = { entries: [], conflicts: [] };

async function loadAllCourses(): Promise<Course[]> {
  if (_coursesCache) return _coursesCache;
  const filePath = path.join(
    process.cwd(),
    "..",
    "ingestion",
    "raw_data",
    "timetable_full.json"
  );
  const raw = await fs.readFile(filePath, "utf-8");
  _coursesCache = JSON.parse(raw) as Course[];
  return _coursesCache;
}

function parseTimeToMinutes(t: string): number | null {
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

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function sectionToEntry(course: Course, sec: Section): TimetableEntry {
  return {
    id: `${course.course_code}::${sec.section_code}`,
    course_code: course.course_code,
    title: course.title,
    session: course.session,
    section_code: sec.section_code,
    type: sec.type,
    meetings: sec.meetings || [],
  };
}

function detectConflicts(entries: TimetableEntry[]): Conflict[] {
  const conflicts: Conflict[] = [];

  // Expand to per-meeting objects for comparison.
  const expanded = entries.flatMap((e) =>
    (e.meetings || []).map((m) => ({
      entry: e,
      meeting: m,
    }))
  );

  for (let i = 0; i < expanded.length; i++) {
    for (let j = i + 1; j < expanded.length; j++) {
      const a = expanded[i];
      const b = expanded[j];

      if (a.entry.id === b.entry.id) continue;
      if (!a.meeting.day || !b.meeting.day || a.meeting.day !== b.meeting.day) continue;

      const aStart = parseTimeToMinutes(a.meeting.start_time);
      const aEnd = parseTimeToMinutes(a.meeting.end_time);
      const bStart = parseTimeToMinutes(b.meeting.start_time);
      const bEnd = parseTimeToMinutes(b.meeting.end_time);

      if ([aStart, aEnd, bStart, bEnd].some((x) => x === null)) continue;

      if (overlaps(aStart!, aEnd!, bStart!, bEnd!)) {
        conflicts.push({
          a: {
            id: a.entry.id,
            course_code: a.entry.course_code,
            section_code: a.entry.section_code,
          },
          b: {
            id: b.entry.id,
            course_code: b.entry.course_code,
            section_code: b.entry.section_code,
          },
          day: a.meeting.day,
          start_time: a.meeting.start_time,
          end_time: a.meeting.end_time,
        });
      }
    }
  }

  return conflicts;
}

function pickDefaultSectionCodes(course: Course): { lec?: string; tut?: string; pra?: string } {
  const byType: Record<string, string[]> = {};
  for (const s of course.sections || []) {
    if (!s.type || !s.section_code) continue;
    byType[s.type] = byType[s.type] || [];
    byType[s.type].push(s.section_code);
  }
  return {
    lec: byType["LEC"]?.[0],
    tut: byType["TUT"]?.[0],
    pra: byType["PRA"]?.[0],
  };
}

export async function GET() {
  return NextResponse.json(_timetable);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as
      | { action: "clear" }
      | { action: "remove"; entryId: string }
      | {
          action: "add";
          course_code: string;
          session?: string;
          // explicit section; if omitted, we pick defaults
          sections?: { lec?: string; tut?: string; pra?: string };
        };

    if (body.action === "clear") {
      _timetable = { entries: [], conflicts: [] };
      return NextResponse.json(_timetable);
    }

    if (body.action === "remove") {
      _timetable.entries = _timetable.entries.filter((e) => e.id !== body.entryId);
      _timetable.conflicts = detectConflicts(_timetable.entries);
      return NextResponse.json(_timetable);
    }

    if (body.action === "add") {
      const all = await loadAllCourses();
      const course = all.find(
        (c) => c.course_code === body.course_code && (body.session ? c.session.includes(body.session) : true)
      );
      if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

      const defaults = pickDefaultSectionCodes(course);
      const wanted = {
        lec: body.sections?.lec ?? defaults.lec,
        tut: body.sections?.tut ?? defaults.tut,
        pra: body.sections?.pra ?? defaults.pra,
      };

      const sectionCodes = [wanted.lec, wanted.tut, wanted.pra].filter(Boolean) as string[];
      if (sectionCodes.length === 0) {
        return NextResponse.json({ error: "No sections available to add" }, { status: 400 });
      }

      const newEntries: TimetableEntry[] = [];
      for (const code of sectionCodes) {
        const sec = course.sections.find((s) => s.section_code === code);
        if (!sec) continue;

        const entry = sectionToEntry(course, sec);
        const exists = _timetable.entries.some((e) => e.id === entry.id);
        if (!exists) newEntries.push(entry);
      }

      if (newEntries.length === 0) {
        return NextResponse.json({ ..._timetable, warning: "Those sections are already in your timetable" });
      }

      const next = [..._timetable.entries, ...newEntries];
      const conflicts = detectConflicts(next);
      _timetable = { entries: next, conflicts };

      const newlyAddedIds = new Set(newEntries.map((e) => e.id));
      const hasNewConflict = conflicts.some((c) => newlyAddedIds.has(c.a.id) || newlyAddedIds.has(c.b.id));

      return NextResponse.json({
        ..._timetable,
        ...(hasNewConflict ? { warning: "Added, but it conflicts with your timetable" } : {}),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
