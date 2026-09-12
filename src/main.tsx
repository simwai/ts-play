import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import CustomTsWorker from './lib/worker?worker'

// @webcontainer/api relays headless-runtime teardown as plain-object
// rejections ({type:'cancelation'}) from its internal message channel without
// catching them. Filter that known noise so the console stays clean; real
// errors (Error instances, strings, other shapes) still surface.
globalThis.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  if (
    typeof reason === 'object' &&
    reason !== null &&
    reason.type === 'cancelation' &&
    typeof reason.msg === 'string'
  ) {
    event.preventDefault()
  }
})

if (typeof self !== 'undefined') {
  self.MonacoEnvironment = {
    // @ts-expect-error — MonacoEnvironment global typing not yet available
    getWorker(_: string, label: string) {
      if (label === 'typescript' || label === 'javascript') {
        return new CustomTsWorker()
      }
      // For other languages, return null – Monaco will use its default worker
      return null
    },
  }
}
const rootElement = document.getElementById('root')
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  )
}
