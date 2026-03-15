# UofT AI Copilot - Work Distribution

This document defines the roles and responsibilities for the hackathon team (Winston, Sujoy, and Kiko). This is designed so that each person can give this context to their AI coding agent to effectively parallelize development.

---

## 👨‍💻 Winston: Backend & LLM Architecture
**Focus:** Infrastructure, API design, Database architecture, and LLM intelligence.
**Tech Stack:** FastAPI, Python, SQLite, ChromaDB, OpenAI (gpt-4o-mini), minimal LangChain.

### Key Responsibilities:
1. **Database Architecture:** Design and build the SQLite database schemas for courses, sections, and meetings based on the JSON schemas.
2. **Vector Store Setup:** Initialize ChromaDB and populate it with chunks from syllabi, Reddit, and academic calendars.
3. **Core API Endpoints:** Build the FastAPI routes (e.g., `/api/chat`, `/api/timetable`).
4. **RAG Pipeline:** Implement the Retrieval-Augmented Generation logic combining ChromaDB context and SQLite facts to feed to the LLM.
5. **LLM Prompts:** Engineer the master prompt for the course advisor bot.
6. **Timetable Algorithm:** Write the Python logic to generate non-overlapping schedules based on course selections.

---

## 🕵️ Sujoy: Scraping & Data Preprocessing
**Focus:** Acquiring, cleaning, and formatting all the raw data needed to power the app.
**Tech Stack:** Python, `requests`, `BeautifulSoup4`, `playwright`, `praw`, `PyMuPDF`, Pandas.

### Key Responsibilities:
1. **Course Calendar:** Scrape all 179 pages of the A&S calendar into a clean JSON array (Completed in Phase 1).
2. **Timetable Builder:** Use Playwright or reverse-engineered APIs to extract sections, times, and instructor info for every course.
3. **Reddit Sentiment:** Use `praw` to scrape r/UofT discussions for top courses.
4. **Syllabi Parsing:** Use PyMuPDF to extract text from PDFs.
5. **Data Preprocessing & Cleaning:** Clean the scraped HTML, split academic rule markdown files into Chroma-friendly chunks, and ensure all data cleanly maps to Winston's JSON schemas before it hits the DB.

---

## 🎨 Kiko: Frontend Engineering & UI Polish
**Focus:** Building a beautiful, highly-responsive, and accessible web interface.
**Tech Stack:** Next.js (App Router), React, Tailwind CSS, Shadcn UI, Framer Motion.

### Key Responsibilities:
1. **Next.js Scaffolding:** Set up the Next.js app, configure Tailwind, and lay out the global routing.
2. **Chat Advisor UI:** Build a WhatsApp/ChatGPT-style messaging interface with streaming text support and custom markdown rendering.
3. **Timetable Visualizer:** Build an interactive, calendar-grid view component to display the generated schedules beautifully.
4. **Component Design:** Utilize Shadcn UI components (buttons, dropdowns, modals, tabs) heavily to ensure a professional look.
5. **Animations:** Add `framer-motion` for micro-interactions (e.g., messages sliding in, modals fading).
6. **API Integration:** Connect the React frontend to Winston's FastAPI backend endpoints using standard `fetch` or `SWR`/`React Query`.

---

## Example Prompt for Your AI Agent
> "Hi AI, I am [Your Name]. I am working on a 30-hour hackathon to build a UofT AI Copilot. Read `work_distribution.md` to understand my specific role, and read `phase.md` to understand the overall project goals. Help me accomplish my next task."

---

## Phase 6 Updates
- **Winston**: Completed the full glassmorphism redesign, rewrote the scheduler with backtracking, added time preference scoring, built the dashboard, and fixed the chat API. All frontend pages are now consistently styled.
- **Kiko**: Original timetable visualizer work has been restyled and moved to `/timetable`. The "Apply to Timetable" feature bridges the generator and timetable views.
- **Sujoy**: Scraper work (`timetable_full.json`) is being actively consumed by the new backtracking scheduler. No new scraping tasks needed for Phase 6.
