import asyncio
from playwright.async_api import async_playwright
import os

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        page.set_default_timeout(30000)

        print("--- 1. Testing App Load and TS Ready ---")
        await page.goto("http://localhost:5173")
        await page.wait_for_selector("text=TS ready", timeout=60000)
        print("TS ready.")

        print("--- 2. Testing Autocomplete Fix ---")
        # Focus the first textarea (Source)
        editor = page.locator("textarea").first
        await editor.focus()
        await page.keyboard.press("Control+End")
        await page.keyboard.press("Enter")
        await page.keyboard.type("greet.")

        listbox_selector = "div.absolute.z-50.bg-\\[\\#1e1e2e\\]"
        try:
            await page.wait_for_selector(listbox_selector, state="visible", timeout=10000)
            items = page.locator(f"{listbox_selector} button, {listbox_selector} div[role='button'], {listbox_selector} div.cursor-pointer")
            count = await items.count()
            if count > 0:
                print(f"Autocomplete listbox shown with {count} items.")
                # Select the first item
                await items.first.click()
                content = await editor.input_value()
                if "greet.name" in content or "greet.age" in content or "greet.email" in content:
                    print("Autocomplete selection verified.")
                else:
                    print(f"Autocomplete failed. Content: {content.strip().split('\n')[-1]}")
            else:
                print("Autocomplete listbox empty.")
        except Exception as e:
            print(f"Autocomplete listbox did not appear: {e}")

        print("--- 3. Testing Settings Modal and font-size ---")
        # Open settings
        await page.click("button[aria-label='Settings'], button:has-text('Settings')")
        # Find the tsconfig editor in settings
        # It's a CodeEditor inside the modal
        settings_editor = page.locator("div.fixed.inset-0.z-50 textarea")
        # Verify it has the override font size (12px)
        # The wrapper div should have style="font-size: 12px"
        editor_wrapper = page.locator("div.fixed.inset-0.z-50 div.relative.font-mono").first
        font_size = await editor_wrapper.evaluate("el => window.getComputedStyle(el).fontSize")
        print(f"Settings editor font size: {font_size}")
        if font_size == "12px":
            print("Settings font size verified (12px).")
        else:
            print(f"Settings font size MISMATCH: {font_size}")

        print("--- 4. Testing ANSI Toggle ---")
        checkbox = page.locator("text=Interpret ANSI Escapes")
        if await checkbox.is_visible():
            print("'Interpret ANSI Escapes' checkbox is visible.")
        else:
            print("'Interpret ANSI Escapes' checkbox NOT found.")

        print("--- 5. Testing Gradient Footer ---")
        footer = page.locator("text=Made with love by")
        if await footer.is_visible():
            # Check for the font class or style
            font_family = await footer.evaluate("el => window.getComputedStyle(el).fontFamily")
            print(f"Footer font family: {font_family}")
            # Check for the text-gradient class
            classes = await footer.evaluate("el => el.className")
            if "bg-lit-gradient" in classes or "animate-lit-gradient" in classes:
                 print("Gradient footer classes found.")
            else:
                 print(f"Gradient classes NOT found in footer: {classes}")

        await page.screenshot(path="/home/jules/verification/final_verify.png")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
