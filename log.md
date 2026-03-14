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
