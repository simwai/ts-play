import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import CustomTsWorker from './lib/worker?worker'

globalThis.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  const isPlainObject = typeof reason === 'object' && reason !== null
  const isWebContainerCancelation =
    isPlainObject &&
    reason.type === 'cancelation' &&
    typeof reason.msg === 'string'

  if (isWebContainerCancelation) {
    event.preventDefault()
  }
})

if (typeof self !== 'undefined') {
  self.MonacoEnvironment = {
    // @ts-expect-error — MonacoEnvironment global typing not yet available in environment scope
    getWorker(_: string, label: string) {
      const isTypeScriptOrJavaScript = label === 'typescript' || label === 'javascript'
      if (isTypeScriptOrJavaScript) {
        return new CustomTsWorker()
      }
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
