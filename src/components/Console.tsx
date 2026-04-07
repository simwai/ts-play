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
  activeTab: 'console' | 'problems' | 'packages'
  onTabChange: (tab: 'console' | 'problems' | 'packages') => void
  problemCount: number
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
  activeTab,
  onTabChange,
  problemCount,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
    if (isOpen && activeTab === 'console') {
      // Debounce scroll to prevent jank during high-frequency logs
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    }
  }, [messages, isOpen, filter, activeTab])

  const errors = messages.filter((m) => m.type === 'error').length
  const warns = messages.filter((m) => m.type === 'warn').length

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      // Node.js warnings filter
      if (!showNodeWarnings && m.args.some((arg) => arg.startsWith('(node:'))) {
        return false
      }

      if (filter === 'all') return true
      if (filter === 'log') return m.type === 'log'
      if (filter === 'info')
        return m.type === 'info' || m.type === 'debug' || m.type === 'dir'
      if (filter === 'warn') return m.type === 'warn' || m.type === 'trace'
      if (filter === 'error') return m.type === 'error'
      return true
    })
  }, [messages, filter, showNodeWarnings])

  const FilterButton = ({
    type,
    label,
  }: {
    type: FilterType
    label: string
  }) => (
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

  const TabButton = ({
    id,
    label,
    count,
    variant,
  }: {
    id: 'console' | 'problems' | 'packages'
    label: string
    count?: number
    variant?: 'error' | 'warn' | 'info' | 'default'
  }) => (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onTabChange(id)
        if (!isOpen) onToggle()
      }}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all duration-200 ${
        activeTab === id
          ? 'bg-surface0 text-mauve shadow-sm'
          : 'text-overlay1 hover:text-text hover:bg-surface0/50'
      }`}
    >
      <span className='text-[10px] font-mono font-bold uppercase tracking-wider'>
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <Badge
          label={String(count)}
          variant={variant}
          className='scale-90 origin-left'
        />
      )}
    </button>
  )

  return (
    <div
      className='flex flex-col border-t border-surface0 bg-mantle shrink-0'
      data-testid='console-container'
    >
      <div
        className='flex items-center justify-between px-2 py-1 h-10 transition-colors duration-150 bg-mantle/50 border-b border-surface0/30'
        onClick={onToggle}
      >
        <div className='flex items-center gap-1'>
          <TabButton
            id='console'
            label='Console'
            count={messages.length}
          />
          <TabButton
            id='problems'
            label='Problems'
            count={problemCount}
            variant={problemCount > 0 ? 'error' : 'default'}
          />
          <TabButton
            id='packages'
            label='Packages'
          />
        </div>

        <div className='flex items-center gap-3 pr-2'>
          {activeTab === 'console' && messages.length > 0 && (
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
              className='h-6 px-2'
            >
              <Eraser size={11} />
              <span className='hidden sm:inline'>Clear</span>
            </Button>
          )}
          <span
            className={`text-sm inline-block leading-none pointer-events-none transition-transform duration-200 text-overlay1 ${
              isOpen ? 'rotate-180' : 'rotate-0'
            }`}
          >
            ▾
          </span>
        </div>
      </div>

      {isOpen && activeTab === 'console' && (
        <>
          <div className='flex items-center gap-2 px-4 py-1.5 bg-base/30 border-b border-surface0/20'>
            <div className='flex bg-surface0/50 rounded px-1 py-0.5 gap-1 shrink-0'>
              <FilterButton
                type='all'
                label='All'
              />
              <FilterButton
                type='log'
                label='Log'
              />
              <FilterButton
                type='info'
                label='Info'
              />
              <FilterButton
                type='warn'
                label='Warn'
              />
              <FilterButton
                type='error'
                label='Err'
              />
            </div>
            <div className='flex items-center gap-1.5 ml-auto'>
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
          </div>
          <div
            className='overflow-y-auto overflow-x-hidden'
            style={{ height: `${contentHeight}rem` }}
          >
            {filteredMessages.length === 0 ? (
              <div className='flex items-center justify-center h-full text-overlay0 text-xxs md:text-xs italic font-mono'>
                {messages.length === 0
                  ? 'No output yet — press Run to execute'
                  : 'No matches for selected filter'}
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
        </>
      )}
    </div>
  )
})
