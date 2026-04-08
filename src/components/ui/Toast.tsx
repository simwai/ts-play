import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react'
import { ToastMessage } from '../../lib/types'
import { cn } from '../../lib/utils'

type ToastProps = ToastMessage & {
  onClose: (id: string) => void
}

export function Toast({ id, type, message, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => onClose(id), 300)
    }, 4700)
    return () => clearTimeout(timer)
  }, [id, onClose])

  const icons = {
    success: <CheckCircle2 className='w-5 h-5 text-green' />,
    info: <Info className='w-5 h-5 text-blue' />,
    error: <AlertCircle className='w-5 h-5 text-red' />,
    warning: <AlertTriangle className='w-5 h-5 text-yellow' />,
  }

  const borderColors = {
    success: 'border-green/30',
    info: 'border-blue/30',
    error: 'border-red/30',
    warning: 'border-yellow/30',
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 bg-mantle border rounded-lg p-4 shadow-xl transition-all duration-300 transform pointer-events-auto',
        borderColors[type],
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0'
      )}
    >
      <div className='shrink-0'>{icons[type]}</div>
      <div className='flex-1 text-sm text-text font-medium'>{message}</div>
      <button
        onClick={() => {
          setIsVisible(false)
          setTimeout(() => onClose(id), 300)
        }}
        className='text-subtext1 hover:text-text transition-colors'
      >
        <X size={18} />
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
    <div className='fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none'>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={onClose}
        />
      ))}
    </div>
  )
}
