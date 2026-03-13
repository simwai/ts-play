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
      className='fixed inset-0 z-[8000] flex items-center justify-center bg-crust/75 backdrop-blur-sm'
    >
      <div
        onClick={(e) => {
          e.stopPropagation()
        }}
        className='bg-mantle border border-surface1 rounded-[10px] w-[min(92vw,380px)] overflow-hidden shadow-[0_20px_60px_var(--color-crust)]'
      >
        <div className='p-5 pb-4 flex items-start gap-3'>
          <div className='w-9 h-9 rounded-lg shrink-0 bg-peach/20 border border-peach/30 flex items-center justify-center text-lg'>
            ⚠️
          </div>
          <div>
            <h3 className='m-0 text-[15px] font-semibold text-text'>
              Override JS Code?
            </h3>
            <p className='m-0 mt-1.5 text-[13px] text-subtext0 leading-[1.6]'>
              The JavaScript editor has been manually edited. Running TypeScript
              will overwrite those changes.
            </p>
            <p className='m-0 mt-1.5 text-[11px] text-overlay0 font-mono'>
              Press <strong className='text-text'>Enter</strong> to confirm,{' '}
              <strong className='text-text'>Escape</strong> to cancel.
            </p>
          </div>
        </div>

        <div className='flex gap-2 px-4 py-3 justify-end border-t border-surface0'>
          <Button
            onClick={onCancel}
            variant='secondary'
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant='primary'
            className='bg-peach text-crust hover:bg-peach/90'
          >
            Override
          </Button>
        </div>
      </div>
    </div>
  )
}
