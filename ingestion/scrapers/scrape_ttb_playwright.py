import asyncio
import json
import os
from playwright.async_api import async_playwright

# NOTE: ttb.utoronto.ca often employs strong anti-bot (Akamai) protections.
# Using playwright with stealth extensions might be necessary.
# This script launches a visible browser, types "CSC311", and intercepts the API JSON.

async def scrape_ttb():
    print("Launching Playwright to scrape ttb.utoronto.ca...")
    results = []

    async with async_playwright() as p:
        # Launching non-headless can sometimes bypass basic bot detection
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        # Intercept network requests that look like JSON APIs
        async def handle_response(response):
            # Check if this is the API returning course sections
            if "api/courses" in response.url or "graphql" in response.url:
                try:
                    data = await response.json()
                    print(f"Intercepted API Response from: {response.url}")
                    results.append(data)
                except Exception:
                    pass
        
        page.on("response", handle_response)
        
        await page.goto("https://ttb.utoronto.ca/")
        await page.wait_for_timeout(3000)
        
        # Example: Type "CSC311" into the search bar
        # Note: Selectors might need updating based on the exact DOM
        try:
            search_input = await page.wait_for_selector('input[type="text"]', timeout=5000)
            if search_input:
                await search_input.fill("CSC311")
                await page.keyboard.press("Enter")
                await page.wait_for_timeout(5000) # wait for API responses
        except Exception as e:
            print(f"Could not interact with search bar: {e}")
        
        await browser.close()
        
    if results:
        os.makedirs("../raw_data", exist_ok=True)
        with open("../raw_data/timetable_playwright_sample.json", "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        print("Saved intercepted JSON to ingestion/raw_data/timetable_playwright_sample.json")
    else:
        print("No API data intercepted. TTB might be blocking requests or the selector is wrong.")

if __name__ == "__main__":
    asyncio.run(scrape_ttb())
