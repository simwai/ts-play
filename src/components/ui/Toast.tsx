import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { ToastMessage } from '../../lib/types'

type ToastProps = ToastMessage & {
  onClose: (id: string) => void
}

export function Toast({ id, type, message, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Entrance animation
    setIsVisible(true)

    // Auto-dismiss logic
    const hideTimer = setTimeout(() => {
      setIsVisible(false)
    }, 4700) // Start exit animation slightly before onClose

    const closeTimer = setTimeout(() => {
      onClose(id)
    }, 5000)

    return () => {
      clearTimeout(hideTimer)
      clearTimeout(closeTimer)
    }
  }, [id, onClose])

  const colors = {
    success: 'text-green-400',
    info: 'text-blue-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
  }

  const icons = {
    success: <CheckCircle2 size={20} />,
    info: <Info size={20} />,
    error: <AlertCircle size={20} />,
    warning: <AlertCircle size={20} />,
  }

  return (
    <div
      className={`flex items-center gap-3 bg-mantle border border-surface0 rounded-lg p-4 shadow-xl transition-all duration-300 transform ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0'
      }`}
    >
      <div className={colors[type]}>{icons[type]}</div>
      <div className="flex-1 text-sm text-text font-medium">{message}</div>
      <button
        onClick={() => {
          setIsVisible(false)
          setTimeout(() => onClose(id), 300)
        }}
        className="text-subtext1 hover:text-text transition-colors"
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
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  )
}
