# Phase 6 Tutorial: Backtracking Scheduler, Glassmorphism & Time Preferences

This tutorial explains the core concepts implemented in Phase 6.

---

## 1. Backtracking Search (replacing brute-force)

### The Problem
With 9 courses, each having dozens of section combinations, the total cartesian product can exceed **5 billion** permutations. Iterating through even a fraction hangs the server.

### The Solution: Recursive Backtracking
Instead of generating ALL combinations and then checking conflicts, we build the schedule **one course at a time** and immediately skip branches that conflict.

```python
def backtrack(idx, fall_so_far, winter_so_far):
    if idx == len(all_groups):
        # All courses placed — valid schedule!
        valid_schedules.append(...)
        return

    group = all_groups[idx]
    for combo in group['combos']:
        sections = list(combo)

        # Check ONLY against already-placed sections
        if _new_sections_conflict(sections, fall_so_far):
            continue  # Prune this entire branch!

        # No conflict — place and recurse
        backtrack(idx + 1, fall_so_far + sections, winter_so_far)
```

**Why it's fast**: If course #3 conflicts with course #1, we skip ALL combinations of courses #4-9 instantly. This is exponentially faster than checking every single combination.

**Key optimizations**:
- Pre-sort combos by score (best first) so the best schedules are found early
- Limit to top-15 combos per course to cap the tree size
- Safety limits: 500k node visits and collect limit to prevent runaway execution

---

## 2. Glassmorphism CSS Design System

Glassmorphism creates a "frosted glass" effect using three CSS properties:

```css
.glass {
  background: rgba(255, 255, 255, 0.05);   /* Semi-transparent background */
  backdrop-filter: blur(20px);              /* Blur what's behind the element */
  border: 1px solid rgba(255, 255, 255, 0.1); /* Subtle border for depth */
}
```

### Animated background blobs
We place large, blurred divs behind the content and animate them:

```css
@keyframes blob {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%      { transform: translate(30px, -50px) scale(1.1); }
  66%      { transform: translate(-20px, 20px) scale(0.9); }
}

.animate-blob {
  animation: blob 7s infinite;
}
```

These create a living, dynamic background that makes the glass panels pop.

---

## 3. Time Preference Scoring

The scoring system works by calculating the **average start time** of all meetings in a schedule, then applying a bonus based on the user's preference:

```python
avg_start = sum(start_minutes) / len(start_minutes)

if time_preference == 'early':
    # 8:00 AM (480 min) is ideal → higher bonus for earlier starts
    score += max(0, (900 - avg_start) / 28)

elif time_preference == 'late':
    # 3:00 PM (900 min) is ideal → higher bonus for later starts
    score += max(0, (avg_start - 480) / 28)

else:  # balanced
    # Noon (720 min) is ideal → penalize deviation from midday
    deviation = abs(avg_start - 720)
    score += max(0, (240 - deviation) / 16)
```

This is **blended** with the existing availability score, so preferences influence ranking without overriding schedule viability. A schedule with open seats will still beat one with full sections, but among equally-available schedules, your time preference determines the order.

---

## 4. Frontend Time Preference Toggle

The toggle is a simple React state that gets sent in the API request:

```tsx
const [timePreference, setTimePreference] = useState<'early' | 'balanced' | 'late'>('balanced');

// In the API call:
body: JSON.stringify({
  course_codes: wishlist.map(w => w.code),
  time_preference: timePreference,
})
```

The UI uses three styled buttons with icons from `lucide-react` (Sun, Clock, Moon), with the active option highlighted in emerald green.
