import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className='flex flex-col items-center justify-center h-full p-6 text-center bg-mantle'>
            <h2 className='text-xl font-bold text-red mb-2'>
              Something went wrong
            </h2>
            <p className='text-subtext0 text-sm mb-4'>
              {this.state.error?.message}
            </p>
            <button
              onClick={() => globalThis.location.reload()}
              className='px-4 py-2 bg-lavender text-crust rounded-md font-bold hover:opacity-90 transition-opacity'
            >
              Reload Page
            </button>
          </div>
        )
      )
    }

    return this.props.children
  }
}
