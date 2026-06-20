import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import CustomTsWorker from './lib/worker?worker'
if (typeof self !== 'undefined') {
  self.MonacoEnvironment = {
    // @ts-ignore
    getWorker(_: string, label: string) {
      if (label === 'typescript' || label === 'javascript') {
        console.log('[MonacoEnvironment] Returning custom worker')
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
