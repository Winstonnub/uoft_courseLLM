import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { Course } from "@/types/course";

let _cache: { course_code: string; title: string }[] | null = null;

async function loadSuggestions() {
  if (_cache) return _cache;
  const filePath = path.join(
    process.cwd(),
    "..",
    "ingestion",
    "raw_data",
    "timetable_full.json"
  );
  const raw = await fs.readFile(filePath, "utf-8");
  const all = JSON.parse(raw) as Course[];
  // Deduplicate by course_code (strip session suffix for display)
  const seen = new Set<string>();
  _cache = all
    .filter((c) => c.course_code && c.title)
    .filter((c) => {
      if (seen.has(c.course_code)) return false;
      seen.add(c.course_code);
      return true;
    })
    .map((c) => ({ course_code: c.course_code, title: c.title }));
  return _cache;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const all = await loadSuggestions();
  const results = all
    .filter(
      (c) =>
        c.course_code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q)
    )
    .slice(0, 10);

  return NextResponse.json(results);
}
