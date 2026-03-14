# Phase 2 Tutorial: Building the Local Database & RAG Pipeline

This tutorial explains the exact steps to implement the database and vector ingestion code for Phase 2. It is written as if you asked a coding assistant: *"How do I set up SQLite for my scraped course data and chunk my markdown files into ChromaDB for RAG?"*

---

## Step 1: Initialize SQLite and ChromaDB

First, we need to create the databases. We want to use SQLite for structured data (like the prerequisite rules for a course) and ChromaDB for unstructured semantic data (like the academic rules).

Create a file called `backend/database.py`:

```python
import sqlite3
import os
import chromadb

DB_PATH = os.path.join(os.path.dirname(__file__), "copilot.db")
CHROMA_PATH = os.path.join(os.path.dirname(__file__), "chroma_db")

def get_db_connection():
    # Connects to the SQLite file (creates it if it doesn't exist)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # This lets us access columns by name
    return conn

def init_sqlite_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create the courses table based on our JSON schema
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS courses (
            course_code TEXT PRIMARY KEY,
            title TEXT,
            description TEXT,
            prerequisites TEXT,
            corequisites TEXT,
            exclusions TEXT,
            breadth_requirements TEXT
        )
    ''')
    conn.commit()
    conn.close()

def get_chroma_client():
    # PersistentClient saves our embeddings to the disk locally
    return chromadb.PersistentClient(path=CHROMA_PATH)

def init_chroma_db():
    client = get_chroma_client()
    # Create collections (think of these like tables for vectors)
    client.get_or_create_collection(name="course_catalog")
    client.get_or_create_collection(name="academic_rules")

if __name__ == "__main__":
    init_sqlite_db()
    init_chroma_db()
```
**To run this:** `python3 backend/database.py`

---

## Step 2: Ingest JSON into SQLite

Next, we need to read the `courses.json` file we scraped in Phase 1 and insert every course into the SQLite database. We'll use an `INSERT ... ON CONFLICT DO UPDATE` query to avoid crashing if we run the script twice.

Create a file called `ingestion/init_db.py`:

```python
import sqlite3
import json
import os
import sys

# Import our database connection from the previous step
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
from database import get_db_connection

def ingest_courses():
    file_path = os.path.join(os.path.dirname(__file__), 'raw_data', 'courses.json')
        
    with open(file_path, 'r', encoding='utf-8') as f:
        courses = json.load(f)
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    for course in courses:
        cursor.execute('''
            INSERT INTO courses (
                course_code, title, description, prerequisites, corequisites, exclusions, breadth_requirements
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(course_code) DO UPDATE SET
                title=excluded.title,
                description=excluded.description,
                prerequisites=excluded.prerequisites,
                corequisites=excluded.corequisites,
                exclusions=excluded.exclusions,
                breadth_requirements=excluded.breadth_requirements
        ''', (
            course.get('course_code', ''),
            course.get('title', ''),
            course.get('description', ''),
            # ... pass the rest of the fields
        ))
        
    conn.commit()
    conn.close()
    print(f"Successfully ingested {len(courses)} courses.")

if __name__ == "__main__":
    ingest_courses()
```
**To run this:** `python3 ingestion/init_db.py`

---

## Step 3: Chunking Text for RAG (Retrieval-Augmented Generation)

To make our LLM smart about UofT's academic rules, we can't just pass entire markdown files in the prompt. They are too long. We need to split them into small "chunks" and use OpenAI Embeddings to convert them into numbers (vectors), then save them to ChromaDB.

Create a file called `ingestion/chunk_documents.py`:

```python
import os
import sys
from dotenv import load_dotenv
from langchain_text_splitters import MarkdownTextSplitter
from langchain_openai import OpenAIEmbeddings

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
from database import get_chroma_client

# This loads our OpenAI API key from backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

def embed_academic_rules():
    rules_dir = os.path.join(os.path.dirname(__file__), '..', 'general_academic_info')
    md_files = [f for f in os.listdir(rules_dir) if f.endswith('.md')]

    # Initialize OpenAI Embeddings and Chroma
    embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small")
    client = get_chroma_client()
    collection = client.get_or_create_collection(name="academic_rules")
    
    # Langchain splitter looks for Markdown headers (##) to split cleanly
    splitter = MarkdownTextSplitter(chunk_size=1000, chunk_overlap=200)

    for filename in md_files:
        with open(os.path.join(rules_dir, filename), 'r') as f:
            content = f.read()
            
        # 1. Split text into chunks
        chunks = splitter.create_documents([content])
        
        texts = [chunk.page_content for chunk in chunks]
        metadatas = [{"source": filename} for _ in chunks]
        ids = [f"{filename}_{i}" for i in range(len(chunks))]
        
        # 2. Embed and Add to ChromaDB
        collection.add(
            ids=ids,
            embeddings=embeddings_model.embed_documents(texts),
            metadatas=metadatas,
            documents=texts
        )

if __name__ == "__main__":
    embed_academic_rules()
```
**To run this:** Make sure `OPENAI_API_KEY` is in `backend/.env`, then run `python3 ingestion/chunk_documents.py`.

---

### You're Done!
You've now successfully set up a localized SQL database for structured queries and an embedded Vector Database for semantic search. We are ready to hook these up to a FastAPI server!
