import asyncio
from playwright.async_api import async_playwright

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        page.set_default_timeout(30000)

        await page.goto("http://localhost:5173")
        await page.wait_for_selector("text=TS ready", timeout=60000)

        # The default code has JSDoc.
        # Let's add more to make it longer and check drift.
        editor = page.locator("textarea").first
        await editor.focus()
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Backspace")

        long_code = """/**
 * This is a long JSDoc comment to test alignment.
 * It has many lines.
 * Line 1
 * Line 2
 * Line 3
 * Line 4
 * Line 5
 */
function test() {
  console.log("hello");
}

/**
 * Another one.
 * Let's see if we drift.
 */
const x = 123;
"""
        await page.keyboard.type(long_code)

        # Take a screenshot to visually inspect alignment
        await page.screenshot(path="/home/jules/verification/alignment_check.png")
        print("Alignment check screenshot saved to /home/jules/verification/alignment_check.png")

        # Check if the text is visible in the pre tag (the highlighted layer)
        # and if it roughly matches the textarea
        pre_text = await page.locator("pre").first.inner_text()
        print(f"Pre text length: {len(pre_text)}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
