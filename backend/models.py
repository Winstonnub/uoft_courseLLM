from pydantic import BaseModel
from typing import List, Optional

class ChatMessage(BaseModel):
    role: str
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
