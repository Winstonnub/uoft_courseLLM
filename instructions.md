````md
# UofT AI Copilot Hackathon Build Plan

You are helping me build a **real, functional, flashy hackathon web app** in about **30 hours** with a **team of 3**.

Our product is:

## Product
**UofT AI Copilot**
A web app that:
- uses **RAG** over:
  - UofT course calendar
  - official timetable builder data
  - syllabus PDFs
  - Reddit discussions from `r/UofT`
- provides:
  - **Course advisor chatbot**
  - **AI timetable generator**
  - **Degree planning / semester planning**
- has a polished frontend with:
  - general LLM wrapper chatbox
  - timetable tab
  - optional 3D / flashy visuals later

We want this to be:
- **real and functional**
- **hackathon impressive**
- built fast with good engineering choices
- focused first on **data collection / web scraping**, then **RAG**, then **scheduler**, then polish

---

# Team + Constraints

- Team size: **3**
- Time left: **~30 hours**
- Skill split:
  - one stronger in **ML**
  - one **fullstack**
  - one generally experienced / can help where needed
- We want:
  - **working MVP**
  - but also enough wow-factor for demo
- We do **not** want to waste time on:
  - fine-tuning
  - training our own LLM
  - RL for timetable optimization
  - overcomplicated agent frameworks unless they clearly help

---

# What I want from you

I want you to act like my **technical lead + implementation coach**.

## Important behavior instructions
1. **Do not just give high-level ideas.**
   Give me **concrete implementation steps**, file structures, schemas, code scaffolds, endpoint designs, and priorities.

2. **Teach setups when needed.**
   If I need something like:
   - getting an API key
   - setting up OpenAI / Gemini / DeepSeek
   - running Chroma
   - choosing between Chroma / FAISS / Pinecone
   - setting up FastAPI
   - connecting Next.js frontend to backend
   - handling PDF parsing
   - using Playwright / requests / BeautifulSoup
   - setting up Reddit API access
   then **walk me through it step by step**.

3. **Assume I am willing to use APIs first if faster.**
   If OpenAI / Gemini / DeepSeek is the best choice, recommend it.
   If I should use local Ollama only as fallback, say so.

4. **Default to the fastest reliable hackathon path.**
   Whenever there is a choice, prefer:
   - simpler
   - faster
   - more robust
   - easier to demo

5. **When I ask for implementation, give production-minded but hackathon-practical answers.**
   I want things that can be built **now**, not idealized future architecture.

6. **When we are unsure what to build next, prioritize this order:**
   1. scraping / data ingestion
   2. normalization / schema
   3. RAG indexing
   4. chat queries
   5. timetable generation
   6. degree planner
   7. polish / flashy visuals

7. **If a task is large, break it into substeps and ask me to complete/check one at a time.**

---

# Product Requirements

## Core Features

### 1. Course Advisor Chatbot
A chatbot that can answer questions like:
- “What do students think about CSC311?”
- “Which UofT courses are good for ML?”
- “Which courses have lighter workload?”
- “Compare CSC369 and CSC373”
- “What courses pair well with CSC311 next semester?”

It should use:
- official course descriptions
- syllabus content
- Reddit discussions
- timetable metadata when relevant

It should clearly distinguish:
- **official facts**
- **student opinions**
- **uncertainty / mixed evidence**

---

### 2. AI Timetable Generator
User can input preferences like:
- avoid mornings
- avoid Friday classes
- lighter workload
- prefer certain instructors
- minimize walking
- balanced week

The system should:
- use structured timetable data to generate **valid conflict-free schedules**
- return top options
- optionally let the LLM explain tradeoffs

We do **not** want the LLM to invent schedules from scratch.
We want:
- **algorithmic schedule generation first**
- **LLM explanation second**

---

### 3. Degree / Semester Planning
User can ask:
- “I’m interested in AI, what should I take next semester?”
- “Plan me a balanced ML-focused semester”
- “I want easier electives with CSC311”
- “Suggest a path toward machine learning”

