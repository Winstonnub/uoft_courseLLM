import os
from typing import List, Dict, Any
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

# Let's import the database connections
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from database import get_chroma_client, get_db_connection

def retrieve_academic_context(query: str, k: int = 3) -> str:
    """Retrieves relevant academic rules from ChromaDB."""
    client = get_chroma_client()
    try:
        collection = client.get_collection(name="academic_rules")
    except Exception:
        # If the collection doesn't exist yet
        return ""
    
    # We need the embedding model to query
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

def generate_chat_response(messages: List[Dict[str, str]], course_context: str = None) -> tuple[str, List[str]]:
    """Generates a response using ChatGPT augmented with our data."""
    # 1. Get the latest user query
    latest_query = next((m['content'] for m in reversed(messages) if m['role'] == 'user'), "")
    
    # 2. Retrieve semantic context
    academic_rules = retrieve_academic_context(latest_query)
    
    # 3. Build the system prompt
    system_prompt = """You are the UofT AI Course Copilot, a helpful academic advisor.
You help students plan their degrees and understand course rules.
Answer accurately based ONLY on the provided context. If you don't know, say so.
"""
    if academic_rules:
        system_prompt += f"\n\nRelevant Academic Rules:\n{academic_rules}"
        
    if course_context:
        # If the web app is specifically viewing a course
        course_data = get_course_info(course_context)
        if course_data:
            course_text = f"Course Code: {course_data.get('course_code')}\n"
            course_text += f"Title: {course_data.get('title')}\n"
            course_text += f"Description: {course_data.get('description')}\n"
            course_text += f"Prerequisites: {course_data.get('prerequisites')}\n"
            system_prompt += f"\n\nCurrently Viewed Course Context:\n{course_text}"

    # 4. Construct LangChain messages
    langchain_messages = [SystemMessage(content=system_prompt)]
    for msg in messages:
        if msg['role'] == 'user':
            langchain_messages.append(HumanMessage(content=msg['content']))
        elif msg['role'] == 'assistant':
            langchain_messages.append(AIMessage(content=msg['content']))

    # 5. Call OpenAI
    try:
        # Use gpt-4o-mini as decided in Phase 1
        chat_model = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
        response = chat_model.invoke(langchain_messages)
        
        # We could extract sources from metadata, but keeping it simple for now
        sources = ["Vector Search: academic_rules"] if academic_rules else []
        if course_context:
            sources.append(f"SQL DB: {course_context}")
            
        return response.content, sources
    except Exception as e:
        print(f"Error calling LLM: {e}")
        return "I'm sorry, I'm having trouble connecting to my brain right now.", []
