# Phase 3 Tutorial: RAG Pipeline and FastAPI Endpoints (Detailed for Beginners!)

Welcome to Phase 3! In this phase, we are taking the databases we built in Phase 2 (SQLite and ChromaDB) and hooking them up to a real web server using **FastAPI**. 

We are also building the "brain" of our AI—a **Retrieval-Augmented Generation (RAG)** pipeline.

If you are new to backend development or AI, this detailed tutorial will explain exactly what these concepts mean and how to implement them step-by-step.

---

## Concept Overview: What are we building?

1. **FastAPI**: This is a modern, fast web framework for building APIs in Python. Think of an API (Application Programming Interface) like a restaurant waiter. Your React frontend (the customer) sends a request to the FastAPI server (the waiter), asking for a specific course. FastAPI goes to the kitchen (our SQLite Database), gets the data, and brings it back to the frontend as JSON.
2. **Pydantic**: A library that comes with FastAPI. It enforces strict "data shapes" (Schemas). It ensures that if the frontend tries to send a chat message without text, the server immediately rejects it, preventing confusing crashes later in the code.
3. **RAG (Retrieval-Augmented Generation)**: Large Language Models like ChatGPT only know what they were trained on up to a certain date. They don't know the specific rules of UofT for the 2025 school year. **RAG** solves this. When a user asks a question, we *intercept* that question, search our ChromaDB vector database for the relevant UofT rules, and feed those rules to ChatGPT hidden in the background as a "System Prompt" before it answers the user.

---

## Step 1: Define API Contracts with Pydantic (`backend/models.py`)

First, we define exactly what data our API expects and returns.

Create `backend/models.py`:

```python
from pydantic import BaseModel
from typing import List, Optional

# A single message in the chat history
class ChatMessage(BaseModel):
    role: str       # Must be "user" or "assistant"
    content: str    # The actual text of the message

# What the frontend sends us when they ask a question:
class ChatRequest(BaseModel):
    messages: List[ChatMessage]       # The entire conversation history
    course_context: Optional[str] = None # (Optional) If they are viewing a specific course page, tell the AI!

# What we send back to the frontend:
class ChatResponse(BaseModel):
    reply: str
    sources: List[str] = [] # Let the user know where we got the info (e.g., "Vector Search")

# How a course looks when the frontend asks for catalog data:
class CourseDetails(BaseModel):
    course_code: str
    title: str
    description: str
    prerequisites: str
    corequisites: str
    exclusions: str
    breadth_requirements: str
```

---

## Step 2: Build the RAG Engine (`backend/services/rag.py`)

This is the core AI logic. We need to fetch semantic rules from ChromaDB and structured facts from SQLite. 

Create `backend/services/rag.py`:

```python
import os
import sys
from typing import List, Dict, Any
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

# Import the database functions we built in Phase 2
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from database import get_chroma_client, get_db_connection

def retrieve_academic_context(query: str, k: int = 3) -> str:
    """
    How Semantic Search Works:
    1. We take the user's question (e.g., "Can I take CSC311 without statistics?")
    2. We convert it to a vector (a list of numbers) using OpenAIEmbeddings.
    3. We compare that vector to all the vectors we saved in ChromaDB in Phase 2.
    4. ChromaDB returns the top 'k' (in this case 3) most mathematically similar chunks of text!
    """
    client = get_chroma_client()
    collection = client.get_collection(name="academic_rules")
    
    # We MUST use the exact same embedding model we used during chunking in Phase 2
    embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small")
    query_embedding = embeddings_model.embed_query(query)
    
    # Search ChromaDB for the closest semantic matches
    results = collection.query(query_embeddings=[query_embedding], n_results=k)
    
    # Combine the top 3 chunks into one big string to give to ChatGPT
    if results['documents']:
        return "\n\n---\n\n".join(results['documents'][0])
    return ""

def get_course_info(course_code: str):
    """Simple standard SQL lookup to get exact string facts (like prerequisites)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM courses WHERE course_code = ?", (course_code.upper(),))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else {}

def generate_chat_response(messages: List[Dict[str, str]], course_context: str = None):
    """
    This is the master function that binds it all together.
    """
    # 1. Figure out what the user is currently asking (the last message they sent)
    latest_query = next((m['content'] for m in reversed(messages) if m['role'] == 'user'), "")
    
    # 2. Go get the academic rules from ChromaDB based on that question
    academic_rules = retrieve_academic_context(latest_query)
    
    # 3. Build the "System Prompt". This is a hidden instruction we give ChatGPT
    #    that the user never sees.
    system_prompt = "You are the UofT AI Course Copilot, a helpful academic advisor. Answer accurately based ONLY on the provided context."
    
    # Inject our ChromaDB knowledge into the prompt!
    if academic_rules:
        system_prompt += f"\n\nRelevant Academic Rules:\n{academic_rules}"
        
    # Inject our SQLite knowledge into the prompt!
    if course_context:
        course_data = get_course_info(course_context)
        system_prompt += f"\n\nCurrently Viewed Course Context:\n{course_data}"

    # 4. Format everything for LangChain (it requires special objects)
    langchain_messages = [SystemMessage(content=system_prompt)]
    for msg in messages:
        if msg['role'] == 'user':
            langchain_messages.append(HumanMessage(content=msg['content']))
        else:
            langchain_messages.append(AIMessage(content=msg['content']))

    # 5. Send this massive bundle of context + chat history to OpenAI!
    # We use temperature=0.2 so the AI doesn't hallucinate. It sticks strict to the facts.
    chat_model = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
    response = chat_model.invoke(langchain_messages)
        
    return response.content, ["Vector Search", "SQL DB"]
```

