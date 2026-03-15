from fastapi import APIRouter, HTTPException
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from models import ChatRequest, ChatResponse
from services.rag import generate_chat_response

router = APIRouter(
    prefix="/api/chat",
    tags=["chat"],
)

@router.post("/", response_model=ChatResponse)
async def chat_with_advisor(request: ChatRequest):
    """
    Endpoint for the AI Course Advisor chat interface.
    Accepts conversation history and optional current viewed course context.
    Returns the LLM's response and the sources used.
    """
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")

    # Format messages to Dictionary
    formatted_msgs = [{"role": msg.role, "content": msg.content} for msg in request.messages]
    
    reply, sources = generate_chat_response(
        messages=formatted_msgs,
        course_context=request.course_context
    )
    
    return ChatResponse(reply=reply, sources=sources)