This can be:
- rule-based + retrieval-based
- not a perfect registrar clone
- grounded in available data

---

# Data Sources We Want

## 1. Official UofT Course Calendar
We want:
- course code
- title
- description
- prerequisites text
- exclusions text
- campus / term info if available

---

## 2. Official Timetable Builder
We want:
- course sections
- lecture/tutorial/practical data
- instructors
- meeting times
- spots / enrollment / availability if possible
- room/building if possible

We suspect this may be scrapeable via:
- API / network requests in browser devtools
- or rendered page scraping
- or Playwright if needed

Please help us determine the best method.

---

## 3. Syllabus PDFs
We want to scrape and parse syllabi PDFs.

We want to extract:
- grading breakdown
- assignments
- midterms/finals
- labs/tutorials
- project mentions
- textbook
- weekly schedule if available
- attendance / late policy if easy

Also help us convert PDF text into:
- raw chunks for RAG
- structured features for analytics

---

## 4. Reddit (`r/UofT`)
We want to use Reddit discussions to analyze:
- course sentiment
- workload mentions
- instructor opinions
- student experiences

We may only need **light sentiment analysis**.
We are okay with heuristic analytics for MVP.

We have heard that historical dumps may exist from Pushshift-era archives, but we are not fully depending on that.
We want the fastest workable path.

Please guide us on:
- best source for Reddit data
- safest and fastest way to collect enough data for hackathon use
- how to extract course-code mentions
- how to aggregate sentiment per course

---

## 5. Stretch: Professor ratings / RateMyProf
This is optional after MVP.
If included, help us do it in the simplest way possible.

---

# Recommended Tech Direction

We are currently leaning toward:

## Frontend
- Next.js
- Tailwind
- component library if useful

## Backend
- FastAPI preferred
- Python for data pipelines and RAG

## Vector DB
We are not very familiar yet.
We are considering:
- Chroma
- FAISS
- Pinecone

Please recommend the best option for hackathon speed and show us setup.

## LLM / Embeddings
We are considering:
- OpenAI
- Gemini
- DeepSeek
- Ollama fallback if needed

Please recommend the best stack for:
- speed
- reliability
- ease of use
- good enough quality

## Orchestration
We are considering:
- plain Python
- LangChain
- maybe LangGraph if needed

Please recommend the **minimum necessary complexity**.

---

# What I currently believe is best
My current assumption is:

- **Use APIs first**
- **Do not fine-tune**
- **Do not train our own model**
- **Do not use RL**
- **Use structured scheduling logic + RAG explanations**
- **Work on scraping first**

If you disagree, explain clearly and give a better alternative.

---

# Architecture I want help implementing

I want you to help me build this architecture concretely:

## Data Layer
- scraper scripts
- normalization pipeline
- structured DB
- vector index

## Retrieval Layer
- chunks by source:
  - calendar
  - syllabus
  - reddit
- metadata filters
- source-aware retrieval

## App Layer
- chat endpoint
- scheduler endpoint
- planner endpoint
- course detail endpoint

## Frontend
- chat tab
- timetable tab
- course info cards
- planner tab if time allows

---

# Important Design Rules

## Rule 1
Use **structured DB first** for:
- times
- instructors
- seats
- sections
- rooms
- official schedule constraints

## Rule 2
Use **RAG** for:
- explanations
- course comparisons
- workload discussion
- Reddit sentiment summaries
- syllabus-based insights

## Rule 3
Do **not** let the LLM invent hard facts when structured data exists.

## Rule 4
Keep the build simple enough for 30 hours.

---

# What I want you to help me produce

Please help me generate, step by step:

## 1. Repo / folder structure
I want a full suggested repo layout for:
- frontend
- backend
- ingestion
- scripts
- prompts
- schemas
- utilities

