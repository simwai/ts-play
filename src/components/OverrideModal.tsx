import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
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
      className='fixed inset-0 z-[200] flex items-center justify-center bg-crust/80 backdrop-blur-sm animate-in fade-in duration-200'
    >
      <div
        onClick={(e) => {
          e.stopPropagation()
        }}
        className='bg-mantle border border-surface1 rounded-xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl shadow-crust animate-in zoom-in-95 duration-200'
      >
        <div className='p-6 pb-4 flex items-start gap-4'>
          <div className='w-10 h-10 rounded-lg shrink-0 bg-yellow/10 border border-yellow/20 flex items-center justify-center'>
            <AlertTriangle size={22} className="text-yellow" />
          </div>
          <div>
            <h3 className='m-0 text-lg font-bold text-text'>
              Unsaved Changes?
            </h3>
            <p className='m-0 mt-2 text-sm text-subtext0 leading-relaxed'>
              The compiled JavaScript does not match your current TypeScript code.
              Execution will overwrite the manual edits in the JS tab.
            </p>
            <p className='m-0 mt-3 text-[10px] text-overlay0 font-mono uppercase tracking-wider'>
              Press <strong className='text-subtext1'>Enter</strong> to confirm,{' '}
              <strong className='text-subtext1'>Esc</strong> to cancel.
            </p>
          </div>
        </div>

        <div className='flex gap-3 px-6 py-4 justify-end border-t border-surface0/50 bg-mantle/50'>
          <button
            onClick={onCancel}
            className='px-4 py-2 rounded-md text-sm font-medium hover:bg-surface0 text-text transition-colors'
          >
            Cancel
          </button>
          <Button
            onClick={onConfirm}
            variant='primary'
            className='bg-lavender text-crust hover:bg-lavender/90 px-6'
          >
            Run anyway
          </Button>
        </div>
      </div>
    </div>
  )
}
