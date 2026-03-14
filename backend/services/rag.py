import os
import re
from typing import List, Dict, Any, Tuple
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

# Import the database connections
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from database import get_chroma_client, get_db_connection

# Regex to detect UofT course codes like MAT223, CSC311H1, STA257H1F, etc.
COURSE_CODE_PATTERN = re.compile(r'\b([A-Z]{3}\d{3,4}(?:H1|Y1)?(?:[FSY])?)\b', re.IGNORECASE)

def extract_course_codes(text: str) -> List[str]:
    """Extract all UofT course codes mentioned in the text."""
    matches = COURSE_CODE_PATTERN.findall(text)
    # Normalize: uppercase and truncate to 8-char code for DB lookup
    codes = set()
    for m in matches:
        code = m.upper()
        # Our DB stores 8-char codes like "MAT223H1". If user types "MAT223", try both.
        if len(code) <= 6:
            codes.add(code + "H1")  # Try adding H1
            codes.add(code + "Y1")  # Try adding Y1
        codes.add(code)
    return list(codes)

def search_courses_by_keyword(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """Search courses by keyword in title or description."""
    conn = get_db_connection()
    cursor = conn.cursor()
    search_term = f"%{query}%"
    cursor.execute("""
        SELECT * FROM courses 
        WHERE course_code LIKE ? OR title LIKE ? OR description LIKE ?
        LIMIT ?
    """, (search_term, search_term, search_term, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def retrieve_academic_context(query: str, k: int = 3) -> str:
    """Retrieves relevant academic rules from ChromaDB."""
    client = get_chroma_client()
    try:
        collection = client.get_collection(name="academic_rules")
        if collection.count() == 0:
            return ""
    except Exception:
        return ""
    
    try:
        embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small")
        query_embedding = embeddings_model.embed_query(query)
        
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=k
        )
        
        if not results['documents'] or not results['documents'][0]:
            return ""
            
        context_chunks = results['documents'][0]
        return "\n\n---\n\n".join(context_chunks)
    except Exception as e:
        print(f"Error in vector search: {e}")
        return ""

def get_course_info(course_code: str) -> Dict[str, Any]:
    """Retrieves specific course information from SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM courses WHERE course_code = ?", (course_code.upper(),))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return {}

def format_course_for_prompt(course: Dict[str, Any]) -> str:
    """Format a course dict into a readable string for the LLM."""
    parts = [f"**{course.get('course_code', 'N/A')}** — {course.get('title', 'N/A')}"]
    if course.get('description'):
        parts.append(f"  Description: {course['description']}")
    if course.get('prerequisites'):
        parts.append(f"  Prerequisites: {course['prerequisites']}")
    if course.get('corequisites'):
        parts.append(f"  Corequisites: {course['corequisites']}")
    if course.get('exclusions'):
        parts.append(f"  Exclusions: {course['exclusions']}")
    if course.get('breadth_requirements'):
        parts.append(f"  Breadth: {course['breadth_requirements']}")
    return "\n".join(parts)

def generate_chat_response(messages: List[Dict[str, str]], course_context: str = None) -> Tuple[str, List[str]]:
    """Generates a response using ChatGPT augmented with our data."""
    # 1. Get the latest user query
    latest_query = next((m['content'] for m in reversed(messages) if m['role'] == 'user'), "")
    
    sources = []

    # 2. Auto-detect course codes mentioned by the user
    detected_codes = extract_course_codes(latest_query)
    course_data_blocks = []
    
    for code in detected_codes:
        info = get_course_info(code)
        if info:
            course_data_blocks.append(format_course_for_prompt(info))
            sources.append(f"SQL: {info['course_code']}")
    
    # 3. If no course codes were detected, try keyword search
    if not course_data_blocks and len(latest_query.split()) <= 8:
        keyword_results = search_courses_by_keyword(latest_query, limit=3)
        for info in keyword_results:
            course_data_blocks.append(format_course_for_prompt(info))
            sources.append(f"SQL: {info['course_code']}")

    # 4. If a specific course_context was passed from the frontend, also include it
    if course_context:
        info = get_course_info(course_context)
        if info and format_course_for_prompt(info) not in course_data_blocks:
            course_data_blocks.append(format_course_for_prompt(info))
            sources.append(f"SQL: {info['course_code']}")

    # 5. Retrieve semantic context from ChromaDB
    academic_rules = retrieve_academic_context(latest_query)
    if academic_rules:
        sources.append("Vector: academic_rules")
    
    # 6. Build the system prompt
    system_prompt = """You are the UofT AI Course Copilot, a knowledgeable academic advisor for the University of Toronto.
You help students plan their degrees, understand course rules, prerequisites, and academic policies.

IMPORTANT RULES:
- Answer accurately based on the provided context below.
- When discussing a course, always mention its full title, prerequisites, and any important details from the context.
- If you have course data in the context, USE IT to give a detailed answer.
- If you truly don't have information about something, say so honestly.
"""
    
    if course_data_blocks:
        system_prompt += "\n\n=== COURSE DATABASE (from UofT Course Calendar) ===\n"
        system_prompt += "\n\n".join(course_data_blocks)
        system_prompt += "\n=== END COURSE DATABASE ==="

    if academic_rules:
        system_prompt += f"\n\n=== ACADEMIC RULES (from UofT Academic Calendar) ===\n{academic_rules}\n=== END ACADEMIC RULES ==="

    # 7. Construct LangChain messages
    langchain_messages = [SystemMessage(content=system_prompt)]
    for msg in messages:
        if msg['role'] == 'user':
            langchain_messages.append(HumanMessage(content=msg['content']))
        elif msg['role'] == 'assistant':
            langchain_messages.append(AIMessage(content=msg['content']))

    # 8. Call OpenAI
    try:
        chat_model = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
        response = chat_model.invoke(langchain_messages)
        return response.content, sources
    except Exception as e:
        import traceback
        err = traceback.format_exc()
        print(f"Error calling LLM: {e}")
        return f"I'm sorry, I'm having trouble connecting to my brain right now.\n\nError Traceback:\n```text\n{err}\n```", []