---

## Step 3: Wire up the Web Endpoints (FastAPI)

Now we need to expose our RAG engine to the internet so the frontend can use it. We use `APIRouter` to organize our URLs.

Create `backend/api/chat.py`:

```python
from fastapi import APIRouter, HTTPException
import sys, os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from models import ChatRequest, ChatResponse
from services.rag import generate_chat_response

# This means every route in this file automatically starts with /api/chat
router = APIRouter(prefix="/api/chat", tags=["chat"])

# @router.post means the frontend must send an HTTP POST request to this URL.
# We tell FastAPI that it will receive a ChatRequest, and it should return a ChatResponse.
@router.post("/", response_model=ChatResponse)
async def chat_with_advisor(request: ChatRequest):
    
    # Convert Pydantic objects back to a list of standard python dictionaries
    formatted_msgs = [{"role": msg.role, "content": msg.content} for msg in request.messages]
    
    # Pass the request to the RAG engine we built in Step 2
    reply, sources = generate_chat_response(formatted_msgs, request.course_context)
    
    # Return the ChatResponse Pydantic object back to the frontend!
    return ChatResponse(reply=reply, sources=sources)
```

Create `backend/api/courses.py` (For simply browsing the catalog):

```python
from fastapi import APIRouter, HTTPException
from typing import List
import sys, os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from models import CourseDetails
from database import get_db_connection

router = APIRouter(prefix="/api/courses", tags=["courses"])

@router.get("/", response_model=List[CourseDetails])
async def get_all_courses(limit: int = 100, offset: int = 0):
    """Retrieves a paginated list of all courses in the catalog using basic SQL."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM courses LIMIT ? OFFSET ?", (limit, offset))
    rows = cursor.fetchall()
    conn.close()
    
    return [CourseDetails(**dict(row)) for row in rows]
```

---

## Step 4: Start the Server (`backend/main.py`)

Finally, we hook all our routers into the main `FastAPI` app instance and handle **CORS**. CORS (Cross-Origin Resource Sharing) is a security feature built into browsers. If our Next.js frontend is running on port `3000`, and our FastAPI server is running on port `8000`, the browser will *block* the request unless the FastAPI server explicitly says "Port 3000 is allowed to talk to me!".

Edit `backend/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import chat, courses  

app = FastAPI(title="UofT AI Copilot API", version="1.0.0")

# Allow CORS for Next.js frontend (Crucial for local development!)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach our routers!
app.include_router(chat.router)
app.include_router(courses.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to UofT AI Copilot API"}
```

### Starting the Application

To run this backend server, open your terminal and type:
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```
`uvicorn` is the high-performance asynchronous web server that runs FastAPI. The `--reload` flag means that every time you save a `.py` file, the server will restart automatically!

Go to `http://localhost:8000/docs` in your browser. FastAPI automatically creates beautiful Swagger documentation where you can test your APIs!
