import { test, expect } from '@playwright/test';

test.describe('Visual Regression & Theme Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the environment to be ready
    await page.waitForSelector('[data-testid="status-bar-compiler-status"]:has-text("Ready")', { timeout: 60000 });
  });

  const analyzeTheme = async (page, mode: 'light' | 'dark') => {
    const stats = await page.evaluate((m) => {
      const getLuminance = (el) => {
        const rgb = window.getComputedStyle(el).backgroundColor.match(/\d+/g).map(Number);
        return (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114);
      };

      const bodyLum = getLuminance(document.body);
      const headerLum = getLuminance(document.querySelector('header') || document.body);
      const editorLum = getLuminance(document.querySelector('.monaco-editor-background') || document.body);

      const isLight = (lum) => lum > 180;
      const isDark = (lum) => lum < 80;

      const check = (lum) => m === 'light' ? isLight(lum) : isDark(lum);

      return {
        body: check(bodyLum),
        header: check(headerLum),
        editor: check(editorLum)
      };
    }, mode);

    const matchCount = Object.values(stats).filter(v => v === true).length;
    // Require at least 2 out of 3 major components to match the theme expectation
    expect(matchCount).toBeGreaterThanOrEqual(2);
  };

  test('Tab selection and dark theme check', async ({ page }) => {
    // Default theme (Mocha) is dark
    await page.click('button:has-text("TS")');
    await analyzeTheme(page, 'dark');

    await page.click('button:has-text("JS")');
    await analyzeTheme(page, 'dark');

    await page.click('button:has-text("DTS")');
    await analyzeTheme(page, 'dark');
  });

  test('Settings modal and light theme check', async ({ page }) => {
    // Open settings
    await page.click('[data-testid="status-bar-settings-button"]');
    await expect(page.locator('h2:has-text("Settings")')).toBeVisible();

    // Switch to light mode (Latte)
    await page.selectOption('select#editor-theme', 'latte');

    // Check theme while modal is open
    await analyzeTheme(page, 'light');

    // Close and check again
    await page.click('button:has-text("Close")');
    await analyzeTheme(page, 'light');
  });
});
