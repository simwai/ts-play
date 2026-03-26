import { test, expect } from '@playwright/test';

test.describe('TSPlay Happy Path', () => {
  test('reloads, waits for readiness, and runs code', async ({ page }) => {
    await page.goto('/');

    const runButton = page.getByTestId('header-run-button');
    await expect(runButton).toBeDisabled();

    // The status bar text can be complex, let's wait for the enabled state
    await expect(runButton).toBeEnabled({ timeout: 120000 });

    await runButton.click();

    const consoleContainer = page.getByTestId('console-container');
    await expect(consoleContainer).toContainText('Hello, Alice!', {
      timeout: 30000,
    });
  });
});
