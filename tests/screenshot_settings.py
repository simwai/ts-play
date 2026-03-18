import asyncio
from playwright.async_api import async_playwright

async def main():
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            await page.set_viewport_size({"width": 1280, "height": 800})

            print("Navigating to app...")
            await page.goto("http://localhost:5173", timeout=10000, wait_until="load")

            # Take a full page screenshot to see what's going on
            print("Taking debug screenshot...")
            await page.screenshot(path="verification/debug_full.png")

            # Search for ANY data-testid to see if they are rendered
            print("Checking for any data-testid...")
            elements = await page.query_selector_all("[data-testid]")
            print(f"Found {len(elements)} elements with data-testid")
            for el in elements:
                tid = await el.get_attribute("data-testid")
                print(f" - {tid}")

            await browser.close()
            print("Done.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
