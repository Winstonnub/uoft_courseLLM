from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import asyncio
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
    time_preference: str = 'balanced'  # 'early', 'balanced', or 'late'

@router.post("/generate")
async def generate_schedule(request: ScheduleRequest):
    """
    Generate session-aware, conflict-free timetable schedules.
    
    Accepts a list of course codes and a time_preference ('early', 'balanced', 'late').
    Returns separate Fall and Winter timetables.
    """
    result = await asyncio.to_thread(
        generate_schedules,
        course_codes=request.course_codes,
        max_schedules=request.max_schedules,
        time_preference=request.time_preference,
    )
    return result
