import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import { App } from './App'

const root = document.querySelector('#root')
if (!root) throw new Error('#root element missing from index.html')

window.onerror = function(message, source, lineno, colno, error) {
  console.error("GLOBAL ERROR:", message, "AT", source, lineno, colno, "STACK:", error?.stack);
};
window.onunhandledrejection = function(event) {
  console.error("UNHANDLED REJECTION:", event.reason);
};

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
