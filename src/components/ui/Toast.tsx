import { useEffect } from 'react'
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { ToastMessage } from '../../lib/types'

interface ToastProps extends ToastMessage {
  onClose: (id: string) => void
}

export function Toast({ id, type, message, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), 5000)
    return () => clearTimeout(timer)
  }, [id, onClose])

  const icons = {
    success: <CheckCircle2 className='w-5 h-5 text-green' />,
    info: <Info className='w-5 h-5 text-blue' />,
    error: <AlertCircle className='w-5 h-5 text-red' />,
  }

  const borderColors = {
    success: 'border-green/30',
    info: 'border-blue/30',
    error: 'border-red/30',
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg border bg-mantle shadow-lg animate-in fade-in slide-in-from-right-4 duration-300',
        borderColors[type]
      )}
    >
      <div className='shrink-0'>{icons[type]}</div>
      <p className='text-sm font-medium text-text'>{message}</p>
      <button
        onClick={() => onClose(id)}
        className='ml-auto text-overlay0 hover:text-text transition-colors'
      >
        <X className='w-4 h-4' />
      </button>
    </div>
  )
}

export function ToastContainer({
  toasts,
  onClose,
}: {
  toasts: ToastMessage[]
  onClose: (id: string) => void
}) {
  return (
    <div className='fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none'>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className='pointer-events-auto'
        >
          <Toast
            {...toast}
            onClose={onClose}
          />
        </div>
      ))}
    </div>
  )
}
