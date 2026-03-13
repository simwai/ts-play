import React, { useRef, useEffect } from 'react'
import { Eraser } from 'lucide-react'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { PanelHeader } from './ui/PanelHeader'

export type ConsoleMessage = {
  type: 'log' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'dir'
  args: string[]
  ts: number
}

type Props = {
  messages: ConsoleMessage[]
  onClear: () => void
  isOpen: boolean
  onToggle: () => void
  contentHeight: number
}

function typeVariant(
  type: ConsoleMessage['type']
): 'error' | 'warn' | 'info' | 'default' {
  if (type === 'error') return 'error'
  if (type === 'warn' || type === 'trace') return 'warn'
  if (type === 'info' || type === 'debug' || type === 'dir') return 'info'
  return 'default'
}

function typeLabel(type: ConsoleMessage['type']): string {
  if (type === 'error') return 'ERR'
  if (type === 'warn') return 'WRN'
  if (type === 'info') return 'INF'
  if (type === 'debug') return 'DBG'
  if (type === 'trace') return 'TRC'
  if (type === 'dir') return 'DIR'
  return 'LOG'
}

function typeColorClass(type: ConsoleMessage['type']): string {
  if (type === 'error') return 'text-red'
  if (type === 'warn' || type === 'trace') return 'text-yellow'
  if (type === 'info' || type === 'debug' || type === 'dir') return 'text-blue'
  return 'text-text'
}

export const Console = React.memo(function Console({
  messages,
  onClear,
  isOpen,
  onToggle,
  contentHeight,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  const errors = messages.filter((m) => m.type === 'error').length
  const warns = messages.filter((m) => m.type === 'warn').length

  return (
    <div className='flex flex-col border-t border-surface0 bg-mantle shrink-0'>
      <PanelHeader
        label='Console'
        isOpen={isOpen}
        onToggle={onToggle}
        left={
          <>
            {messages.length > 0 && <Badge label={String(messages.length)} />}
            {errors > 0 && (
              <Badge
                label={`${errors} err`}
                variant='error'
              />
            )}
            {warns > 0 && (
              <Badge
                label={`${warns} warn`}
                variant='warn'
              />
            )}
          </>
        }
        right={
          messages.length > 0 ? (
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onClear()
              }}
              variant='secondary'
              title='Clear console'
              tooltipAlign='right'
              className='text-xs px-2 py-1 h-auto'
            >
              <Eraser size={12} />
              Clear
            </Button>
          ) : undefined
        }
      />

      {isOpen && (
        <div
          className='overflow-y-auto overflow-x-hidden border-t border-surface0'
          style={{ height: contentHeight }}
        >
          {messages.length === 0 ? (
            <div className='flex items-center justify-center h-full text-overlay0 text-xs italic font-mono'>
              No output yet — press Run to execute
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={`${m.ts}-${idx}`}
                className={`flex items-start gap-2 px-3 py-1.5 border-b border-surface0/40 ${
                  m.type === 'error'
                    ? 'bg-red/5'
                    : m.type === 'warn'
                      ? 'bg-yellow/5'
                      : 'bg-transparent'
                }`}
              >
                <Badge
                  label={typeLabel(m.type)}
                  variant={typeVariant(m.type)}
                  className='mt-0.5'
                />
                <pre
                  className={`m-0 p-0 text-xs leading-relaxed whitespace-pre-wrap wrap-break-word flex-1 font-mono ${typeColorClass(m.type)}`}
                >
                  {m.args.join(' ')}
                </pre>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
})
