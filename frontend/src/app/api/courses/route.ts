import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { Course } from "@/types/course";

// Cache the parsed data in module scope (survives hot reloads in dev)
let _cache: Course[] | null = null;

async function loadCourses(): Promise<Course[]> {
  if (_cache) return _cache;
  const filePath = path.join(
    process.cwd(),
    "..",
    "ingestion",
    "raw_data",
    "timetable_full.json"
  );
  const raw = await fs.readFile(filePath, "utf-8");
  _cache = JSON.parse(raw) as Course[];
  return _cache;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").toLowerCase().trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("pageSize") || "12", 10))
    );
    const session = searchParams.get("session") || "";

    let courses = await loadCourses();

    // Filter out malformed entries
    courses = courses.filter((c) => c.course_code && c.title);

    // Session filter
    if (session) {
      courses = courses.filter((c) => c.session?.includes(session));
    }

    // Search filter
    if (q) {
      courses = courses.filter(
        (c) =>
          c.course_code.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q)
      );
    }

    const total = courses.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const items = courses.slice(start, start + pageSize);

    return NextResponse.json({ items, total, page, totalPages, pageSize });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load courses" },
      { status: 500 }
    );
  }
}
