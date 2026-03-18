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

        # Add code that uses ANSI truecolor (24-bit) escape sequence
        ansi_code = """console.log("\\x1b[38;2;255;100;0mTRUECOLOR ORANGE\\x1b[0m");"""
        await page.keyboard.type(ansi_code)

        # Click Run
        await page.click("button:has-text('Run')")

        # Wait for console output
        await asyncio.sleep(2)

        # Check console output
        # Use a more robust selector that doesn't rely on tailwind fractional classes
        console_items = page.locator("div.border-b.border-surface0\\/40")
        count = await console_items.count()
        print(f"Found {count} console messages.")

        if count > 0:
            last_message = console_items.last
            # Look for the color-styled span
            colored_span = last_message.locator("span")
            span_count = await colored_span.count()
            print(f"Found {span_count} spans in last message.")

            if span_count > 0:
                # Find the one with style containing 'color'
                for i in range(span_count):
                    style = await colored_span.nth(i).get_attribute("style")
                    if style and "color" in style:
                        print(f"Found styled span: {style}")
                        if "rgb(255, 100, 0)" in style or "rgb(255, 100, 0)" in style.lower():
                             print("SUCCESS: TrueColor ANSI escape rendered correctly!")
                             return
            print("FAILURE: No orange styled span found in message.")
        else:
             print("FAILURE: Console output empty.")

        await page.screenshot(path="/home/jules/verification/ansi_check.png")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
