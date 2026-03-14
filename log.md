# UofT AI Copilot Hackathon - Progress Log

**Branch**: `scraper`

---

## Copilot Change Log

| Date | Branch | Change Summary |
|------|--------|----------------|
| 2026-03-14 | `scraper` | Created and pushed new `scraper` branch from `winston`. |
| 2026-03-14 | `scraper` | Merged `main` into `scraper` (added `work_distribution.md`). |
| 2026-03-14 | `scraper` | Created `scrape_ttb_full.py` — full Playwright scraper for TTB with pagination, accordion expansion, and BeautifulSoup parsing matching `course_schema.json`. Added `playwright` and `lxml` to `requirements.txt`. |
| 2026-03-14 | `scraper` | Rewrote `scrape_ttb_full.py` — discovered internal TTB API (`api.easi.utoronto.ca/ttb/getPageableCourses`). Now uses `requests` directly (no Playwright needed for data). Handles pagination, normalises all fields to `course_schema.json`. Verified working with CSC311 (2 courses, full section/meeting/enrolment data). |

---

**Previous Branch**: `winston`

## Completed in Phase 1 (Data Ingestion & Scaffolding)
We have successfully set up the foundation of the monorepo and created the scrapers needed to ingest our initial hackathon data.

### 1. Repository Structure
- **`/frontend/`**: Initialized a Next.js (App Router) project with Tailwind CSS. `shadcn-ui` is queued for installation.
- **`/backend/`**: Initialized a FastAPI environment with generic endpoints (`main.py`) and a `requirements.txt` containing all necessary AI and scraping packages (OpenAI, Langchain, ChromaDB, requests, soup, praw, PyMuPDF, Playwright).

### 2. Scrapers (`/ingestion/scrapers/`)
- **`scrape_calendar.py`**: Scrapes the UofT ArtSci Course Calendar (HTML).
  - *Status*: Working. Accurately extracts `course_code`, `title`, `description`, `prerequisites`, `corequisites`, and `exclusions`. Outputs to `ingestion/raw_data/courses.json`.
- **`scrape_ttb_playwright.py`**: Intercepts the Timetable Builder API.
  - *Status*: Ready. Because the old TTB open API is dead, we use Playwright to spin up Chromium, search a course, and intercept the internal JSON API responses. Output goes to `ingestion/raw_data/timetable_playwright_sample.json`.
- **`scrape_reddit.py`**: Fetches `r/UofT` sentiment data on requested courses.
  - *Status*: Ready. Requires `REDDIT_CLIENT_ID` and `SECRET` in `backend/.env`. Grabs top threads and comments via `praw` for NLP scoring.
- **`scrape_syllabi.py`**: Parses and chunks PDF syllabi for Vector/RAG lookup.
  - *Status*: Ready. Uses `PyMuPDF` to read raw page text and splits it into strings. Place real PDFs in `ingestion/raw_data/syllabi/`.

### Context for Teammates (Next Actions)
1. Someone must generate API keys on the Reddit Developer Portal and put them in `backend/.env`.
2. Someone must run `python3 scrape_reddit.py`, `python3 scrape_ttb_playwright.py`, and `python3 scrape_syllabi.py` locally to populate the initial raw JSON files.
3. Once those JSON files are generated, we can move on to **Phase 2**: Normalizing that raw data into SQLite and indexing it into ChromaDB.

---

## Completed in Phase 2 (Database Schema & Ingestion)

### 1. Database Initialization (Winston)
- **What I did**: Set up the local SQLite database schema and ChromaDB collections.
- **How I did it**: Wrote `backend/database.py` with `sqlite3` and `chromadb.PersistentClient` to create tables (`courses`) and vector collections (`course_catalog`, `syllabi`, `reddit_discussions`, `academic_rules`).
- **What it's for**: This establishes the local persistence layer required for the app's Retrieval-Augmented Generation (RAG) and core routing API logic.

### 2. Course Catalog Ingestion (Winston)
- **What I did**: Ingested and hydrated the structured SQLite database using the scraped Course Calendar data.
- **How I did it**: Wrote `ingestion/init_db.py` to read `courses.json` and cleanly `INSERT OR UPDATE` all 5,349 scraped courses into the SQLite database table. Ran the script successfully.
- **What it's for**: Provides the AI course advisor and the timetable planner backend with deterministic access to prerequisite rules, breadth requirements, and basic course metadata.

