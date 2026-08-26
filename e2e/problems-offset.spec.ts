import { test, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { Problems } from '../src/components/Problems'
import React from 'react'
import type { TSDiagnostic } from '../src/lib/types'

const diagnostic: TSDiagnostic = {
  start: 42,
  length: 3,
  message: 'Type 5 is not assignable',
  category: 'error',
  line: 7,
  character: 4,
}

test('Problems reports marker-based positions without shifting', async () => {
  const onJumpToProblem = vi.fn()
  render(
    React.createElement(Problems, {
      diagnostics: [diagnostic],
      isOpen: true,
      contentHeight: 12,
      onJumpToProblem,
    })
  )

  // Marker diagnostics are already 1-based from Monaco; display and jump
  // must use them verbatim.
  const position = page.getByText('7:4')
  await expect.element(position).toBeVisible()

  await position.click()
  expect(onJumpToProblem).toHaveBeenCalledWith(7, 4)
})
