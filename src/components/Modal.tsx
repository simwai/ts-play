import { useEffect } from 'react'
import { Button } from './ui/Button'

type Props = {
  onConfirm: () => void
  onCancel: () => void
}

export function OverrideModal({ onConfirm, onCancel }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }

    globalThis.addEventListener('keydown', handler)
    return () => {
      globalThis.removeEventListener('keydown', handler)
    }
  }, [onCancel, onConfirm])

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-crust/75 backdrop-blur-sm"
    >
      <div
        onClick={(e) => {
          e.stopPropagation()
        }}
        className="bg-mantle border border-surface1 rounded-xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl shadow-crust"
      >
        <div className="p-5 pb-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg shrink-0 bg-peach/20 border border-peach/30 flex items-center justify-center text-lg">
            ⚠️
          </div>
          <div>
            <h3 className="m-0 text-base font-semibold text-text">Override JS Code?</h3>
            <p className="m-0 mt-1.5 text-sm text-subtext0 leading-relaxed">
              The JavaScript editor has been manually edited. Running TypeScript will overwrite
              those changes.
            </p>
            <p className="m-0 mt-1.5 text-xs text-overlay0 font-mono">
              Press <strong className="text-text">Enter</strong> to confirm,{' '}
              <strong className="text-text">Escape</strong> to cancel.
            </p>
          </div>
        </div>

        <div className="flex gap-2 px-4 py-3 justify-end border-t border-surface0">
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant="primary"
            className="bg-peach text-crust hover:bg-peach/90"
          >
            Override
          </Button>
        </div>
      </div>
    </div>
  )
}
