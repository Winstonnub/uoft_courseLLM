from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import chat, courses

app = FastAPI(title="UofT AI Copilot API", version="1.0.0")

# Allow CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(courses.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to UofT AI Copilot API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
