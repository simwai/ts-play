import React, { useEffect, useState } from 'react'
import { X, CheckCircle, Info, AlertCircle } from 'lucide-react'
import type { ToastMessage, ToastType } from '../../lib/types'

const TOAST_COLORS: Record<ToastType, string> = {
  success: 'bg-green text-crust',
  info: 'bg-blue text-crust',
  error: 'bg-red text-crust',
}

const TOAST_ICONS: Record<ToastType, any> = {
  success: CheckCircle,
  info: Info,
  error: AlertCircle,
}

export function Toast({
  message,
  onClose,
}: {
  message: ToastMessage
  onClose: (id: string) => void
}) {
  const [isVisible, setIsVisible] = useState(true)
  const Icon = TOAST_ICONS[message.type]

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => onClose(message.id), 300)
    }, 4000)
    return () => clearTimeout(timer)
  }, [message.id, onClose])

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl transition-all duration-300 ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0'
      } ${TOAST_COLORS[message.type]}`}
    >
      <Icon size={18} />
      <span className="text-xs font-bold font-mono">{message.message}</span>
      <button
        onClick={() => onClose(message.id)}
        className="ml-auto p-1 hover:bg-black/10 rounded-full transition-colors"
      >
        <X size={14} />
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
    <div className="fixed bottom-24 right-6 flex flex-col gap-3 z-[100] max-w-xs w-full pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast message={toast} onClose={onClose} />
        </div>
      ))}
    </div>
  )
}
