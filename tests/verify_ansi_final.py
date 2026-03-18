import asyncio
from playwright.async_api import async_playwright

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        page.set_default_timeout(30000)

        await page.goto("http://localhost:5173")
        await page.wait_for_selector("text=TS ready", timeout=90000)

        editor = page.locator("textarea").first
        await editor.focus()
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Backspace")

        # Truecolor orange: 255, 100, 0 -> #ff6400
        await page.keyboard.type('console.log("\\u001b[38;2;255;100;0mORANGE\\u001b[0m");')

        run_button = page.locator("button", has_text="Run")
        await run_button.click()

        # Wait for the specific LOG entry
        try:
            log_entry = page.locator("div.border-b.border-surface0\\/40", has_text="ORANGE")
            await log_entry.wait_for(state="visible", timeout=10000)

            html = await log_entry.inner_html()
            print(f"HTML: {html}")

            if 'color:#ff6400' in html.lower() or 'color: #ff6400' in html.lower() or 'rgb(255, 100, 0)' in html:
                print("SUCCESS: TrueColor Orange verified!")
            else:
                print("FAILURE: TrueColor Orange NOT found.")
        except Exception as e:
            print(f"Error: {e}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
