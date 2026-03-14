"""
Schedule Generator Service

Accepts a list of course codes, loads their sections from timetable_full.json,
and generates all valid (non-conflicting) combinations of LEC/TUT/PRA sections.

Returns up to `max_schedules` valid schedules ranked by enrollment availability,
along with warnings about full/waitlisted sections.
"""

import json
import os
import re
from itertools import product
from typing import List, Dict, Any, Optional, Tuple

DATA_PATH = os.path.join(
    os.path.dirname(__file__), '..', '..', 'ingestion', 'raw_data', 'timetable_full.json'
)

_courses_cache: Optional[List[Dict]] = None

def _load_courses() -> List[Dict]:
    global _courses_cache
    if _courses_cache is None:
        with open(DATA_PATH, 'r', encoding='utf-8') as f:
            _courses_cache = json.load(f)
    return _courses_cache

def _parse_time(t: str) -> Optional[int]:
    """Convert '10:00 AM' to minutes since midnight (600)."""
    if not t or t == "TBA":
        return None
    m = re.match(r'(\d{1,2}):(\d{2})\s*(AM|PM)', t, re.IGNORECASE)
    if not m:
        return None
    hour, minute, ampm = int(m[1]), int(m[2]), m[3].upper()
    if ampm == "AM" and hour == 12:
        hour = 0
    elif ampm == "PM" and hour != 12:
        hour += 12
    return hour * 60 + minute

def _meetings_conflict(meetings_a: List[Dict], meetings_b: List[Dict]) -> bool:
    """Check if any two meetings overlap in time on the same day."""
    for ma in meetings_a:
        for mb in meetings_b:
            if not ma.get('day') or not mb.get('day'):
                continue
            if ma['day'] != mb['day']:
                continue
            a_start = _parse_time(ma.get('start_time', ''))
            a_end = _parse_time(ma.get('end_time', ''))
            b_start = _parse_time(mb.get('start_time', ''))
            b_end = _parse_time(mb.get('end_time', ''))
            if None in (a_start, a_end, b_start, b_end):
                continue
            if a_start < b_end and b_start < a_end:
                return True
    return False

def _schedule_has_conflict(sections: List[Dict]) -> bool:
    """Check if a list of sections has any internal time conflicts."""
    for i in range(len(sections)):
        for j in range(i + 1, len(sections)):
            if _meetings_conflict(
                sections[i].get('meetings', []),
                sections[j].get('meetings', [])
            ):
                return True
    return False

def _score_schedule(sections: List[Dict]) -> float:
    """
    Score a schedule. Higher = better.
    Prefers sections with more available seats and fewer waitlisted students.
    """
    score = 0.0
    for sec in sections:
        avail = sec.get('availability', {})
        capacity = avail.get('capacity', 0)
        enrolled = avail.get('enrolled', 0)
        waitlist = sec.get('waitlist_count', 0)
        if capacity > 0:
            fill_ratio = enrolled / capacity
            score += (1.0 - fill_ratio) * 10  # reward open seats
        score -= waitlist * 0.5  # penalize waitlisted sections
        if sec.get('cancelled', False):
            score -= 100  # heavily penalize cancelled sections
    return score

def _generate_warnings(sections: List[Dict]) -> List[Dict[str, str]]:
    """Generate enrollment-related warnings for a schedule."""
    warnings = []
    for sec in sections:
        avail = sec.get('availability', {})
        capacity = avail.get('capacity', 0)
        enrolled = avail.get('enrolled', 0)
        waitlist = sec.get('waitlist_count', 0)
        code = sec.get('section_code', '?')
        course = sec.get('_course_code', '?')

        if sec.get('cancelled', False):
            warnings.append({
                "type": "cancelled",
                "section": f"{course} {code}",
                "message": f"⚠️ {course} {code} is **cancelled**."
            })
        elif capacity > 0 and enrolled >= capacity:
            msg = f"🔴 {course} {code} is **full** ({enrolled}/{capacity})"
            if waitlist > 0:
                msg += f" with {waitlist} on **waitlist**"
            warnings.append({"type": "full", "section": f"{course} {code}", "message": msg})
        elif capacity > 0 and (enrolled / capacity) >= 0.85:
            warnings.append({
                "type": "almost_full",
                "section": f"{course} {code}",
                "message": f"🟡 {course} {code} is **almost full** ({enrolled}/{capacity})"
            })
    return warnings


