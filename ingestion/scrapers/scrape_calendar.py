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
    
    # UofT Calendar pagination uses ?page=N (from 0 to 178 based on user input)
    MAX_PAGES = 179
    
    for page_num in range(MAX_PAGES):
        url = f"{SEARCH_URL}?page={page_num}"
        print(f"Scraping page {page_num + 1} of {MAX_PAGES}...")
        
        try:
            response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
            response.raise_for_status()
        except Exception as e:
            print(f"Failed to fetch {url}: {e}")
            continue
            
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Typically courses are in div classes like 'views-row'
        rows = soup.find_all("div", class_="views-row")
        
        if not rows:
            print(f"No more courses found on page {page_num}. Ending early.")
            break
        
        page_courses = 0
        for row in rows:
            title_tag = row.find("h3")
            if not title_tag:
                continue
                
            course_title = title_tag.get_text(strip=True)
            # Only include the 8-character course code; the rest goes to title
            import re
            match = re.match(r"^([A-Z0-9]{3}[0-9]{3}[HY][0-9])(.*)$", course_title)
            if match:
                code = match.group(1)
                name = match.group(2).strip(" -:")
            else:
                parts = re.split(r'[:\-]', course_title, maxsplit=1)
                code = parts[0].strip()[:8]
                name = parts[1].strip() if len(parts) > 1 else course_title[8:].strip(" -:")
            
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
            
            # Breadth Requirements
            breadth_div = row.find("span", class_="views-field-field-breadth-requirements")
            breadth = ""
            if breadth_div:
                breadth_content = breadth_div.find("span", class_="field-content")
                breadth = breadth_content.get_text(separator=" ", strip=True) if breadth_content else ""
            
            courses.append({
                "course_code": code,
                "title": name,
                "description": description,
                "prerequisites": prereq,
                "corequisites": coreq,
                "exclusions": exclusion,
                "breadth_requirements": breadth
            })
            page_courses += 1
            
        print(f"  Got {page_courses} courses from page {page_num + 1}.")
        time.sleep(1) # Be a good citizen, don't spam the server
        
    print(f"\nScraping complete. Total courses scraped: {len(courses)}")
    
    # Save to JSON
    os.makedirs("../raw_data", exist_ok=True)
    with open("../raw_data/courses.json", "w", encoding="utf-8") as f:
        json.dump(courses, f, indent=2)
        
    print("Saved to ingestion/raw_data/courses.json")

if __name__ == "__main__":
    scrape_calendar()
