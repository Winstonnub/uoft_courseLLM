# Phase 3 Tutorial: RAG Pipeline and FastAPI Endpoints

This tutorial explains the exact steps to implement the Retrieval-Augmented Generation (RAG) backend API for our AI Course Advisor. 

It is written as if you asked a coding assistant: *"How do I connect my SQLite database and ChromaDB vector store to a FastAPI web server using OpenAI for generation?"*

---

## Step 1: Define Your API Contracts (Pydantic Models)

Before building Web APIs, you must strictly define what the application expects to receive from the frontend and what it promises to send back. We use Python's `pydantic` library for this.

Create `backend/models.py`:

```python
from pydantic import BaseModel
from typing import List, Optional

class ChatMessage(BaseModel):
    role: str       # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    course_context: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    sources: List[str] = []

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

## Step 2: Build the RAG Engine

RAG (Retrieval-Augmented Generation) is simply the act of taking a generic LLM (like GPT-4), fetching specific data (like UofT SQL databases and Chroma semantic vectors), and stuffing it all into a System Prompt so the AI has context before answering.

Create `backend/services/rag.py`:

```python
import os
import sys
from typing import List, Dict, Any
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

# Import DB connections we made in Phase 2
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from database import get_chroma_client, get_db_connection

def retrieve_academic_context(query: str, k: int = 3) -> str:
    """Fetch semantic rules from ChromaDB."""
    client = get_chroma_client()
    collection = client.get_collection(name="academic_rules")
    
    embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small")
    query_embedding = embeddings_model.embed_query(query)
    
    # Vector Similarity Search!
    results = collection.query(query_embeddings=[query_embedding], n_results=k)
    return "\n\n---\n\n".join(results['documents'][0]) if results['documents'] else ""

def get_course_info(course_code: str):
    """Fetch strict SQL data."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM courses WHERE course_code = ?", (course_code.upper(),))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else {}

def generate_chat_response(messages: List[Dict[str, str]], course_context: str = None):
    """The master generation function."""
    latest_query = next((m['content'] for m in reversed(messages) if m['role'] == 'user'), "")
    
    academic_rules = retrieve_academic_context(latest_query)
    
    # 1. Start building the master prompt
    system_prompt = "You are the UofT AI Course Copilot..."
    
    # 2. Inject Vector Knowledge
    if academic_rules:
        system_prompt += f"\n\nRelevant Academic Rules:\n{academic_rules}"
        
    # 3. Inject Relational Knowledge
    if course_context:
        course_data = get_course_info(course_context)
        system_prompt += f"\n\nCurrently Viewed Course Context:\n{course_data}"

    # 4. Format for LangChain
    langchain_messages = [SystemMessage(content=system_prompt)]
    for msg in messages:
        if msg['role'] == 'user':
            langchain_messages.append(HumanMessage(content=msg['content']))
        else:
            langchain_messages.append(AIMessage(content=msg['content']))

    # 5. Send to OpenAI
    chat_model = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
    response = chat_model.invoke(langchain_messages)
        
    return response.content, ["Vector Search", "SQL DB"]
```

---

## Step 3: Wire the Routes to FastAPI

Now we expose our `generate_chat_response` logic and our raw SQL database to the internet so the Frontend Javascript can hit them.

Create `backend/api/chat.py`:
```python
from fastapi import APIRouter, HTTPException
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from models import ChatRequest, ChatResponse
from services.rag import generate_chat_response

router = APIRouter(prefix="/api/chat", tags=["chat"])

@router.post("/", response_model=ChatResponse)
async def chat_with_advisor(request: ChatRequest):
    # Call our RAG service
    formatted_msgs = [{"role": msg.role, "content": msg.content} for msg in request.messages]
    reply, sources = generate_chat_response(formatted_msgs, request.course_context)
    return ChatResponse(reply=reply, sources=sources)
```

Finally, hook it into `backend/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import chat, courses  

app = FastAPI(title="UofT AI Copilot API")

# VERY IMPORTANT: This allows Next.js (port 3000) to talk to FastAPI (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
# app.include_router(courses.router)
```

**To start the server:** 
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

### You're Done!
The backend APIs are now running. Kiko can now build the React interface to POST messages to `http://localhost:8000/api/chat`.
