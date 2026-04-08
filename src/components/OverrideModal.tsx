import { AlertTriangle } from 'lucide-react'

type Props = {
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export function OverrideModal({ onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-crust/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-mantle border border-surface0 rounded-lg max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 text-yellow mb-4">
          <AlertTriangle size={24} />
          <h3 className="text-lg font-bold text-text">Unsaved Changes</h3>
        </div>
        <p className="text-subtext0 mb-6 leading-relaxed">
          The compiled JavaScript does not match your current TypeScript code.
          Execution will use the stale version unless you re-run.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm font-medium hover:bg-surface0 text-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-lavender text-crust font-bold text-sm rounded-md hover:opacity-90 transition-all shadow-lg shadow-lavender/20"
          >
            Run anyway
          </button>
        </div>
      </div>
    </div>
  )
}
