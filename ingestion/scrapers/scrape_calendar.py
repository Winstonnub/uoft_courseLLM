import requests
from bs4 import BeautifulSoup
import json
import os
import time

# UofT ArtSci Calendar search endpoint
SEARCH_URL = "https://artsci.calendar.utoronto.ca/search-courses"

def scrape_calendar():
    print("Scraping UofT ArtSci Calendar...")
    courses = []
    
    # In a real hackathon, you would figure out the pagination or exact API.
    # UofT Calendar often uses a views AJAX format for pagination if it's Drupal.
    # We will grab the first page directly as an example.
    
    try:
        response = requests.get(SEARCH_URL, headers={"User-Agent": "Mozilla/5.0"})
        response.raise_for_status()
    except Exception as e:
        print(f"Failed to fetch calendar: {e}")
        return
        
    soup = BeautifulSoup(response.text, "html.parser")
    
    # Typically courses are in div classes like 'views-row'
    rows = soup.find_all("div", class_="views-row")
    
    for row in rows:
        title_tag = row.find("h3")
        if not title_tag:
            continue
            
        course_title = title_tag.get_text(strip=True)
        # Assuming title_tag contains text like "ACT230H1: Mathematics of Finance for Non-Actuaries"
        parts = course_title.split(":", 1)
        code = parts[0].strip() if len(parts) > 1 else course_title
        name = parts[1].strip() if len(parts) > 1 else ""
        
        # We try to find the description (which sits in views-field-body)
        desc_div = row.find("div", class_="views-field-body")
        description = desc_div.get_text(separator=" ", strip=True) if desc_div else ""
        
        # Prerequisites
        prereq_div = row.find("span", class_="views-field-field-prerequisite")
        prereq = ""
        if prereq_div:
            prereq_content = prereq_div.find("span", class_="field-content")
            prereq = prereq_content.get_text(separator=" ", strip=True) if prereq_content else ""
            
        # Corequisites
        coreq_div = row.find("span", class_="views-field-field-corequisite")
        coreq = ""
        if coreq_div:
            coreq_content = coreq_div.find("span", class_="field-content")
            coreq = coreq_content.get_text(separator=" ", strip=True) if coreq_content else ""

        # Exclusions
        exclusion_div = row.find("span", class_="views-field-field-exclusion")
        exclusion = ""
        if exclusion_div:
            exclusion_content = exclusion_div.find("span", class_="field-content")
            exclusion = exclusion_content.get_text(separator=" ", strip=True) if exclusion_content else ""
        
        courses.append({
            "course_code": code,
            "title": name,
            "description": description,
            "prerequisites": prereq,
            "corequisites": coreq,
            "exclusions": exclusion
        })
        
    print(f"Scraped {len(courses)} courses from page 1.")
    
    # Save to JSON
    os.makedirs("../raw_data", exist_ok=True)
    with open("../raw_data/courses.json", "w", encoding="utf-8") as f:
        json.dump(courses, f, indent=2)
        
    print("Saved to ingestion/raw_data/courses.json")

if __name__ == "__main__":
    scrape_calendar()
