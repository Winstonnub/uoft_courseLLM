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


def _score_schedule(sections: List[Dict]) -> float:
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


def _build_section_combos(course: Dict) -> List[Tuple[Dict, ...]]:
    """Build all (LEC, TUT, PRA, ...) combos for one course, skipping cancelled."""
    sections = course.get('sections', [])
    by_type: Dict[str, List[Dict]] = {}
    for sec in sections:
        if sec.get('cancelled', False):
            continue
        sec_type = sec.get('type', 'OTHER')
        tagged = {**sec, '_course_code': course['course_code'], '_title': course.get('title', ''), '_term': _get_course_term(course)}
        by_type.setdefault(sec_type, []).append(tagged)
    if not by_type:
        return []
    return list(product(*[by_type[t] for t in sorted(by_type.keys())]))


def generate_schedules(
    course_codes: List[str],
    max_schedules: int = 5
) -> Dict[str, Any]:
    """
    Generate session-aware, conflict-free schedules.

    Returns separate fall_schedule and winter_schedule for each valid combo.
    Full-year (Y) courses are locked to the same section across both semesters.
    """
    errors = []
    fall_courses = []    # F courses
    winter_courses = []  # S courses
    year_courses = []    # Y courses (appear in BOTH)

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
        entry = {'course_code': course['course_code'], 'title': course.get('title', ''), 'term': term, 'combos': combos}

        if term == 'F':
            fall_courses.append(entry)
        elif term == 'S':
            winter_courses.append(entry)
        else:  # Y
            year_courses.append(entry)

    # Y courses must not conflict with F courses (fall) NOR S courses (winter)
    # AND use the same sections in both semesters.
    #
    # Strategy: generate cross-product of all course combos, then validate
    # that fall-side has no conflicts and winter-side has no conflicts.

    all_groups = year_courses + fall_courses + winter_courses
    if not all_groups:
        return {"schedules": [], "total_valid": 0, "errors": errors}

    # Cap combinatorial explosion
    MAX_COMBOS = 50000
    all_combo_lists = [g['combos'] for g in all_groups]
    total = 1
    for c in all_combo_lists:
        total *= len(c)
    if total > MAX_COMBOS:
        for g in all_groups:
            scored = sorted(g['combos'], key=lambda combo: _score_schedule(list(combo)), reverse=True)
            g['combos'] = scored[:10]
        all_combo_lists = [g['combos'] for g in all_groups]

    valid_schedules = []

    for cross_combo in product(*all_combo_lists):
        # Split sections into fall-side and winter-side
        fall_sections = []
        winter_sections = []

        for i, group in enumerate(all_groups):
            sections_chosen = list(cross_combo[i])
            term = group['term']
            if term == 'F':
                fall_sections.extend(sections_chosen)
            elif term == 'S':
                winter_sections.extend(sections_chosen)
            else:  # Y → appears in BOTH semesters with same meetings
                fall_sections.extend(sections_chosen)
                winter_sections.extend(sections_chosen)

        # Check conflicts independently for each semester
        if _schedule_has_conflict(fall_sections):
            continue
        if _schedule_has_conflict(winter_sections):
            continue

        score = _score_schedule(fall_sections + winter_sections)
        fall_warnings = _generate_warnings(fall_sections)
        winter_warnings = _generate_warnings(winter_sections)

        valid_schedules.append({
            'fall_sections': fall_sections,
            'winter_sections': winter_sections,
            'score': score,
            'fall_warnings': fall_warnings,
            'winter_warnings': winter_warnings,
        })

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
