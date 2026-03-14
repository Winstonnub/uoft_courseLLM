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
