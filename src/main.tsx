import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import './index.css'
import { App } from './App'

createRoot(document.querySelector('#root')!).render(
  <StrictMode>
    <ErrorBoundary
      fallback={
        <div
          style={{
            padding: 24,
            color: '#cdd6f4',
            background: '#1e1e2e',
            fontFamily: 'monospace',
            height: '100dvh',
          }}
        >
          Something went wrong. Please reload the page.
        </div>
      }
    >
      <App />
    </ErrorBoundary>
  </StrictMode>
)