### 3. Vector Embeddings for Academic Rules (Winston)
- **What I did**: Built a chunking and embedding pipeline for unstructured Markdown academic documents.
- **How I did it**: Created `ingestion/chunk_documents.py` using `Langchain`'s `MarkdownTextSplitter` and `OpenAIEmbeddings` to parse files in `/general_academic_info` and push them into the ChromaDB `academic_rules` collection.
- **What it's for**: Gives the LLM deep semantic contextual knowledge to accurately answer abstract student queries regarding enrollment controls and specific UofT course policies!

### Context for Teammates (Next Actions)
1. **Sujoy**: Please acquire the remaining dynamic TTB data, syllabus PDFs, and Reddit data so we can chunk and index them into our new SQLite and Chroma schemas as well. Then move those into `ingestion/raw_data`.
2. **Kiko**: Please start bringing up the frontend Next.js interface components (Chat UI, Timetable block UI) anticipating the FastAPI endpoints Winston will build in Phase 3.

---

## Completed in Phase 3 (Core App Endpoints & RAG)

### 1. Reusable Pydantic Models (Winston)
- **What I did**: Defined strictly typed data models for our FastAPI server.
- **How I did it**: Wrote `backend/models.py` defining `ChatRequest`, `ChatResponse`, and `CourseDetails` using `pydantic.BaseModel`.
- **What it's for**: Ensures the frontend sends and receives clean, validated JSON, preventing common runtime errors.

### 2. Retrieval-Augmented Generation Service (Winston)
- **What I did**: Created the core intelligence engine for the Chat Advisor.
- **How I did it**: Build `backend/services/rag.py` using `Langchain` and OpenAI's `gpt-4o-mini`. It intercepts the user's message, performs a vector similarity search on ChromaDB, fetches structured prerequisites from SQLite, and injects everything into a master System Prompt.
- **What it's for**: Gives the generic ChatGPT model extremely focused, accurate, and up-to-date knowledge about UofT courses and academic rules.

### 3. FastAPI Endpoint Routers (Winston)
- **What I did**: Built and mounted the Web API routes.
- **How I did it**: Created `backend/api/courses.py` (for catalog browsing) and `backend/api/chat.py` (for the AI advisor). Included both routers inside the main application instance in `backend/main.py`.
- **What it's for**: These are the actual URLs Kiko's Next.js frontend will communicate with via HTTP `fetch` to power the user interface.

### Context for Teammates (Next Actions)
1. **Winston**: Now moving to Phase 4 (Timetable Scheduler Logic) to build the conflict-detecting algorithm.
2. **Kiko**: The endpoints (`/api/chat` and `/api/courses`) are completely ready for integration! You can build the Chat Interface and hit these URLs now.

---

## Completed in Phase 4 (Frontend Chat Interface & LLM Integration)

### 1. ChatGPT-Style Chat UI (Winston)
- **What I did**: Built a full ChatGPT-like messaging interface at `/chat`.
- **How I did it**: Created `frontend/src/app/chat/page.tsx` using React, `framer-motion` (message pop-in animations), `react-markdown` (LLM response rendering), and `lucide-react` (icons). Messages are sent to `http://localhost:8000/api/chat` via `fetch`.
- **What it's for**: Gives users a familiar, polished chat experience to ask the AI Copilot about courses, prerequisites, and academic rules.

### 2. RAG Pipeline Fix (Winston)
- **What I did**: Fixed the RAG pipeline so it actually uses course data when answering questions.
- **How I did it**: Rewrote `backend/services/rag.py` to auto-detect course codes (e.g., `MAT223`) via regex, query the SQLite database for matching courses, and inject full course details into the LLM system prompt. Added keyword fallback search for non-code queries.
- **What it's for**: Before this fix, the LLM had zero context about any specific course. Now it returns detailed, accurate answers with prerequisites, exclusions, and breadth requirements.

---

## Completed in Phase 5 (Timetable Scheduler Logic & UI)

### 1. Schedule Generation Algorithm (Winston)
- **What I did**: Built an algorithm that generates conflict-free timetable schedules.
- **How I did it**: Created `backend/services/scheduler.py` which loads `timetable_full.json` (3,832 courses), groups sections by type (LEC/TUT/PRA), uses cartesian product to generate all valid combinations, filters time conflicts, and scores schedules by seat availability. Penalizes full/waitlisted/cancelled sections.
- **What it's for**: The core algorithmic engine — given a list of desired courses, it finds every possible non-conflicting timetable and ranks them by enrollment openness.

