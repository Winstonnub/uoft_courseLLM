from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from services.scheduler import generate_schedules

router = APIRouter(
    prefix="/api/schedule",
    tags=["schedule"],
)

class ScheduleRequest(BaseModel):
    course_codes: List[str]
    max_schedules: int = 5

@router.post("/generate")
async def generate_schedule(request: ScheduleRequest):
    """
    Generate session-aware, conflict-free timetable schedules.
    
    Accepts a list of course codes. Returns separate Fall and Winter
    timetables. Full-year (Y) courses are locked to the same section
    in both semesters.
    """
    result = generate_schedules(
        course_codes=request.course_codes,
        max_schedules=request.max_schedules,
    )
    return result
