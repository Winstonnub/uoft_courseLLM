import requests
import json
import os

# Trying the known UofT timetable API endpoint for Fall 2024 (20249) or Winter 2025 (20251)
# You can change the year/term flag as needed.
API_URL = "https://timetable.iit.artsci.utoronto.ca/api/20249/courses?org=&code=CSC311"

def fetch_timetable():
    print(f"Fetching timetable from {API_URL}...")
    try:
        response = requests.get(API_URL, headers={"User-Agent": "Mozilla/5.0"})
        response.raise_for_status()
        
        data = response.json()
        print(f"Got response for {len(data)} courses.")
        
        os.makedirs("../raw_data", exist_ok=True)
        with open("../raw_data/timetable_sample.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print("Saved to ingestion/raw_data/timetable_sample.json")
    except Exception as e:
        print(f"Failed to fetch timetable API: {e}")

if __name__ == "__main__":
    fetch_timetable()