### 2. Schedule Generation Endpoint (Winston)
- **What I did**: Created the `POST /api/schedule/generate` FastAPI endpoint.
- **How I did it**: Built `backend/api/schedule.py` with Pydantic request model (`course_codes`, `session`, `max_schedules`). Wired the router into `backend/main.py`.
- **What it's for**: The REST API that the frontend calls to generate schedules on demand.

### 3. Schedule Generator Frontend (Winston)
- **What I did**: Built an interactive "Schedule Generator" page at `/generate`.
- **How I did it**: Created `frontend/src/app/generate/page.tsx` with course wishlist builder (autocomplete search), "Generate" button, schedule tabs, enrollment bars with full/waitlist warnings, and a mini weekly calendar preview. Added nav links in both the timetable and chat pages.
- **What it's for**: Lets users build a course wishlist, click one button, and instantly see ranked conflict-free schedules with enrollment health indicators.

### Context for Teammates (Next Actions)
1. **Final Integration**: Connect the generated schedule entries to the existing timetable Calendar view so users can "Apply" a generated schedule.
2. **Polish**: Add micro-animations, dark mode toggle, and deploy to Vercel/Railway for the demo.

---

## Completed in Phase 6 (Dashboard, Glassmorphism Redesign & Scheduler Overhaul)

### 1. Premium Dashboard Homepage (Winston)
- **What I did**: Built a new landing page at `/` with hero section, feature cards, and quick navigation.
- **How I did it**: Replaced the old root `page.tsx` with a modern dashboard using animated CSS blobs, glassmorphism panels, and a stats strip. Moved the timetable to a dedicated `/timetable` route.
- **What it's for**: Provides a polished "first impression" landing page that routes users to the Planner, Generator, or AI Chat.

### 2. Glassmorphism Design System (Winston)
- **What I did**: Overhauled the entire app's visual design to a consistent dark-mode glassmorphism aesthetic.
- **How I did it**: Updated `globals.css` with new design tokens (`glass`, `glass-card`, `glass-dark`), animated blob backgrounds, and utility classes. Restyled all four pages (`/`, `/timetable`, `/generate`, `/chat`) with frosted glass panels, `backdrop-filter`, `rgba` backgrounds, and premium typography.
- **What it's for**: Makes the app look and feel like a modern, premium SaaS product — critical for hackathon presentation impact.

### 3. Backtracking Schedule Generator (Winston)
- **What I did**: Rewrote the schedule generation algorithm from brute-force cartesian product to recursive backtracking.
- **How I did it**: Replaced the `itertools.product()` loop in `scheduler.py` with a `backtrack()` function that places one course at a time and prunes branches immediately on conflict detection. Added per-course combo pruning (top-15 by score) and safety caps (500k nodes, collect limit).
- **What it's for**: The old algorithm hung indefinitely on 9 courses (~5.7 billion combos). The new one finds 50 valid schedules in 0.07 seconds by cutting dead branches early.

### 4. Time Preference Feature (Winston)
- **What I did**: Added ability to prefer early, balanced, or late class times.
- **How I did it**: Added a `time_preference` parameter (`'early'`/`'balanced'`/`'late'`) to `_score_schedule()` in `scheduler.py`, which applies a bonus based on average meeting start times. Wired it through `schedule.py` API endpoint. Built a 3-option toggle UI (☀️ Early Bird / 🕐 Balanced / 🌙 Night Owl) in the frontend generator page.
- **What it's for**: Lets users express lifestyle preferences that influence schedule ranking without overriding conflict-free validity.

### 5. "Apply to Timetable" Feature (Winston)
- **What I did**: Added a button in the Schedule Generator to instantly sync a chosen schedule to the main timetable.
- **How I did it**: The `applySchedule()` function in `generate/page.tsx` clears the existing timetable via `POST /api/timetable` and then adds each section. After applying, the user is redirected to `/timetable`.
- **What it's for**: Eliminates manual re-entry — one click to go from generated schedule to your main calendar.

### 6. Chat API Fix (Winston)
- **What I did**: Fixed the Copilot chat returning empty responses.
- **How I did it**: The frontend was sending `{ message: "..." }` but the backend expected `{ messages: [{ role, content }] }`. It was also reading `data.response` instead of `data.reply`. Fixed both mismatches in `chat/page.tsx`.
- **What it's for**: The AI Copilot now correctly sends full conversation history and reads the backend response.

### Context for Teammates (Next Actions)
1. **ChromaDB Population**: The `academic_rules` collection is still empty — need to run `chunk_documents.py` to populate it for semantic search.
2. **Deployment**: Host frontend on Vercel, backend on Render/Railway for the demo.
3. **Persistence**: Timetable data is in-memory — needs SQLite backing for production.