def find_course(course_code: str, session: str = None) -> Optional[Dict]:
    """Find a course by code from the timetable data."""
    courses = _load_courses()
    # Normalize: the JSON uses codes like "CSC110Y1F" (with session suffix)
    code_upper = course_code.upper()
    for c in courses:
        c_code = c.get('course_code', '').upper()
        if c_code == code_upper:
            if session and session not in c.get('session', ''):
                continue
            return c
        # Also try partial match (e.g. user types CSC110Y1, data has CSC110Y1F)
        if c_code.startswith(code_upper):
            if session and session not in c.get('session', ''):
                continue
            return c
    return None


def generate_schedules(
    course_codes: List[str],
    session: str = None,
    max_schedules: int = 5
) -> Dict[str, Any]:
    """
    Main entry point.

    Args:
        course_codes: List of course codes the user wants (e.g. ["CSC108H1", "MAT137Y1"])
        session: Optional session filter (e.g. "20259" for Fall 2025)
        max_schedules: Maximum number of schedules to return

    Returns:
        {
            "schedules": [...],
            "warnings": [...],
            "errors": [...]
        }
    """
    errors = []
    course_section_groups = []  # One entry per course: list of "section combos"

    for code in course_codes:
        course = find_course(code, session)
        if not course:
            errors.append(f"Course '{code}' not found in the timetable data.")
            continue

        sections = course.get('sections', [])
        if not sections:
            errors.append(f"Course '{code}' has no sections available.")
            continue

        # Group sections by type
        by_type: Dict[str, List[Dict]] = {}
        for sec in sections:
            sec_type = sec.get('type', 'OTHER')
            if sec.get('cancelled', False):
                continue  # Skip cancelled sections
            by_type.setdefault(sec_type, [])
            # Tag each section with its parent course code for warnings
            sec_copy = {**sec, '_course_code': course['course_code'], '_title': course.get('title', '')}
            by_type[sec_type].append(sec_copy)

        # Build all possible combos: pick one of each required type
        # E.g. if course has LEC + TUT, combo = (one LEC choice, one TUT choice)
        type_options = []
        for sec_type in sorted(by_type.keys()):
            type_options.append(by_type[sec_type])

        if not type_options:
            errors.append(f"Course '{code}' has no non-cancelled sections.")
            continue

        # Cartesian product of section choices for this course
        combos = list(product(*type_options))
        course_section_groups.append({
            'course_code': course['course_code'],
            'title': course.get('title', ''),
            'combos': combos
        })

    if not course_section_groups:
        return {"schedules": [], "warnings": [], "errors": errors}

    # Now generate cross-course combinations
    # For performance, cap the search space
    all_combos = [g['combos'] for g in course_section_groups]
    total_combos = 1
    for c in all_combos:
        total_combos *= len(c)

    # If combinatorial explosion, trim each course's options
    MAX_COMBOS = 50000
    if total_combos > MAX_COMBOS:
        # Limit each course to top 10 combos by score
        for g in course_section_groups:
            scored = sorted(g['combos'], key=lambda combo: sum(_score_schedule(list(combo)) for _ in [1]), reverse=True)
            g['combos'] = scored[:10]
        all_combos = [g['combos'] for g in course_section_groups]

    valid_schedules = []

    for cross_combo in product(*all_combos):
        # cross_combo is a tuple of tuples: ((LEC, TUT) for course1, (LEC, TUT) for course2, ...)
        flat_sections = []
        for course_combo in cross_combo:
            flat_sections.extend(course_combo)

        if not _schedule_has_conflict(flat_sections):
            score = _score_schedule(flat_sections)
            warnings = _generate_warnings(flat_sections)
            valid_schedules.append({
                'sections': flat_sections,
                'score': score,
                'warnings': warnings,
            })

    # Sort by score (descending) and return top N
    valid_schedules.sort(key=lambda s: s['score'], reverse=True)
    top_schedules = valid_schedules[:max_schedules]

    # Format for API response
    formatted = []
    for sched in top_schedules:
        entries = []
        for sec in sched['sections']:
            entries.append({
                'course_code': sec.get('_course_code', ''),
                'title': sec.get('_title', ''),
                'section_code': sec.get('section_code', ''),
                'type': sec.get('type', ''),
                'instructors': sec.get('instructors', []),
                'meetings': sec.get('meetings', []),
                'availability': sec.get('availability', {}),
                'waitlist_count': sec.get('waitlist_count', 0),
                'delivery_mode': sec.get('delivery_mode', ''),
            })
        formatted.append({
            'entries': entries,
            'score': round(sched['score'], 2),
            'warnings': sched['warnings'],
        })

    return {
        "schedules": formatted,
        "total_valid": len(valid_schedules),
        "errors": errors,
    }
