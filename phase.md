# UofT AI Copilot - Hackathon Phases & Sidequests

This document outlines our game plan for the 30-hour hackathon, broken down into 5 phases. For each phase, we detail the core goals, the exact tech stack to use, and **Sidequests**—bonus tasks that team members can pick up if they have extra time or want to add "wow factor."

---

## Phase 1: Setup & Data Ingestion (Hours 0-6)
**Main Goal:** Get all the raw data we need from UofT sources.
**Tech Stack:** Python, `requests`, `BeautifulSoup4`, `playwright`, `praw`, `PyMuPDF`.

### Core Tasks:
- [x] Scrape UofT Course Calendar (HTML parsing).
- [x] Intercept Timetable Builder API (Playwright).
- [x] Scrape Reddit r/UofT sentiment (PRAW).
- [x] Parse Syllabus PDFs into chunks (PyMuPDF).

### Sidequests 🏹:
- **Repo Scaffolding:** Set up the Next.js frontend and FastAPI backend folders (✅ Done).
- **Team Log:** Create a `log.md` so teammates' AI agents have shared context (✅ Done).
- **More Sources:** Find additional sources of UofT data (e.g., RateMyProf ratings). 

---

## Phase 2: Data Normalization & Vector Indexing (Hours 6-12)
**Main Goal:** Turn messy raw JSON and text into a structured SQL database and a searchable Vector Database.
**Tech Stack:** Python, `sqlite3` (or `SQLAlchemy`), `ChromaDB`, OpenAI `text-embedding-3-small`, `langchain-text-splitters`.

### Core Tasks:
- Design and build the SQLite schema (`courses`, `sections`, `meetings`).
- Write a script to insert `courses.json` and `timetable_playwright_sample.json` into SQLite.
- Write a script to chunk Reddit text, Syllabi, and academic rules, then embed them into ChromaDB.

### Sidequests 🏹:
- **Rulebook RAG:** Index the `general_academic_info` markdown files (e.g., `understanding_courses.md`, `course_enrolment.md`) into ChromaDB so the chatbot knows the actual university rules.
- **Auto-Reset DB:** Write a clean `make_db.sh` or Python script that dropping and recreating the databases from scratch so testing is easy.
- **Sanity Check CLI:** Build a tiny terminal script that lets you type a query and proves ChromaDB returns the right chunks.

---

## Phase 3: Core App Endpoints & RAG Pipeline (Hours 12-18)
**Main Goal:** Build the API layer that the frontend will consume.
**Tech Stack:** `FastAPI`, `Pydantic` (for typing), OpenAI `gpt-4o-mini`, Prompt Engineering.

### Core Tasks:
- Create `/api/chat` endpoint: Takes user message, queries ChromaDB for context, queries SQLite for hard facts, and asks LLM to answer.
- Create `/api/courses/{code}` endpoint: Returns structured JSON for a specific course for UI display.

### Sidequests 🏹:
- **Memory:** Implement session state/chat history (either in-memory dictionary or a `sessions` table in SQLite) so the chatbot remembers follow-up questions.
- **Streaming:** Make the `/api/chat` endpoint stream the response token-by-token (Server-Sent Events) so the UI feels fast.
- **Course Comparer:** Build an endpoint specifically optimized to compare two courses side-by-side using LLM reasoning.

---

## Phase 4: Frontend Chat Interface & LLM Integration (Hours 18-24)
**Main Goal:** Build a beautiful, ChatGPT-style React UI to talk to our RAG backend.
**Tech Stack:** Next.js (App Router), Tailwind CSS, `framer-motion` (for animations), `react-markdown`.

### Core Tasks:
- Set up Shadcn UI for standard base components.
- Build the **Chat Advisor Tab**: A sleek messaging interface that hits `/api/chat`.
- Implement message state, loading spinners, and markdown rendering.

### Sidequests 🏹:
- **Streaming UI:** If the backend supports it, make the text stream in.
- **Citations UI:** Make the chat interface show clickable "Source tags" (e.g., [Syllabus], [Academic Rules]) when the LLM makes a claim.
- **Dark Mode:** Implement a sleek dark mode toggle.

---

## Phase 5: Timetable Scheduler Logic & UI (Hours 24-30)
**Main Goal:** Algorithmic generation of conflict-free schedules and a calendar frontend to view them.
**Tech Stack:** Pure Python algorithms for backend, React calendar grids for frontend.

### Core Tasks:
- Build the core algorithm in Python: Take a list of desired courses, generate all valid permutations of sections (LEC/TUT/PRA), and filter out time conflicts.
- Create `/api/schedule/generate` endpoint.
- Build the **Timetable Visualizer Tab** on the Next.js frontend to display the generated schedules.

### Sidequests 🏹:
- **Preference Scoring:** Add logic to score schedules based on user preferences.
- **Micro-animations:** Add `framer-motion` to make the timetable blocks pop in.

### Sidequests 🏹:
- **Dark Mode:** Implement a sleek dark mode toggle. 
- **Micro-animations:** Add `framer-motion` to make messages pop in and modals slide smoothly. The UI *must* look premium.
- **Deploy:** Host the frontend on Vercel and the backend on Render/Railway so anyone can try it during the demo.
- **Citations UI:** Make the chat interface show clickable "Source tags" (e.g., [Syllabus], [Reddit]) when the LLM makes a claim.

---

## Phase 6: Dashboard, Redesign & Algorithm Overhaul (Post-Hackathon Polish)
**Main Goal:** Transform the app into a premium-looking product and fix performance bottlenecks in the scheduler.
**Tech Stack:** CSS glassmorphism, Tailwind, recursive backtracking (Python).

### Core Tasks:
- [x] Build a premium Dashboard homepage at `/`.
- [x] Apply glassmorphism design system across all pages.
- [x] Rewrite scheduler from brute-force to backtracking (supports 9+ courses).
- [x] Add time preference feature (early/balanced/late).
- [x] Add "Apply to Timetable" feature in generator.
- [x] Fix Chat API request/response mismatches.

### Sidequests 🏹:
- **Persistence:** Back timetable state with SQLite instead of in-memory storage.
- **ChromaDB Population:** Populate the `academic_rules` collection for semantic search.
- **Deploy:** Host on Vercel + Railway for public demo.
