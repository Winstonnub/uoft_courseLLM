import praw
import os
import json
from dotenv import load_dotenv

# Load credentials from backend/.env
load_dotenv("../../backend/.env")

# This scraper requires REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET
def scrape_reddit_sentiment(course_codes):
    client_id = os.getenv("REDDIT_CLIENT_ID")
    client_secret = os.getenv("REDDIT_CLIENT_SECRET")
    user_agent = os.getenv("REDDIT_USER_AGENT", "uoft-copilot-scraper:v1.0 (by u/yourusername)")

    if not client_id or not client_secret or client_id == "YOUR_REDDIT_ID":
        print("Missing or default Reddit credentials. Please check backend/.env")
        return

    reddit = praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=user_agent
    )

    results = []
    print(f"Scraping r/UofT for {len(course_codes)} courses...")
    
    for code in course_codes:
        print(f"Searching for {code}...")
        course_data = {"course_code": code, "threads": []}
        
        # Search the subreddit for the course code
        for submission in reddit.subreddit("UofT").search(code, limit=5, sort="relevance"):
            thread_info = {
                "title": submission.title,
                "score": submission.score,
                "url": submission.url,
                "text": submission.selftext[:1000],  # keep it short for RAG context limit
                "top_comments": []
            }
            
            # Fetch top level comments only
            submission.comments.replace_more(limit=0)
            for comment in submission.comments[:3]:
                thread_info["top_comments"].append({
                    "score": comment.score,
                    "text": comment.body[:500]
                })
                
            course_data["threads"].append(thread_info)
            
        results.append(course_data)
        
    os.makedirs("../raw_data", exist_ok=True)
    with open("../raw_data/reddit_sentiment.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("Saved Reddit sentiment to ingestion/raw_data/reddit_sentiment.json")

if __name__ == "__main__":
    # Example set of courses to test your hackathon MVP
    test_courses = ["CSC311", "CSC373", "MAT137", "RSM219"]
    scrape_reddit_sentiment(test_courses)
