# Tutorial: Phase 5 — Schedule Generator (Backend Algorithm + Frontend UI)

This tutorial walks you through how we built the **automatic schedule generation** feature — a backend Python algorithm that finds conflict-free timetables, and a React frontend that lets users pick courses and view generated schedules.

---

## What We're Building

A user picks courses they want (e.g., MAT223, CSC108). Our system:
1. Loads all available sections (LEC/TUT/PRA) for each course
2. Generates every valid combination of sections across courses
3. Filters out any combination with time conflicts
4. Scores and ranks schedules by seat availability
5. Returns warnings for full or waitlisted sections

---

## Core Concept: Cartesian Product for Scheduling

The key algorithm is the **cartesian product**. For each course, a student must pick one section of each type (LEC, TUT, PRA). The algorithm generates every possible combination across all courses.

**Example:** If you want MAT223 and CSC108:
- MAT223 has 3 LEC options and 5 TUT options → 15 combos per course
- CSC108 has 2 LEC options and 4 TUT options → 8 combos per course
- Cross-course combinations: 15 × 8 = **120 total schedules** to check

We filter these 120 down to only the ones with **zero time conflicts**.

```python
from itertools import product

# For each course, build a list of section combos
# (one LEC choice, one TUT choice, etc.)
course_combos = [
    [(lec1, tut1), (lec1, tut2), (lec2, tut1), ...],  # MAT223
    [(lec1, tut1), (lec1, tut2), ...],                  # CSC108
]

# Cartesian product across courses
for cross_combo in product(*course_combos):
    flat_sections = [sec for combo in cross_combo for sec in combo]
    if not has_conflict(flat_sections):
        valid_schedules.append(flat_sections)
```

---

## Step 1: Time Conflict Detection

Two meetings conflict if they are on the **same day** and their time ranges **overlap**.

```python
def _parse_time(t: str) -> int | None:
    """Convert '10:00 AM' → 600 (minutes since midnight)."""
    # Parse hour:minute AM/PM format
    ...
    return hour * 60 + minute

def _meetings_conflict(meetings_a, meetings_b) -> bool:
    for ma in meetings_a:
        for mb in meetings_b:
            if ma['day'] != mb['day']:
                continue
            a_start = _parse_time(ma['start_time'])
            a_end = _parse_time(ma['end_time'])
            b_start = _parse_time(mb['start_time'])
            b_end = _parse_time(mb['end_time'])
            # Two ranges overlap if: a_start < b_end AND b_start < a_end
            if a_start < b_end and b_start < a_end:
                return True
    return False
```

**Key insight:** Two time ranges `[A_start, A_end)` and `[B_start, B_end)` overlap if and only if `A_start < B_end AND B_start < A_end`. This is a classic interval overlap check.

---

## Step 2: Scoring Schedules

Not all valid schedules are equal. We rank them by **enrollment availability** — students prefer sections with open seats!

```python
def _score_schedule(sections) -> float:
    score = 0.0
    for sec in sections:
        capacity = sec['availability']['capacity']
        enrolled = sec['availability']['enrolled']
        if capacity > 0:
            fill_ratio = enrolled / capacity
            score += (1.0 - fill_ratio) * 10  # More open seats = higher score
        score -= sec.get('waitlist_count', 0) * 0.5  # Penalize waitlists
        if sec.get('cancelled'):
            score -= 100  # Heavily penalize cancelled sections
    return score
```

---

## Step 3: FastAPI Endpoint

We expose the algorithm via a REST API endpoint:

```python
# backend/api/schedule.py
from fastapi import APIRouter
from pydantic import BaseModel

class ScheduleRequest(BaseModel):
    course_codes: list[str]      # ["MAT223H1", "CSC108H1"]
    session: str | None = None   # Optional: "20259" for Fall 2025
    max_schedules: int = 5       # Return top 5 schedules

router = APIRouter(prefix="/api/schedule")

@router.post("/generate")
async def generate_schedule(request: ScheduleRequest):
    result = generate_schedules(
        course_codes=request.course_codes,
        session=request.session,
        max_schedules=request.max_schedules,
    )
    return result
```

**Test it with cURL:**
```bash
curl -X POST http://localhost:8000/api/schedule/generate \
  -H "Content-Type: application/json" \
  -d '{"course_codes": ["MAT223H1", "CSC108H1"], "max_schedules": 3}'
```

---

## Step 4: Frontend — Schedule Generator Page

We built a React page at `/generate` with these components:

### 4a. Course Wishlist Builder
Users search for courses with autocomplete. Selected courses appear as removable "pills":

```tsx
const [wishlist, setWishlist] = useState<{code: string; title: string}[]>([]);

function addCourse(code: string, title: string) {
  if (wishlist.some(w => w.code === code)) return;
  setWishlist(prev => [...prev, { code, title }]);
}
```

### 4b. Calling the Backend
One button press triggers the generation:

```tsx
async function generateSchedules() {
  const res = await fetch("http://localhost:8000/api/schedule/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      course_codes: wishlist.map(w => w.code),
      max_schedules: 5,
    }),
  });
  const data = await res.json();
  setResult(data);
}
```

### 4c. Mini Weekly Calendar
Each schedule is previewed on a mini Mon–Fri calendar grid. Course blocks are positioned using CSS `absolute` positioning based on parsed meeting times:

```tsx
const top = ((startMinutes - 8 * 60) / 60) * HOUR_HEIGHT;
const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
```

### 4d. Enrollment Warnings
The UI shows colored badges for enrollment status:
- 🔴 **FULL** — section at capacity
- 🟡 **Almost full** — ≥85% enrolled
- ⚠️ **Cancelled** — section was cancelled

---

## File Summary

| File | Purpose |
|------|---------|
| `backend/services/scheduler.py` | Core algorithm: conflict detection, cartesian product, scoring |
| `backend/api/schedule.py` | FastAPI endpoint: `POST /api/schedule/generate` |
| `backend/main.py` | Wires the schedule router into the app |
| `frontend/src/app/generate/page.tsx` | React UI: wishlist builder, generate button, schedule viewer |

---

## Key Takeaways

1. **Cartesian product** is the fundamental technique for generating all possible schedule combinations
2. **Interval overlap** (`a_start < b_end AND b_start < a_end`) is the standard way to detect time conflicts
3. **Scoring** lets us rank schedules by real-world desirability (open seats, no waitlists)
4. The frontend sends one API call and receives pre-ranked, pre-validated schedules — keeping the UI logic simple
