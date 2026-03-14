"""
scrape_ttb_full.py

Scrapes UofT Timetable Builder data by calling the internal
api.easi.utoronto.ca/ttb/getPageableCourses JSON API directly with requests.

This is faster and more reliable than Playwright HTML scraping because:
- The API returns fully structured JSON with all fields (no accordion clicking needed)
- Supports pagination natively via page/pageSize params
- Includes cmCourseInfo with description, prerequisites, exclusions, etc.

Output matches course_schema.json exactly.

Usage:
    python3 scrape_ttb_full.py                          # all ARTSC Fall+Winter 2025-26
    python3 scrape_ttb_full.py --code CSC311            # single course
    python3 scrape_ttb_full.py --dept CSC               # whole CS department
    python3 scrape_ttb_full.py --division ARTSC --sessions 20259 20261
"""

import requests
import json
import os
import re
import argparse
import time
from bs4 import BeautifulSoup

# ── Config ────────────────────────────────────────────────────────────────────
API_URL   = "https://api.easi.utoronto.ca/ttb/getPageableCourses"
PAGE_SIZE = 20   # TTB default; max observed is 20
DELAY     = 0.3  # seconds between requests (be polite)

# Sessions: 20259 = Fall 2025, 20261 = Winter 2026, 20259-20261 = Full Year
DEFAULT_SESSIONS  = ["20259", "20261", "20259-20261"]
DEFAULT_DIVISIONS = ["ARTSC"]

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "raw_data", "timetable_full.json")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://ttb.utoronto.ca",
    "Referer": "https://ttb.utoronto.ca/",
}

