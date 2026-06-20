import React, { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-base text-text p-8 text-center">
          <h1 className="text-2xl font-bold text-red mb-4">Something went wrong.</h1>
          <pre className="bg-mantle p-4 rounded border border-surface1 text-xs overflow-auto max-w-full mb-6">
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-mauve text-base rounded font-bold hover:bg-mauve/80 transition-colors"
          >
            Reload Application
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
