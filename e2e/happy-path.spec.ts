import { test, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { App } from '../src/App'
import React from 'react'
import { page } from 'vitest/browser'

test('TSPlay Happy Path', { timeout: 30000 }, async () => {
  render(React.createElement(App))

  const runButton = page.getByTestId('header-run-button')

  await expect.element(runButton).toBeVisible()

  await runButton.click()

  const consoleContainer = page.getByTestId('console-container')
  await expect.element(consoleContainer).toBeVisible()
})
