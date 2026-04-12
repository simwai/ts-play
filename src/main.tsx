import "./lib/polyfill"
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary'
import { App } from './App'
import './index.css'

const root = document.querySelector('#root')
if (!root) throw new Error('#root element missing from index.html')

window.onerror = function (message, source, lineno, colno, error) {
  console.error(
    'GLOBAL ERROR:',
    message,
    'AT',
    source,
    lineno,
    colno,
    'STACK:',
    error?.stack
  )
}
window.onunhandledrejection = function (event) {
  console.error('UNHANDLED REJECTION:', event.reason)
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
