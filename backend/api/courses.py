from fastapi import APIRouter, HTTPException
from typing import List
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from models import CourseDetails
from database import get_db_connection

router = APIRouter(
    prefix="/api/courses",
    tags=["courses"],
)

@router.get("/", response_model=List[CourseDetails])
async def get_all_courses(limit: int = 100, offset: int = 0):
    """Retrieves a paginated list of all courses in the catalog."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM courses LIMIT ? OFFSET ?", (limit, offset))
    rows = cursor.fetchall()
    conn.close()
    
    return [CourseDetails(**dict(row)) for row in rows]

@router.get("/{course_code}", response_model=CourseDetails)
async def get_course(course_code: str):
    """Retrieves detailed information for a specific course by its 8-character code."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM courses WHERE course_code = ?", (course_code.upper(),))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail=f"Course {course_code} not found")
        
    return CourseDetails(**dict(row))
