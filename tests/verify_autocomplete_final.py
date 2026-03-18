import asyncio
from playwright.async_api import async_playwright
import os
import time

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        page.set_default_timeout(30000)

        await page.goto("http://localhost:5173")
        await page.wait_for_selector("text=TS ready", timeout=90000)

        # Select all and delete
        editor = page.locator("textarea").first
        await editor.focus()
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Backspace")

        # Type something simple
        await page.keyboard.type("const obj = { apple: 1, banana: 2 };\nobj.")

        await asyncio.sleep(2)

        listbox = page.locator("ul[role='listbox']")
        try:
            await listbox.wait_for(state="visible", timeout=10000)
            items = listbox.locator("li")
            count = await items.count()
            print(f"Found {count} items.")

            # Click apple
            for i in range(count):
                text = await items.nth(i).inner_text()
                if "apple" in text:
                    print(f"Clicking apple at index {i}")
                    await items.nth(i).click()
                    break

            content = await editor.input_value()
            print(f"Last line: {content.strip().split('\n')[-1]}")

            if "obj.apple" in content:
                print("SUCCESS: Autocomplete selection works!")
            else:
                print("FAILURE: Selection not reflected in editor.")

        except Exception as e:
            print(f"Autocomplete did not show: {e}")
            await page.screenshot(path="/home/jules/verification/final_autocomplete_fail.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
