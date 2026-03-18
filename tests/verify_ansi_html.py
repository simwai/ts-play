import asyncio
from playwright.async_api import async_playwright

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        page.set_default_timeout(30000)

        await page.goto("http://localhost:5173")
        await page.wait_for_selector("text=TS ready", timeout=90000)

        # Open Settings to check if ANSI is enabled
        await page.click("button[aria-label='Settings']")
        checkbox = page.locator("input[type='checkbox']")
        if not await checkbox.is_checked():
            await checkbox.check()
        await page.click("button:has-text('Save Changes')")

        editor = page.locator("textarea").first
        await editor.focus()
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Backspace")

        # Test basic ANSI red
        await page.keyboard.type('console.log("\\u001b[31mRED_TEXT\\u001b[0m");')
        await page.click("button:has-text('Run')")
        await asyncio.sleep(2)

        last_message = page.locator("div.border-b.border-surface0\\/40").last
        html = await last_message.inner_html()
        print(f"Basic ANSI HTML: {html}")

        if 'style="color:#A00"' in html or 'style="color: rgb(170, 0, 0)"' in html:
            print("Basic ANSI Red Success.")
        else:
            print("Basic ANSI Red Failure.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
