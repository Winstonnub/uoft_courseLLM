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
    session: Optional[str] = None
    max_schedules: int = 5

@router.post("/generate")
async def generate_schedule(request: ScheduleRequest):
    """
    Generate non-conflicting timetable schedules.
    
    Accepts a list of course codes the user wants to take.
    Returns up to `max_schedules` valid schedules ranked by seat availability,
    along with warnings about full/waitlisted sections.
    """
    result = generate_schedules(
        course_codes=request.course_codes,
        session=request.session,
        max_schedules=request.max_schedules,
    )
    return result