# ── Day mapping ───────────────────────────────────────────────────────────────
# TTB API uses 1-based weekday integers (1=Monday ... 5=Friday)
DAY_MAP = {1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday"}

DELIVERY_MAP = {
    "INPER": "In Person",
    "ONLSYNC": "Online Synchronous",
    "ONLASYNC": "Online Asynchronous",
    "HYBR": "Hybrid",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def ms_to_time(ms: int) -> str:
    """Convert milliseconds-of-day to 'H:MM AM/PM' string."""
    total_minutes = ms // 60000
    hours, minutes = divmod(total_minutes, 60)
    period = "AM" if hours < 12 else "PM"
    display_hour = hours % 12 or 12
    return f"{display_hour}:{minutes:02d} {period}"


def strip_html(raw: str) -> str:
    """Strip HTML tags from a string (used for prerequisites/exclusions text)."""
    if not raw:
        return ""
    return BeautifulSoup(raw, "html.parser").get_text(" ", strip=True)


# ── Normalise one raw API course → course_schema.json shape ──────────────────

def normalise_course(raw: dict) -> dict:
    """
    Map a single course object from the TTB API response to our course_schema.json shape.
    """
    cm = raw.get("cmCourseInfo") or {}

    # ── Course-level fields ────────────────────────────────────────────────
    course_code = (raw.get("code") or "") + (raw.get("sectionCode") or "")
    title       = cm.get("title") or raw.get("name") or ""
    description = cm.get("description") or ""
    prerequisites  = strip_html(cm.get("prerequisitesText") or "")
    corequisites   = strip_html(cm.get("corequisitesText") or "")
    exclusions     = strip_html(cm.get("exclusionsText") or "")

    breadth_reqs = ", ".join(cm.get("breadthRequirements") or [])
    campus       = raw.get("campus") or ""
    sessions     = raw.get("sessions") or []
    session_str  = ", ".join(sessions)

    # Course-level note
    course_notes = " ".join(
        n.get("content", "") for n in (raw.get("notes") or [])
        if n.get("type") == "COURSE" and n.get("content")
    )

    # ── Sections ──────────────────────────────────────────────────────────
    sections = []
    for sec in raw.get("sections") or []:
        sec_code     = sec.get("name") or ""
        teach_method = sec.get("teachMethod") or sec_code[:3]

        # Instructors
        instructors = [
            f"{i.get('firstName', '')} {i.get('lastName', '')}".strip()
            for i in (sec.get("instructors") or [])
            if i.get("firstName") or i.get("lastName")
        ]

        # Availability
        availability = {
            "enrolled": sec.get("currentEnrolment") or 0,
            "capacity": sec.get("maxEnrolment") or 0,
        }

        waitlist_count = sec.get("currentWaitlist") or 0

        # Delivery mode (use first entry)
        delivery_raw = ""
        dm_list = sec.get("deliveryModes") or []
        if dm_list:
            delivery_raw = dm_list[0].get("mode") or ""
        delivery_mode = DELIVERY_MAP.get(delivery_raw, delivery_raw)

        # Cancelled
        cancelled = (sec.get("cancelInd") or "N").upper() == "Y"

        # Enrolment indicator (P, R1, E, etc.)
        enrol_ind = sec.get("enrolmentInd") or ""
        enrolment_controls = [enrol_ind] if enrol_ind else []

        # Section note
        sec_note = " ".join(
            n.get("content", "") for n in (sec.get("notes") or [])
            if n.get("type") == "SECTION" and n.get("content")
        )

        # ── Meetings ──────────────────────────────────────────────────────
        meetings = []
        for mt in sec.get("meetingTimes") or []:
            day_int   = (mt.get("start") or {}).get("day")
            start_ms  = (mt.get("start") or {}).get("millisofday")
            end_ms    = (mt.get("end") or {}).get("millisofday")
            building  = (mt.get("building") or {})
            bld_code  = building.get("buildingCode") or "TBA"
            room_num  = building.get("buildingRoomNumber") or ""
            location  = (bld_code + room_num).strip() or "TBA"

            day_name   = DAY_MAP.get(day_int, f"Day{day_int}") if day_int else "TBA"
            start_time = ms_to_time(start_ms) if start_ms is not None else "TBA"
            end_time   = ms_to_time(end_ms)   if end_ms   is not None else "TBA"

            meetings.append({
                "day":        day_name,
                "start_time": start_time,
                "end_time":   end_time,
                "location":   location,
            })

        sections.append({
            "section_code":       sec_code,
            "type":               teach_method,
            "instructors":        instructors,
            "availability":       availability,
            "waitlist_count":     waitlist_count,
            "enrolment_controls": enrolment_controls,
            "delivery_mode":      delivery_mode,
            "cancelled":          cancelled,
            "notes":              sec_note,
            "meetings":           meetings,
        })

    return {
        "course_code":        course_code,
        "title":              title,
        "description":        description,
        "prerequisites":      prerequisites,
        "corequisites":       corequisites,
        "exclusions":         exclusions,
        "breadth_requirements": breadth_reqs,
        "campus":             campus,
        "session":            session_str,
        "notes":              course_notes,
        "sections":           sections,
    }


# ── API pagination ────────────────────────────────────────────────────────────

def build_payload(
    course_code: str = "",
    dept: str = "",
    sessions: list[str] = None,
    divisions: list[str] = None,
    page: int = 1,
) -> dict:
    return {
        "courseCodeAndTitleProps": {
            "courseCode":            "",
            "courseTitle":           course_code + (" " if course_code else ""),
            "courseSectionCode":     "",
            "searchCourseDescription": True,
        },
        "departmentProps": [{"code": dept, "name": dept}] if dept else [],
        "campuses":        [],
        "sessions":        sessions or DEFAULT_SESSIONS,
        "requirementProps": [],
        "instructor":      "",
        "courseLevels":    [],
        "deliveryModes":   [],
        "dayPreferences":  [],
        "timePreferences": [],
        "divisions":       divisions or DEFAULT_DIVISIONS,
        "creditWeights":   [],
        "availableSpace":  False,
        "waitListable":    False,
        "page":            page,
        "pageSize":        PAGE_SIZE,
        "direction":       "asc",
    }


def fetch_all_pages(
    course_code: str = "",
    dept: str = "",
    sessions: list[str] = None,
    divisions: list[str] = None,
) -> list[dict]:
    """
    Fetch all pages from the TTB API and return a flat list of normalised courses.
    """
    all_courses: list[dict] = []
    page = 1
    total = None

    session = requests.Session()
    session.headers.update(HEADERS)

    while True:
        payload = build_payload(
            course_code=course_code,
            dept=dept,
            sessions=sessions,
            divisions=divisions,
            page=page,
        )

        print(f"  Fetching page {page}" + (f" / {((total or 1) + PAGE_SIZE - 1) // PAGE_SIZE}" if total else "") + " ...")

        try:
            resp = session.post(API_URL, json=payload, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"  ✗ Request failed on page {page}: {e}")
            break

        pageable = (data.get("payload") or {}).get("pageableCourse") or {}
        raw_courses = pageable.get("courses") or []
        total = pageable.get("total") or 0

        if not raw_courses:
            print("  No courses returned — done.")
            break

        for raw in raw_courses:
            course = normalise_course(raw)
            all_courses.append(course)
            print(f"    ✓ {course['course_code']}  {course['title']}")

        fetched_so_far = (page - 1) * PAGE_SIZE + len(raw_courses)
        if fetched_so_far >= total:
            print(f"  All {total} course(s) fetched.")
            break

        page += 1
        time.sleep(DELAY)

    return all_courses


# ── Entry Point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Scrape UofT TTB API → JSON (course_schema.json format)")
    parser.add_argument("--code",      default="",                   help="Course code/title filter (e.g. CSC311)")
    parser.add_argument("--dept",      default="",                   help="Department filter (e.g. CSC)")
    parser.add_argument("--divisions", default=["ARTSC"], nargs="+", help="Division codes (default: ARTSC)")
    parser.add_argument("--sessions",  default=DEFAULT_SESSIONS, nargs="+",
                        help="Session codes (default: 20259 20261 20259-20261)")
    parser.add_argument("--out",       default=OUTPUT_PATH,          help="Output JSON file path")
    args = parser.parse_args()

    print("=" * 60)
    print("UofT TTB API Scraper")
    print(f"  code={args.code or '(all)'}  dept={args.dept or '(all)'}")
    print(f"  divisions={args.divisions}  sessions={args.sessions}")
    print("=" * 60)

    courses = fetch_all_pages(
        course_code=args.code,
        dept=args.dept,
        sessions=args.sessions,
        divisions=args.divisions,
    )

    out_path = args.out
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(courses, f, indent=2, ensure_ascii=False)

    print(f"\n✅  Scraped {len(courses)} course(s)  →  {out_path}")


if __name__ == "__main__":
    main()
