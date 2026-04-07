import React from 'react'
import type { TSDiagnostic } from '../lib/types'
import { AlertCircle, AlertTriangle } from 'lucide-react'

type ProblemsProps = {
  diagnostics: TSDiagnostic[]
  isOpen: boolean
  contentHeight: number
  onJumpToProblem?: (line: number, character: number) => void
}

export const Problems = React.memo(function Problems({
  diagnostics,
  isOpen,
  contentHeight,
  onJumpToProblem,
}: ProblemsProps) {
  if (!isOpen) return null

  return (
    <div
      className='overflow-y-auto overflow-x-hidden border-t border-surface0 bg-mantle'
      style={{ height: `${contentHeight}rem` }}
    >
      {diagnostics.length === 0 ? (
        <div className='flex items-center justify-center h-full text-overlay0 text-xxs md:text-xs italic font-mono'>
          No problems detected in main.ts
        </div>
      ) : (
        <div className='flex flex-col'>
          {diagnostics.map((diag, idx) => (
            <button
              key={`${diag.line}-${diag.character}-${idx}`}
              onClick={() =>
                onJumpToProblem?.(diag.line + 1, diag.character + 1)
              }
              className='flex items-start gap-3 px-4 py-2 border-b border-surface0/40 hover:bg-surface0/30 transition-colors text-left group'
            >
              <div className='mt-0.5 shrink-0'>
                {diag.category === 'error' ? (
                  <AlertCircle className='w-3.5 h-3.5 text-red' />
                ) : (
                  <AlertTriangle className='w-3.5 h-3.5 text-yellow' />
                )}
              </div>
              <div className='flex flex-col gap-0.5 flex-1 min-w-0'>
                <div className='flex items-center gap-2'>
                  <span className='text-[10px] font-bold font-mono text-overlay1 uppercase tracking-tight'>
                    main.ts
                  </span>
                  <span className='text-[10px] font-mono text-mauve/70'>
                    {diag.line + 1}:{diag.character + 1}
                  </span>
                </div>
                <div className='text-xxs md:text-xs font-mono text-text leading-snug break-words'>
                  {diag.message}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
})
