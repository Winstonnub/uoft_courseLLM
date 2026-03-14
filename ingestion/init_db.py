import sqlite3
import json
import os
import sys

# Add the backend directory to sys.path so we can import database
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
from database import get_db_connection

def ingest_courses():
    """Reads courses.json and inserts/updates them in the SQLite database."""
    file_path = os.path.join(os.path.dirname(__file__), 'raw_data', 'courses.json')
    
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found. Have you run scrape_calendar.py?")
        return
        
    with open(file_path, 'r', encoding='utf-8') as f:
        courses = json.load(f)
        
    print(f"Loaded {len(courses)} courses from JSON. Ingesting into SQLite...")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    count = 0
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
            course.get('prerequisites', ''),
            course.get('corequisites', ''),
            course.get('exclusions', ''),
            course.get('breadth_requirements', '')
        ))
        count += 1
        
    conn.commit()
    conn.close()
    print(f"Successfully ingested {count} courses into the database.")

if __name__ == "__main__":
    ingest_courses()