Example level of detail:
- `/frontend`
- `/backend/app/api`
- `/backend/app/services`
- `/backend/app/models`
- `/backend/scripts/scrape`
- `/backend/scripts/index`
- `/backend/data/raw`
- `/backend/data/processed`
etc.

---

## 2. Database schema
Please design:
- structured SQL schema
- key tables
- important fields
- relationships

Likely tables:
- courses
- sections
- meetings
- instructors
- syllabus_features
- reddit_mentions
- course_analytics
- maybe buildings

Please give me a practical hackathon schema, not an enterprise one.

---

## 3. Data model for vector indexing
Please show how to structure document chunks like:

```json
{
  "id": "...",
  "course_code": "CSC311",
  "source_type": "syllabus",
  "section": "Evaluation",
  "text": "...",
  "url": "...",
  "term": "2025 Fall"
}
````

Help me define:

* chunk sizes
* metadata
* source-specific chunking strategy

---

## 4. Scraping plan

This is the **first thing I want to work on**.

Please create a detailed scraping implementation plan in order:

1. course calendar
2. official timetable builder
3. syllabus PDFs
4. reddit

For each source, tell me:

* what tool/library to use
* whether to use requests / BeautifulSoup / Playwright / Selenium
* how to test if an API exists
* how to save raw output
* how to normalize output
* what to do if scraping is blocked / fragile

Also tell me which source we should get working **first** for the fastest MVP.

---

## 5. Setup instructions

When needed, teach me step-by-step how to set up:

* Python environment
* FastAPI
* Next.js
* Chroma or other vector DB
* OpenAI or alternative API key
* `.env` handling
* Reddit API
* PDF text extraction libraries
* Playwright if needed

Do not assume I already know these setups.
Give practical commands.

---

## 6. Scheduler design

Help me implement:

* course section combination generation
* conflict detection
* simple ranking / scoring
* optional walking penalty
* user preference scoring

I want:

* simple algorithm first
* good enough for demo
* top 3 schedules returned

Please show the logic and pseudocode before overengineering.

---

## 7. RAG pipeline design

Please help me implement:

* indexing flow
* embedding generation
* retrieval
* prompt templates
* answer formatting with citations/source tags

I want clear guidance on:

* whether to use LangChain or plain Python
* whether to use Chroma or FAISS
* how to separate structured facts from retrieval-based answers

---

## 8. API endpoints

Please define the key FastAPI endpoints with request/response shapes for:

* chat
* course lookup
* course analytics
* scheduler
* planner

Give example JSON request/response contracts.

---

## 9. Frontend implementation plan

Please help define the pages/components for:

* chat tab
* timetable tab
* course cards
* source evidence panel
* planner tab if time permits

Also suggest:

* which parts to mock first
* how to integrate with backend incrementally
* what polish is worth the time

---

## 10. Team task split

Please propose a 3-person task split with:

* ownership
* dependency order
* parallelization strategy

---

## 11. 30-hour execution plan

Please turn the entire project into a realistic timeline:

* first 4 hours
* next 6 hours
* etc.
* including checkpoints and fallback scope cuts

---

# What I want you to do first

Start with:

## Phase 1

Help me set up the project and **start the scraping pipeline first**.

Specifically, begin by giving me:

1. the recommended **overall stack**
2. the **repo structure**
3. the **Phase 1 scraping plan**
4. the **exact first tasks I should do right now**
5. any setup instructions required before scraping starts

Then, after that, help me implement source by source.

---

# Extra instructions for how to respond

* Be concrete
* Be opinionated
* Prefer the fastest robust hackathon route
* If something is a bad idea, say so
* When I need setup help, teach me step by step
* When possible, give code skeletons
* When useful, give commands I can run immediately
* Keep everything grounded in the fact that we only have ~30 hours and want a working demo

Now start with the best stack choice, repo structure, and scraping-first implementation plan.

```
```
