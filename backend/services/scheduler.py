"""
Session-Aware Schedule Generator

Produces SEPARATE Fall and Winter timetables.
Full-year (Y) courses are locked to the same section in both semesters.

Course code suffixes:
  F → Fall only   (session "20259")
  S → Winter only (session "20261")
  Y → Full year   (session "20259, 20261")
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
    for ma in meetings_a:
        for mb in meetings_b:
            if not ma.get('day') or not mb.get('day') or ma['day'] != mb['day']:
                continue
            a_s, a_e = _parse_time(ma.get('start_time', '')), _parse_time(ma.get('end_time', ''))
            b_s, b_e = _parse_time(mb.get('start_time', '')), _parse_time(mb.get('end_time', ''))
            if None in (a_s, a_e, b_s, b_e):
                continue
            if a_s < b_e and b_s < a_e:
                return True
    return False


def _schedule_has_conflict(sections: List[Dict]) -> bool:
    for i in range(len(sections)):
        for j in range(i + 1, len(sections)):
            if _meetings_conflict(sections[i].get('meetings', []), sections[j].get('meetings', [])):
                return True
    return False


def _score_schedule(sections: List[Dict], time_preference: str = 'balanced') -> float:
    score = 0.0
    for sec in sections:
        avail = sec.get('availability', {})
        cap = avail.get('capacity', 0)
        enr = avail.get('enrolled', 0)
        if cap > 0:
            score += (1.0 - enr / cap) * 10
        score -= sec.get('waitlist_count', 0) * 0.5
        if sec.get('cancelled', False):
            score -= 100

    # ── Time preference bonus ──
    # Collect all meeting start times across all sections
    start_minutes = []
    for sec in sections:
        for m in sec.get('meetings', []):
            t = _parse_time(m.get('start_time', ''))
            if t is not None:
                start_minutes.append(t)

    if start_minutes:
        avg_start = sum(start_minutes) / len(start_minutes)
        if time_preference == 'early':
            # Reward earlier classes: 8:00AM=480 is ideal
            # Max bonus ~15 points for avg start at 8AM, 0 for 3PM+
            score += max(0, (900 - avg_start) / 28)
        elif time_preference == 'late':
            # Reward later classes: 3PM=900 or later is ideal
            score += max(0, (avg_start - 480) / 28)
        else:  # balanced
            # Reward midday: 10AM-2PM ideal range (600-840)
            midpoint = 720  # noon
            deviation = abs(avg_start - midpoint)
            score += max(0, (240 - deviation) / 16)

    return score


def _generate_warnings(sections: List[Dict]) -> List[Dict[str, str]]:
    warnings = []
    for sec in sections:
        avail = sec.get('availability', {})
        cap, enr = avail.get('capacity', 0), avail.get('enrolled', 0)
        wl = sec.get('waitlist_count', 0)
        label = f"{sec.get('_course_code', '?')} {sec.get('section_code', '?')}"
        if sec.get('cancelled', False):
            warnings.append({"type": "cancelled", "section": label, "message": f"⚠️ {label} is **cancelled**."})
        elif cap > 0 and enr >= cap:
            msg = f"🔴 {label} is **full** ({enr}/{cap})"
            if wl > 0:
                msg += f" with {wl} on **waitlist**"
            warnings.append({"type": "full", "section": label, "message": msg})
        elif cap > 0 and (enr / cap) >= 0.85:
            warnings.append({"type": "almost_full", "section": label, "message": f"🟡 {label} is **almost full** ({enr}/{cap})"})
    return warnings


def _get_course_term(course: Dict) -> str:
    """Determine F, S, or Y from course code suffix."""
    code = course.get('course_code', '')
    if code.endswith('Y'):
        return 'Y'
    elif code.endswith('F'):
        return 'F'
    elif code.endswith('S'):
        return 'S'
    # Fallback: check session string
    sess = course.get('session', '')
    if '20259' in sess and '20261' in sess:
        return 'Y'
    elif '20259' in sess:
        return 'F'
    return 'S'


def find_course(course_code: str) -> Optional[Dict]:
    courses = _load_courses()
    code_upper = course_code.upper()
    for c in courses:
        c_code = c.get('course_code', '').upper()
        if c_code == code_upper or c_code.startswith(code_upper):
            return c
    return None


def _dedup_meetings(meetings: List[Dict]) -> List[Dict]:
    """Remove duplicate meetings (Y courses list each meeting twice, one per semester).
    Dedup by day+time only — different rooms for the same slot are still the same class."""
    seen = set()
    result = []
    for m in meetings:
        key = (m.get('day', ''), m.get('start_time', ''), m.get('end_time', ''))
        if key not in seen:
            seen.add(key)
            result.append(m)
    return result


def _build_section_combos(course: Dict) -> List[Tuple[Dict, ...]]:
    """Build all (LEC, TUT, PRA, ...) combos for one course, skipping cancelled
    sections and combos with internal time conflicts."""
    sections = course.get('sections', [])
    by_type: Dict[str, List[Dict]] = {}
    for sec in sections:
        if sec.get('cancelled', False):
            continue
        sec_type = sec.get('type', 'OTHER')
        # Deduplicate meetings (Y courses have them listed twice)
        deduped = _dedup_meetings(sec.get('meetings', []))
        tagged = {
            **sec,
            'meetings': deduped,
            '_course_code': course['course_code'],
            '_title': course.get('title', ''),
            '_term': _get_course_term(course),
        }
        by_type.setdefault(sec_type, []).append(tagged)
    if not by_type:
        return []

    all_combos = list(product(*[by_type[t] for t in sorted(by_type.keys())]))

    # Filter out combos where sections WITHIN this course conflict
    # (e.g., LEC and TUT at the same time)
    valid_combos = []
    for combo in all_combos:
        has_internal_conflict = False
        secs = list(combo)
        for i in range(len(secs)):
            for j in range(i + 1, len(secs)):
                if _meetings_conflict(secs[i].get('meetings', []), secs[j].get('meetings', [])):
                    has_internal_conflict = True
                    break
            if has_internal_conflict:
                break
        if not has_internal_conflict:
            valid_combos.append(combo)

    return valid_combos


def generate_schedules(
    course_codes: List[str],
    max_schedules: int = 5,
    time_preference: str = 'balanced'
) -> Dict[str, Any]:
    """
    Generate session-aware, conflict-free schedules using backtracking.

    Returns separate fall and winter timetables for each valid combo.
    Full-year (Y) courses are locked to the same section across both semesters.
    """
    errors = []
    fall_courses = []
    winter_courses = []
    year_courses = []

    for code in course_codes:
        course = find_course(code)
        if not course:
            errors.append(f"Course '{code}' not found in timetable data.")
            continue
        combos = _build_section_combos(course)
        if not combos:
            errors.append(f"Course '{code}' has no available sections.")
            continue

        term = _get_course_term(course)
        entry = {
            'course_code': course['course_code'],
            'title': course.get('title', ''),
            'term': term,
            'combos': combos,
        }

        if term == 'F':
            fall_courses.append(entry)
        elif term == 'S':
            winter_courses.append(entry)
        else:
            year_courses.append(entry)

    # Order: Y first (tightest constraints), then F, then S
    all_groups = year_courses + fall_courses + winter_courses
    if not all_groups:
        return {"schedules": [], "total_valid": 0, "errors": errors}

    # Sort combos within each course by score (best first)
    for g in all_groups:
        g['combos'] = sorted(
            g['combos'],
            key=lambda combo: _score_schedule(list(combo), time_preference),
            reverse=True,
        )
        # Keep top-15 combos per course to balance speed vs coverage
        g['combos'] = g['combos'][:15]

    # ── Backtracking search ──────────────────────────────────────────────
    # Instead of brute-force product, we add one course at a time and
    # immediately check if the new sections conflict with already-placed
    # sections. If they do, we prune that entire branch.

    COLLECT_LIMIT = max_schedules * 10
    valid_schedules: List[Dict] = []
    nodes_visited = 0
    MAX_NODES = 500_000  # safety cap

    def _new_sections_conflict(new_secs: List[Dict], existing_secs: List[Dict]) -> bool:
        """Check if any new section conflicts with any existing section."""
        for ns in new_secs:
            for es in existing_secs:
                if _meetings_conflict(ns.get('meetings', []), es.get('meetings', [])):
                    return True
        return False

    def backtrack(idx: int, fall_so_far: List[Dict], winter_so_far: List[Dict]):
        nonlocal nodes_visited
        if len(valid_schedules) >= COLLECT_LIMIT:
            return
        if nodes_visited > MAX_NODES:
            return

        if idx == len(all_groups):
            # All courses placed — this is a valid schedule
            score = _score_schedule(fall_so_far + winter_so_far, time_preference)
            valid_schedules.append({
                'fall_sections': list(fall_so_far),
                'winter_sections': list(winter_so_far),
                'score': score,
                'fall_warnings': _generate_warnings(fall_so_far),
                'winter_warnings': _generate_warnings(winter_so_far),
            })
            return

        group = all_groups[idx]
        term = group['term']

        for combo in group['combos']:
            nodes_visited += 1
            if nodes_visited > MAX_NODES:
                return
            if len(valid_schedules) >= COLLECT_LIMIT:
                return

            sections = list(combo)
            conflict = False

            if term == 'F':
                if _new_sections_conflict(sections, fall_so_far):
                    conflict = True
            elif term == 'S':
                if _new_sections_conflict(sections, winter_so_far):
                    conflict = True
            else:  # Y — must fit in BOTH semesters
                if _new_sections_conflict(sections, fall_so_far):
                    conflict = True
                elif _new_sections_conflict(sections, winter_so_far):
                    conflict = True

            if conflict:
                continue

            # Place this combo and recurse
            if term == 'F':
                backtrack(idx + 1, fall_so_far + sections, winter_so_far)
            elif term == 'S':
                backtrack(idx + 1, fall_so_far, winter_so_far + sections)
            else:  # Y
                backtrack(idx + 1, fall_so_far + sections, winter_so_far + sections)

    backtrack(0, [], [])

    # Sort by score
    valid_schedules.sort(key=lambda s: s['score'], reverse=True)
    top = valid_schedules[:max_schedules]

    def _fmt_entries(sections):
        return [{
            'course_code': s.get('_course_code', ''),
            'title': s.get('_title', ''),
            'term': s.get('_term', ''),
            'section_code': s.get('section_code', ''),
            'type': s.get('type', ''),
            'instructors': s.get('instructors', []),
            'meetings': s.get('meetings', []),
            'availability': s.get('availability', {}),
            'waitlist_count': s.get('waitlist_count', 0),
            'delivery_mode': s.get('delivery_mode', ''),
        } for s in sections]

    formatted = []
    for sched in top:
        formatted.append({
            'fall': _fmt_entries(sched['fall_sections']),
            'winter': _fmt_entries(sched['winter_sections']),
            'score': round(sched['score'], 2),
            'fall_warnings': sched['fall_warnings'],
            'winter_warnings': sched['winter_warnings'],
        })

    return {
        "schedules": formatted,
        "total_valid": len(valid_schedules),
        "errors": errors,
        "summary": {
            "fall_courses": [c['course_code'] for c in fall_courses],
            "winter_courses": [c['course_code'] for c in winter_courses],
            "year_courses": [c['course_code'] for c in year_courses],
        }
    }
