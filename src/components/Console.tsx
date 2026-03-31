import React, { useRef, useEffect, useMemo, useState } from 'react'
import { Eraser } from 'lucide-react'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { PanelHeader } from './ui/PanelHeader'
import Ansi from 'ansi-to-html'

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
  contentHeight: number // Now in rem
  trueColorEnabled?: boolean
  showNodeWarnings?: boolean
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

type FilterType = 'all' | 'log' | 'info' | 'warn' | 'error'

export const Console = React.memo(function Console({
  messages,
  onClear,
  isOpen,
  onToggle,
  contentHeight,
  trueColorEnabled = true,
  showNodeWarnings = true,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<FilterType>('all')

  // Create Ansi converter with truecolor support if enabled
  const ansiConvert = useMemo(
    () =>
      new Ansi({
        newline: false,
        escapeHtml: true,
        stream: false,
        colors: trueColorEnabled
          ? undefined
          : {
              // Standard 16 colors fallback if needed
            },
      }),
    [trueColorEnabled]
  )

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen, filter])

  const errors = messages.filter((m) => m.type === 'error').length
  const warns = messages.filter((m) => m.type === 'warn').length

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      // Node.js warnings filter
      if (!showNodeWarnings && m.args.some(arg => arg.startsWith('(node:'))) {
        return false
      }

      if (filter === 'all') return true
      if (filter === 'log') return m.type === 'log'
      if (filter === 'info') return m.type === 'info' || m.type === 'debug' || m.type === 'dir'
      if (filter === 'warn') return m.type === 'warn' || m.type === 'trace'
      if (filter === 'error') return m.type === 'error'
      return true
    })
  }, [messages, filter, showNodeWarnings])

  const FilterButton = ({ type, label }: { type: FilterType, label: string }) => (
    <button
      onClick={(e) => {
        e.stopPropagation()
        setFilter(type)
      }}
      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-colors ${
        filter === type
          ? 'bg-mauve/20 text-mauve'
          : 'text-overlay1 hover:text-text'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div
      className='flex flex-col border-t border-surface0 bg-mantle shrink-0'
      data-testid='console-container'
    >
      <PanelHeader
        label='Console'
        isOpen={isOpen}
        onToggle={onToggle}
        left={
          <div className='flex items-center gap-2'>
            <div className='flex bg-surface0 rounded px-1 py-0.5 gap-1 shrink-0'>
              <FilterButton type='all' label='All' />
              <FilterButton type='log' label='Log' />
              <FilterButton type='info' label='Info' />
              <FilterButton type='warn' label='Warn' />
              <FilterButton type='error' label='Err' />
            </div>
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
          </div>
        }
        right={
          messages.length > 0 ? (
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onClear()
              }}
              variant='secondary'
              size='xs'
              title='Clear console'
              data-testid='console-clear-button'
              tooltipAlign='right'
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
          style={{ height: `${contentHeight}rem` }}
        >
          {filteredMessages.length === 0 ? (
            <div className='flex items-center justify-center h-full text-overlay0 text-xxs md:text-xs italic font-mono'>
              {messages.length === 0 ? 'No output yet — press Run to execute' : 'No matches for selected filter'}
            </div>
          ) : (
            filteredMessages.map((m, idx) => {
              const fullText = m.args.join(' ')
              const hasAnsi =
                trueColorEnabled && /[\u001b\u009b]/.test(fullText)

              return (
                <div
                  key={`${m.ts}-${idx}`}
                  data-testid='console-message'
                  className={`flex items-start gap-2.5 px-3 py-1.5 border-b border-surface0/40 ${
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
                  {hasAnsi ? (
                    <div
                      className={`m-0 p-0 text-xxs md:text-xs leading-relaxed whitespace-pre-wrap wrap-break-word flex-1 font-mono`}
                      dangerouslySetInnerHTML={{
                        __html: ansiConvert.toHtml(fullText),
                      }}
                    />
                  ) : (
                    <pre
                      className={`m-0 p-0 text-xxs md:text-xs leading-relaxed whitespace-pre-wrap wrap-break-word flex-1 font-mono ${typeColorClass(m.type)}`}
                    >
                      {fullText}
                    </pre>
                  )}
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
})
