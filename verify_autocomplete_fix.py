import asyncio
from playwright.async_api import async_playwright
import os
import time

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Increase timeout
        page.set_default_timeout(30000)

        print("Navigating to app...")
        try:
            await page.goto("http://localhost:5173", timeout=60000)
        except Exception as e:
            print(f"Error navigating to app: {e}")
            await browser.close()
            return

        # Wait for TS to be ready
        print("Waiting for TS ready...")
        try:
            await page.wait_for_selector("text=TS ready", timeout=60000)
        except Exception as e:
            print(f"Error waiting for TS ready: {e}")
            await page.screenshot(path="/home/jules/verification/ts_not_ready.png")
            await browser.close()
            return

        # Focus editor and type
        print("Typing 'greet.' at the end of file...")
        editor = page.locator("textarea")
        await editor.focus()
        # Move to end of file
        await page.keyboard.press("Control+End")
        await page.keyboard.press("Enter")
        await page.keyboard.type("greet.")

        # Wait for autocomplete listbox
        print("Waiting for autocomplete listbox...")
        try:
            # The listbox has z-50 and bg-[#1e1e2e]
            listbox_selector = "div.absolute.z-50.bg-\\[\\#1e1e2e\\]"
            await page.wait_for_selector(listbox_selector, state="visible", timeout=10000)
            print("Autocomplete listbox is visible.")

            # Use screenshot to see the listbox state
            await page.screenshot(path="/home/jules/verification/autocomplete_visible.png")

            # Click the second item (age)
            # Find all buttons or divs within the listbox
            items = page.locator(f"{listbox_selector} button, {listbox_selector} div[role='button'], {listbox_selector} div.cursor-pointer")
            count = await items.count()
            print(f"Found {count} items in autocomplete list.")

            if count >= 2:
                # Get the text of the second item before clicking
                item_text = (await items.nth(1).inner_text()).strip()
                print(f"Clicking item: {item_text}")

                # Click it
                await items.nth(1).click()

                # Verify the text in the editor
                content = await editor.input_value()
                print("Editor content after click:")
                last_line = content.strip().split('\n')[-1]
                print(f"Last line: {last_line}")

                if "greet.age" in last_line or "greet.name" in last_line or "greet.email" in last_line:
                     print(f"SUCCESS: Autocomplete selection '{last_line}' detected.")
                else:
                    print(f"FAILURE: Expected a valid field selection, but found '{last_line}'")
            else:
                print("FAILURE: Not enough items in autocomplete list.")

        except Exception as e:
            print(f"Error or timeout: {e}")
            await page.screenshot(path="/home/jules/verification/autocomplete_error.png")
            print("Saved error screenshot to /home/jules/verification/autocomplete_error.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
