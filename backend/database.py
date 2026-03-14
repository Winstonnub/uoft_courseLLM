import sqlite3
import os
import chromadb

# Define paths relative to the backend directory
DB_PATH = os.path.join(os.path.dirname(__file__), "copilot.db")
CHROMA_PATH = os.path.join(os.path.dirname(__file__), "chroma_db")

def get_db_connection():
    """Returns a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Returns rows as dictionary-like objects
    return conn

def init_sqlite_db():
    """Initializes the SQLite database schema."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Courses table
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
    
    # We will skip timetable sections and meetings tables for now
    
    conn.commit()
    conn.close()
    print("SQLite database initialized successfully.")

def get_chroma_client():
    """Returns a client for the ChromaDB vector store."""
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    return client

def init_chroma_db():
    """Initializes the ChromaDB collections."""
    client = get_chroma_client()
    
    # Create or get collections
    client.get_or_create_collection(name="course_catalog")
    client.get_or_create_collection(name="syllabi")
    client.get_or_create_collection(name="reddit_discussions")
    client.get_or_create_collection(name="academic_rules")
    
    print("ChromaDB collections initialized successfully.")

if __name__ == "__main__":
    init_sqlite_db()
    init_chroma_db()
